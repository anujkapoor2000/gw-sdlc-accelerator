// /api/chat.js — Vercel serverless proxy to the Anthropic Messages API.
// The browser never sees the API key; it lives in the ANTHROPIC_API_KEY env var.
//
// Streams the model response back as plain text so long generations (e.g. the
// Test Migrator producing several full scripts at once) keep bytes flowing and
// don't trip Vercel's response/idle timeout — which surfaces in the browser as
// a generic "Load failed". maxDuration gives the function room to finish.

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured. Add it in Vercel → Settings → Environment Variables.'
    })
  }

  const { system, messages, max_tokens } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' })
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: Math.min(max_tokens || 4096, 8192),
        system: system || undefined,
        messages,
        stream: true
      })
    })

    // Errors arrive before any streaming starts — return them as JSON so the
    // client can surface a real message instead of a network failure.
    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}))
      return res.status(upstream.status).json({
        error: data?.error?.message || `Upstream Anthropic API error (${upstream.status})`
      })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')

    // Parse the Anthropic SSE stream and forward only the text deltas.
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // keep the trailing partial line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const evt = JSON.parse(payload)
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            res.write(evt.delta.text)
          } else if (evt.type === 'error') {
            res.write(`\n[stream error: ${evt.error?.message || 'unknown'}]`)
          }
        } catch {
          /* keepalive ping or partial JSON — ignore */
        }
      }
    }

    return res.end()
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'Proxy request failed' })
    }
    return res.end()
  }
}

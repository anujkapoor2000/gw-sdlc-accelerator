// /api/chat.js — Vercel serverless proxy to the Anthropic Messages API.
// The browser never sees the API key; it lives in the ANTHROPIC_API_KEY env var.
//
// maxDuration gives the function headroom; the Test Migrator keeps each request
// small by converting one test case per call, so a plain buffered JSON response
// returns well within the window. (A manual res.write() streaming variant was
// tried and reverted — it failed at runtime on this deployment.)

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
        messages
      })
    })

    const data = await upstream.json()
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message || 'Upstream Anthropic API error'
      })
    }

    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    return res.status(200).json({ text, usage: data.usage })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Proxy request failed' })
  }
}

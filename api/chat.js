// /api/chat.js — Vercel Edge Runtime proxy to the Anthropic Messages API.
// Edge Runtime passes the Anthropic SSE stream straight to the browser so the
// connection stays alive for large generations and "Load failed" timeouts are gone.
// The browser never sees the API key; it lives in the ANTHROPIC_API_KEY env var.

export const config = { runtime: 'edge', maxDuration: 60 }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' }
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'ANTHROPIC_API_KEY is not configured. Add it in Vercel → Settings → Environment Variables.'
    }), { status: 500, headers: { 'content-type': 'application/json' } })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    })
  }

  const { system, messages, max_tokens } = body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    })
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

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}))
      return new Response(JSON.stringify({
        error: data?.error?.message || 'Upstream Anthropic API error'
      }), { status: upstream.status, headers: { 'content-type': 'application/json' } })
    }

    // Pass the Anthropic SSE stream straight through to the browser.
    return new Response(upstream.body, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'x-accel-buffering': 'no'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Proxy request failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}

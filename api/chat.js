// /api/chat.js — Vercel serverless proxy to the Anthropic Messages API.
// The browser never sees the API key; it lives in the ANTHROPIC_API_KEY env var.
//
// Uses Anthropic's SSE streaming so tokens flow to the browser as they are
// generated, keeping the connection alive and avoiding Vercel's hard timeout.

export const config = { maxDuration: 60 }

// Published list prices, USD per 1,000,000 tokens (input / output). Keys match
// model-id prefixes so a dated or aliased id still resolves. Update when
// Anthropic pricing changes, or override per-deployment via the env vars below.
const PRICING = {
  'claude-opus-4': { input: 5, output: 25 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-4': { input: 1, output: 5 }
}
const DEFAULT_PRICE = { input: 3, output: 15 } // Sonnet-tier fallback

// Cache-token multipliers relative to the base input price.
const CACHE_WRITE_MULT = 1.25 // 5-minute TTL write premium
const CACHE_READ_MULT = 0.1 // cache read discount

function priceFor(model) {
  const envIn = parseFloat(process.env.ANTHROPIC_PRICE_INPUT)
  const envOut = parseFloat(process.env.ANTHROPIC_PRICE_OUTPUT)
  if (!Number.isNaN(envIn) && !Number.isNaN(envOut)) {
    return { input: envIn, output: envOut, source: 'env' }
  }
  const key = Object.keys(PRICING).find((p) => (model || '').startsWith(p))
  return { ...(key ? PRICING[key] : DEFAULT_PRICE), source: key ? 'list' : 'fallback' }
}

// Turn an Anthropic usage object into a per-request cost breakdown (USD).
function computeCost(model, usage) {
  const price = priceFor(model)
  const perTokIn = price.input / 1e6
  const perTokOut = price.output / 1e6

  const inputTokens = usage?.input_tokens || 0
  const outputTokens = usage?.output_tokens || 0
  const cacheWriteTokens = usage?.cache_creation_input_tokens || 0
  const cacheReadTokens = usage?.cache_read_input_tokens || 0

  const round = (n) => Math.round(n * 1e6) / 1e6 // 6dp — sub-cent precision
  const inputUSD = inputTokens * perTokIn
  const outputUSD = outputTokens * perTokOut
  const cacheWriteUSD = cacheWriteTokens * perTokIn * CACHE_WRITE_MULT
  const cacheReadUSD = cacheReadTokens * perTokIn * CACHE_READ_MULT

  return {
    currency: 'USD',
    inputUSD: round(inputUSD),
    outputUSD: round(outputUSD),
    cacheWriteUSD: round(cacheWriteUSD),
    cacheReadUSD: round(cacheReadUSD),
    totalUSD: round(inputUSD + outputUSD + cacheWriteUSD + cacheReadUSD),
    rates: { inputPerMTok: price.input, outputPerMTok: price.output, source: price.source }
  }
}

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

  let upstream
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: Math.min(max_tokens || 4096, 16000),
        system: system || undefined,
        messages,
        stream: true
      })
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to connect to AI service' })
  }

  if (!upstream.ok) {
    const errData = await upstream.json().catch(() => ({}))
    return res.status(upstream.status).json({
      error: errData?.error?.message || 'Upstream Anthropic API error'
    })
  }

  // Stream SSE tokens back to the browser as they arrive.
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let usage = {}
  let model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  let stopReason = null
  let streamError = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() // keep any incomplete trailing line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') continue
        let evt
        try { evt = JSON.parse(raw) } catch { continue }

        if (evt.type === 'message_start') {
          if (evt.message?.model) model = evt.message.model
          if (evt.message?.usage) Object.assign(usage, evt.message.usage)
        } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ t: evt.delta.text })}\n\n`)
        } else if (evt.type === 'message_delta') {
          if (evt.usage) Object.assign(usage, evt.usage)
          if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason
        }
      }
    }
  } catch (err) {
    streamError = err.message || 'Stream interrupted'
  } finally {
    if (streamError) {
      res.write(`data: ${JSON.stringify({ error: streamError })}\n\n`)
    } else if (stopReason === 'max_tokens') {
      res.write(`data: ${JSON.stringify({ error: 'The response was cut off because it exceeded the token limit. Try splitting your requirements into smaller batches.' })}\n\n`)
    }
    const cost = computeCost(model, usage)
    res.write(`data: ${JSON.stringify({ done: true, model, usage, cost, stopReason })}\n\n`)
    res.end()
  }
}

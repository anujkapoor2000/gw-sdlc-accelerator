// /api/chat.js — Vercel Edge Function proxy to the Anthropic Messages API.
// Edge Runtime eliminates the 60-second serverless timeout: streaming
// responses stay alive as long as tokens are flowing.

export const config = { runtime: 'edge' }

// Published list prices, USD per 1,000,000 tokens (input / output). Keys match
// model-id prefixes so a dated or aliased id still resolves. Update when
// Anthropic pricing changes, or override per-deployment via the env vars below.
const PRICING = {
  'claude-opus-4': { input: 5, output: 25 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-4': { input: 1, output: 5 }
}
const DEFAULT_PRICE = { input: 3, output: 15 } // Sonnet-tier fallback

const CACHE_WRITE_MULT = 1.25
const CACHE_READ_MULT = 0.1

function priceFor(model) {
  const envIn = parseFloat(process.env.ANTHROPIC_PRICE_INPUT)
  const envOut = parseFloat(process.env.ANTHROPIC_PRICE_OUTPUT)
  if (!Number.isNaN(envIn) && !Number.isNaN(envOut)) {
    return { input: envIn, output: envOut, source: 'env' }
  }
  const key = Object.keys(PRICING).find((p) => (model || '').startsWith(p))
  return { ...(key ? PRICING[key] : DEFAULT_PRICE), source: key ? 'list' : 'fallback' }
}

function computeCost(model, usage) {
  const price = priceFor(model)
  const perTokIn = price.input / 1e6
  const perTokOut = price.output / 1e6
  const inputTokens = usage?.input_tokens || 0
  const outputTokens = usage?.output_tokens || 0
  const cacheWriteTokens = usage?.cache_creation_input_tokens || 0
  const cacheReadTokens = usage?.cache_read_input_tokens || 0
  const round = (n) => Math.round(n * 1e6) / 1e6
  return {
    currency: 'USD',
    inputUSD: round(inputTokens * perTokIn),
    outputUSD: round(outputTokens * perTokOut),
    cacheWriteUSD: round(cacheWriteTokens * perTokIn * CACHE_WRITE_MULT),
    cacheReadUSD: round(cacheReadTokens * perTokIn * CACHE_READ_MULT),
    totalUSD: round(
      inputTokens * perTokIn +
      outputTokens * perTokOut +
      cacheWriteTokens * perTokIn * CACHE_WRITE_MULT +
      cacheReadTokens * perTokIn * CACHE_READ_MULT
    ),
    rates: { inputPerMTok: price.input, outputPerMTok: price.output, source: price.source }
  }
}

function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

/** Wrap a long system prompt in an ephemeral cache block when requested. */
function buildSystemPayload(system, cacheSystem) {
  if (!system) return undefined
  if (!cacheSystem) return system
  return [
    {
      type: 'text',
      text: system,
      cache_control: { type: 'ephemeral' }
    }
  ]
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return jsonRes({
      error: 'ANTHROPIC_API_KEY is not configured. Add it in Vercel → Settings → Environment Variables.'
    }, 500)
  }

  let body
  try { body = await req.json() } catch {
    return jsonRes({ error: 'Invalid JSON body' }, 400)
  }

  const { system, messages, max_tokens, cache_system: cacheSystem } = body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonRes({ error: 'messages array is required' }, 400)
  }

  const systemPayload = buildSystemPayload(system, cacheSystem)

  let upstream
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(cacheSystem && system ? { 'anthropic-beta': 'prompt-caching-2024-07-31' } : {})
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: Math.min(max_tokens || 4096, 16000),
        system: systemPayload,
        messages,
        stream: true
      })
    })
  } catch (err) {
    return jsonRes({ error: err.message || 'Failed to connect to AI service' }, 500)
  }

  if (!upstream.ok) {
    const errData = await upstream.json().catch(() => ({}))
    return jsonRes(
      { error: errData?.error?.message || 'Upstream Anthropic API error' },
      upstream.status
    )
  }

  const encoder = new TextEncoder()

  // Pipe Anthropic's SSE → our own SSE, forwarding text deltas and a final
  // done event that carries usage/cost data.
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

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
          buf = lines.pop()

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
              write({ t: evt.delta.text })
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
          write({ error: streamError })
        } else if (stopReason === 'max_tokens') {
          write({ error: 'The response was cut off at the token limit. Try splitting your requirements into smaller batches.' })
        }
        write({ done: true, model, usage, cost: computeCost(model, usage), stopReason })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no'
    }
  })
}

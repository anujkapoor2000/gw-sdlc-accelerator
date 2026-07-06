// /api/datadog.js — server-side proxy for Datadog Logs Search API v2.
// Keeps DD_API_KEY and DD_APP_KEY off the client (same pattern as /api/chat).
//
// POST { query, from, to, service?, limit? }
//   → { entries, meta, configured }

const DEFAULT_SITE = 'datadoghq.com'
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function jsonRes(res, body, status = 200) {
  return res.status(status).json(body)
}

function siteHost() {
  const site = (process.env.DD_SITE || DEFAULT_SITE).replace(/^https?:\/\//, '').replace(/\/$/, '')
  return site.includes('.') ? site : `${site}.com`
}

function buildQuery(baseQuery, service) {
  const q = String(baseQuery || '').trim()
  const svc = String(service || '').trim()
  if (!svc) return q || 'status:error'
  const serviceFilter = `service:${svc.includes(' ') ? `"${svc}"` : svc}`
  return q ? `${q} ${serviceFilter}` : serviceFilter
}

/** Flatten a Datadog Logs API v2 event into the shape logLoader expects. */
export function normalizeDatadogLogEvent(event) {
  const attrs = event?.attributes || {}
  const nested = attrs.attributes && typeof attrs.attributes === 'object' ? attrs.attributes : {}
  const err = nested.error || attrs.error || {}

  return {
    '@timestamp': attrs.timestamp,
    timestamp: attrs.timestamp,
    status: attrs.status || nested.status || nested.level,
    level: nested.level || attrs.status,
    service: attrs.service || nested.service,
    host: attrs.host || nested.host,
    message: attrs.message || nested.message,
    tags: attrs.tags,
    dd: {
      trace_id: nested.trace_id || nested['dd.trace_id'] || attrs.trace_id,
      span_id: nested.span_id || nested['dd.span_id']
    },
    trace_id: nested.trace_id || nested['dd.trace_id'],
    span_id: nested.span_id || nested['dd.span_id'],
    error: typeof err === 'object' ? err : { message: String(err) },
    attributes: nested,
    _datadogId: event?.id
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonRes(res, { error: 'Method not allowed' }, 405)
  }

  const apiKey = process.env.DD_API_KEY
  const appKey = process.env.DD_APP_KEY

  if (!apiKey || !appKey) {
    return jsonRes(res, {
      error: 'Datadog is not configured. Set DD_API_KEY and DD_APP_KEY in Vercel → Settings → Environment Variables.',
      configured: false
    }, 500)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonRes(res, { error: 'Invalid JSON body' }, 400)
  }

  const { query, from, to, service, limit: reqLimit } = body || {}
  if (!from || !to) {
    return jsonRes(res, { error: 'from and to (ISO timestamps) are required' }, 400)
  }

  const limit = Math.min(Math.max(Number(reqLimit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const filterQuery = buildQuery(query, service)

  const payload = {
    filter: { query: filterQuery, from, to },
    page: { limit },
    sort: '-timestamp'
  }

  const host = siteHost()
  let upstream
  try {
    upstream = await fetch(`https://api.${host}/api/v2/logs/events/search`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey
      },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    return jsonRes(res, { error: err.message || 'Failed to connect to Datadog' }, 500)
  }

  const data = await upstream.json().catch(() => ({}))

  if (!upstream.ok) {
    const msg = data?.errors?.[0]?.detail || data?.error || data?.message || 'Datadog API error'
    return jsonRes(res, { error: msg, configured: true }, upstream.status)
  }

  const entries = (data.data || []).map(normalizeDatadogLogEvent)

  return jsonRes(res, {
    configured: true,
    entries,
    meta: {
      query: filterQuery,
      from,
      to,
      limit,
      count: entries.length,
      site: host
    }
  })
}

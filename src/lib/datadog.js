// src/lib/datadog.js — browser-side helper for live Datadog log queries.

import { analyseDatadogEntries } from './logLoader.js'

async function handle(res) {
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Datadog request failed (${res.status})`)
  return data ?? {}
}

/** Preset time ranges for the query UI. */
export const TIME_RANGES = [
  { id: '15m', label: 'Last 15 minutes', ms: 15 * 60 * 1000 },
  { id: '1h', label: 'Last 1 hour', ms: 60 * 60 * 1000 },
  { id: '4h', label: 'Last 4 hours', ms: 4 * 60 * 60 * 1000 },
  { id: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 }
]

export function rangeToIso(rangeId) {
  const preset = TIME_RANGES.find((r) => r.id === rangeId) || TIME_RANGES[1]
  const to = new Date()
  const from = new Date(to.getTime() - preset.ms)
  return { from: from.toISOString(), to: to.toISOString(), label: preset.label }
}

/**
 * Query Datadog Logs API v2 via the server proxy and return a log analysis.
 * @param {{ query?: string, from: string, to: string, service?: string, limit?: number }} params
 */
export async function queryDatadogLogs({ query = 'status:error', from, to, service = '', limit = 100 }) {
  const data = await fetch('/api/datadog', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, from, to, service: service || undefined, limit })
  }).then(handle)

  const label = service
    ? `Datadog live · ${service} · ${data.meta?.query || query}`
    : `Datadog live · ${data.meta?.query || query}`

  return analyseDatadogEntries(data.entries || [], {
    filename: label,
    format: 'datadog-api',
    source: 'live',
    meta: data.meta
  })
}

import React, { useCallback, useMemo, useState } from 'react'

// Inline per-run token + cost badge for a module's result panel.
// A module wires the hook's `onUsage` into each callClaude and `reset()` at the
// start of a run, then renders <RequestCost totals={...} /> near its output.
// Multi-call flows (Defect Triage, Test Migrator) accumulate across calls.

const ZERO = { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, totalUSD: 0 }

export function useRequestCost() {
  const [records, setRecords] = useState([])
  const onUsage = useCallback((r) => setRecords((prev) => [...prev, r]), [])
  const reset = useCallback(() => setRecords([]), [])

  const totals = useMemo(() => records.reduce((t, r) => {
    const u = r.usage || {}
    const c = r.cost || {}
    return {
      requests: t.requests + 1,
      inputTokens: t.inputTokens + (u.input_tokens || 0),
      outputTokens: t.outputTokens + (u.output_tokens || 0),
      cacheReadTokens: t.cacheReadTokens + (u.cache_read_input_tokens || 0),
      totalUSD: t.totalUSD + (c.totalUSD || 0)
    }
  }, ZERO), [records])

  return { onUsage, reset, totals }
}

const fmt = (n) => (n || 0).toLocaleString()
function fmtUSD(v) {
  const n = v || 0
  if (n === 0) return '$0'
  if (n < 0.01) return `$${n.toFixed(5)}`
  return `$${n.toFixed(4)}`
}

export function RequestCost({ totals }) {
  if (!totals || totals.requests === 0) return null
  return (
    <div className="req-cost" title="Estimated from published Claude list prices">
      <span className="req-cost-label">Cost of this run</span>
      <span className="req-cost-toks">
        ↑ {fmt(totals.inputTokens)} in · ↓ {fmt(totals.outputTokens)} out
        {totals.cacheReadTokens > 0 && <> · {fmt(totals.cacheReadTokens)} cached</>}
      </span>
      <span className="req-cost-usd">~{fmtUSD(totals.totalUSD)}</span>
      {totals.requests > 1 && <span className="req-cost-n">across {totals.requests} calls</span>}
    </div>
  )
}

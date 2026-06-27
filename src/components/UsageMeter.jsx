import React, { useEffect, useState } from 'react'
import { subscribeUsage } from '../lib/api.js'

// Friendly labels for the hash-route a request was fired from.
const VIEW_LABELS = {
  home: 'Showcase',
  dashboard: 'Workspace',
  'story-forge': 'Story Forge',
  'code-review': 'Code Review',
  'test-strategist': 'Test Strategist',
  'flow-automator': 'Flow Automator',
  'test-migrator': 'Test Migrator',
  'release-navigator': 'Release Navigator',
  'defect-triage': 'Defect Triage'
}
const label = (v) => VIEW_LABELS[v] || v || '—'

const fmtTokens = (n) => (n || 0).toLocaleString()
function fmtUSD(v) {
  const n = v || 0
  if (n === 0) return '$0'
  if (n < 0.01) return `$${n.toFixed(5)}`
  return `$${n.toFixed(4)}`
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const EMPTY_TOTALS = {
  requests: 0, inputTokens: 0, outputTokens: 0,
  cacheReadTokens: 0, cacheWriteTokens: 0, totalUSD: 0
}

export default function UsageMeter() {
  const [history, setHistory] = useState([]) // newest first
  const [totals, setTotals] = useState(EMPTY_TOTALS)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return subscribeUsage((record) => {
      const u = record.usage || {}
      const c = record.cost || {}
      setHistory((prev) => [record, ...prev].slice(0, 50))
      setTotals((t) => ({
        requests: t.requests + 1,
        inputTokens: t.inputTokens + (u.input_tokens || 0),
        outputTokens: t.outputTokens + (u.output_tokens || 0),
        cacheReadTokens: t.cacheReadTokens + (u.cache_read_input_tokens || 0),
        cacheWriteTokens: t.cacheWriteTokens + (u.cache_creation_input_tokens || 0),
        totalUSD: t.totalUSD + (c.totalUSD || 0)
      }))
    })
  }, [])

  if (totals.requests === 0) return null // nothing to show until the first call

  const last = history[0]
  const lastU = last.usage || {}
  const lastC = last.cost || {}

  return (
    <div className="usage-meter">
      {open && (
        <div className="usage-panel">
          <div className="usage-panel-head">
            <strong>Token usage &amp; cost</strong>
            <button className="usage-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="usage-session">
            <div className="usage-session-row">
              <span>Session total</span>
              <span className="usage-cost">{fmtUSD(totals.totalUSD)}</span>
            </div>
            <div className="usage-session-meta">
              {totals.requests} request{totals.requests === 1 ? '' : 's'} ·
              ↑ {fmtTokens(totals.inputTokens)} in · ↓ {fmtTokens(totals.outputTokens)} out
              {totals.cacheReadTokens > 0 && <> · {fmtTokens(totals.cacheReadTokens)} cached</>}
            </div>
            <div className="usage-disclaimer">
              Estimated from list prices{lastC.rates ? ` (${lastC.rates.inputPerMTok}/${lastC.rates.outputPerMTok} per MTok)` : ''}.
            </div>
          </div>

          <div className="usage-list">
            {history.map((r, i) => (
              <div key={r.at + '-' + i} className="usage-item">
                <div className="usage-item-top">
                  <span className="usage-item-view">{label(r.view)}</span>
                  <span className="usage-cost">{fmtUSD(r.cost?.totalUSD)}</span>
                </div>
                <div className="usage-item-meta">
                  <span>↑ {fmtTokens(r.usage?.input_tokens)} · ↓ {fmtTokens(r.usage?.output_tokens)}</span>
                  {(r.usage?.cache_read_input_tokens > 0) && <span>· {fmtTokens(r.usage.cache_read_input_tokens)} cached</span>}
                  <span className="usage-item-time">{fmtTime(r.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="usage-chip"
        onClick={() => setOpen((o) => !o)}
        title="Token usage and estimated cost — click for the per-request breakdown"
      >
        <span className="usage-dot" aria-hidden="true" />
        <span className="usage-chip-tokens">
          ↑{fmtTokens(lastU.input_tokens)} ↓{fmtTokens(lastU.output_tokens)}
        </span>
        <span className="usage-chip-cost">{fmtUSD(lastC.totalUSD)}</span>
        <span className="usage-chip-total">· Σ {fmtUSD(totals.totalUSD)}</span>
      </button>
    </div>
  )
}

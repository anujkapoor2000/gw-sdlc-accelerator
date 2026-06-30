import React, { useMemo, useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
import { CODE_REVIEW_SYSTEM } from '../lib/prompts.js'
import SaveToProject from '../components/SaveToProject.jsx'
import { useRequestCost, RequestCost } from '../components/RequestCost.jsx'

const PRODUCTS = ['PolicyCenter', 'ClaimCenter', 'BillingCenter', 'Cross-suite']
const CODE_TYPES = ['Gosu class / enhancement', 'PCF configuration', 'Integration / Cloud API', 'GX model', 'Batch process', 'Rules (assignment/validation)']
const PROFILES = [
  { id: 'standards', label: 'Standards & maintainability' },
  { id: 'performance', label: 'Performance & bundles' },
  { id: 'upgrade', label: 'Upgrade / Cloud safety' },
  { id: 'security', label: 'Security' }
]
const SEVERITIES = ['critical', 'major', 'minor', 'info']

export default function CodeReview({ project }) {
  const [code, setCode] = useState('')
  const [product, setProduct] = useState('PolicyCenter')
  const [codeType, setCodeType] = useState(CODE_TYPES[0])
  const [profiles, setProfiles] = useState(['standards', 'performance', 'upgrade'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [filter, setFilter] = useState('all')
  const reqCost = useRequestCost()

  function toggleProfile(id) {
    setProfiles((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  async function run() {
    setBusy(true); setError(''); setResult(null); reqCost.reset()
    try {
      const numbered = code.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')
      const prompt = `Product: ${product}
Code type: ${codeType}
Review profiles selected: ${profiles.map((id) => PROFILES.find((p) => p.id === id).label).join(', ')}

Code to review (line-numbered):
${numbered}`
      const text = await callClaude({ system: CODE_REVIEW_SYSTEM, prompt, maxTokens: 16000, onUsage: reqCost.onUsage })
      setResult(parseModelJson(text))
      setFilter('all')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const findings = useMemo(() => {
    if (!result) return []
    return filter === 'all' ? result.findings : result.findings.filter((f) => f.severity === filter)
  }, [result, filter])

  return (
    <div>
      <header className="page-head">
        <div className="page-eyebrow">Build · Module 2 of 4</div>
        <h1 className="page-title">Code Review Copilot</h1>
        <p className="page-desc">
          Principal-level review of Gosu, PCF, integration and batch code against Guidewire Cloud standards.
          Findings come back severity-tagged with concrete fixes and upgrade-safety flags.
        </p>
      </header>

      <div className="panel">
        <div className="row">
          <div className="field">
            <label htmlFor="cr-product">Product</label>
            <select id="cr-product" value={product} onChange={(e) => setProduct(e.target.value)}>
              {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cr-type">Code type</label>
            <select id="cr-type" value={codeType} onChange={(e) => setCodeType(e.target.value)}>
              {CODE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Review profiles</label>
          <div className="chips">
            {PROFILES.map((p) => (
              <button key={p.id} className={`chip ${profiles.includes(p.id) ? 'on' : ''}`} onClick={() => toggleProfile(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="cr-code">Code under review</label>
          <textarea
            id="cr-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={'Paste a Gosu class, enhancement, PCF snippet, plugin or batch process…\n\nuses gw.api.database.Query\n\nclass PolicyHoldFinder {\n  function findHolds(periods : List<PolicyPeriod>) {\n    for (p in periods) {\n      var q = Query.make(UWIssue).compare("PolicyPeriod", Equals, p).select()\n      ...'}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || !code.trim() || profiles.length === 0}>
          {busy ? <><span className="spinner" />Reviewing…</> : 'Run review'}
        </button>
      </div>

      {error && <div className="alert err">{error}</div>}

      {result && (
        <>
          <div className="scorecard">
            <div className="score-tile accent">
              <div className="k">Code health</div>
              <div className="v">{result.summary.score}/100</div>
            </div>
            <div className="score-tile"><div className="k">Critical</div><div className="v" style={{ color: 'var(--crit)' }}>{result.summary.criticalCount}</div></div>
            <div className="score-tile"><div className="k">Major</div><div className="v" style={{ color: 'var(--warn)' }}>{result.summary.majorCount}</div></div>
            <div className="score-tile"><div className="k">Minor</div><div className="v">{result.summary.minorCount}</div></div>
            <div className="score-tile"><div className="k">Info</div><div className="v">{result.summary.infoCount}</div></div>
          </div>

          <div className="panel">
            <h3>Verdict</h3>
            <p>{result.summary.verdict}</p>
            {result.quickWins?.length > 0 && (
              <>
                <h3 style={{ marginTop: 16 }}>Quick wins</h3>
                <ul className="plain">{result.quickWins.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </>
            )}
            <div style={{ marginTop: 14 }}>
              <SaveToProject
                project={project}
                module="code-review"
                title={`Code review · ${product} · ${new Date().toLocaleDateString()}`}
                content={result}
              />
            </div>
            <RequestCost totals={reqCost.totals} />
          </div>

          <div className="chips" style={{ marginBottom: 14 }}>
            <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All ({result.findings.length})</button>
            {SEVERITIES.map((s) => (
              <button key={s} className={`chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>
                {s} ({result.findings.filter((f) => f.severity === s).length})
              </button>
            ))}
          </div>

          {findings.map((f, i) => (
            <article key={i} className={`finding ${f.severity}`}>
              <div className="finding-head">
                <span className={`sev ${f.severity}`}>{f.severity}</span>
                <span className="cat">{f.category}</span>
                <span className="loc">{f.location}</span>
              </div>
              <p>{f.issue}</p>
              <p className="rec"><b>Fix:</b> {f.recommendation}</p>
              {f.standardRef && <p className="ref">{f.standardRef}</p>}
            </article>
          ))}
        </>
      )}
    </div>
  )
}

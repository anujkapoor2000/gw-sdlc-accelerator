import React, { useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
import { RELEASE_NAVIGATOR_SYSTEM } from '../lib/prompts.js'
import SaveToProject from '../components/SaveToProject.jsx'
import { useRequestCost, RequestCost } from '../components/RequestCost.jsx'

const RELEASES = ['Innsbruck', 'Hakuba', 'Garmisch', 'Las Leñas', 'Palisades', 'Next (unannounced)']
const PRODUCTS = ['PolicyCenter', 'ClaimCenter', 'BillingCenter']

const CHECKLIST = [
  { group: 'Source control & branching', items: ['Trunk-based or short-lived branches', 'Protected main with mandatory PR review', 'GW config and code in same repo discipline'] },
  { group: 'Continuous integration', items: ['Build on every commit (TeamCity/GitHub Actions/Jenkins)', 'Static analysis in pipeline (Gosu rules / lint)', 'Artifact versioning aligned to GW releases'] },
  { group: 'Automated testing', items: ['GUnit suite runs in CI', 'GT-API coverage for critical integrations', 'Smoke pack runs post-deploy per environment'] },
  { group: 'Environments & release', items: ['Defined path: dev → int → UAT → preprod → prod', 'Guidewire Cloud Console deployments scripted/repeatable', 'Rollback procedure tested in the last 6 months'] }
]

export default function ReleaseNavigator({ project }) {
  const [checks, setChecks] = useState({})
  const [release, setRelease] = useState('Palisades')
  const [products, setProducts] = useState(['PolicyCenter'])
  const [inventory, setInventory] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const reqCost = useRequestCost()

  const total = CHECKLIST.reduce((n, g) => n + g.items.length, 0)
  const done = Object.values(checks).filter(Boolean).length
  const pct = Math.round((done / total) * 100)

  function toggleProduct(p) {
    setProducts((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]))
  }

  async function run() {
    setBusy(true); setError(''); setResult(null); reqCost.reset()
    try {
      const prompt = `Target release: ${release}
Products in scope: ${products.join(', ')}
CI/CD readiness self-assessment: ${pct}% (${done}/${total} practices in place)

Customisation inventory:
${inventory}`
      const text = await callClaude({ system: RELEASE_NAVIGATOR_SYSTEM, prompt, maxTokens: 16000, onUsage: reqCost.onUsage })
      setResult(parseModelJson(text))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const riskTag = { low: 'green', medium: 'amber', high: 'red' }

  return (
    <div>
      <header className="page-head">
        <div className="page-eyebrow">Release · Module 4 of 4</div>
        <h1 className="page-title">Release Navigator</h1>
        <p className="page-desc">
          Two lenses on release readiness: a CI/CD maturity self-check, and AI impact analysis of your
          customisation inventory against the next Guidewire Cloud platform release.
        </p>
      </header>

      <div className="panel">
        <h3>CI/CD readiness — {pct}% ({done}/{total})</h3>
        {CHECKLIST.map((g) => (
          <div key={g.group} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>{g.group}</div>
            {g.items.map((item) => {
              const key = `${g.group}:${item}`
              return (
                <label key={key} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!checks[key]}
                    onChange={() => setChecks((c) => ({ ...c, [key]: !c[key] }))}
                  />
                  {item}
                </label>
              )
            })}
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Upgrade impact analysis</h3>
        <div className="row">
          <div className="field">
            <label htmlFor="rn-release">Target release</label>
            <select id="rn-release" value={release} onChange={(e) => setRelease(e.target.value)}>
              {RELEASES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Products in scope</label>
            <div className="chips">
              {PRODUCTS.map((p) => (
                <button key={p} className={`chip ${products.includes(p) ? 'on' : ''}`} onClick={() => toggleProduct(p)}>{p}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="rn-inv">Customisation inventory</label>
          <textarea
            id="rn-inv"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            placeholder={'List what this implementation has customised, one area per line…\n\n- 14 entity extensions on PolicyPeriod / Account\n- Custom rating worksheet integration (SOAP, legacy)\n- 6 Gosu plugins incl. IPolicyNumGenPlugin\n- Jutro producer portal with custom components\n- 3 batch processes for bordereaux extracts'}
            style={{ minHeight: 140 }}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || !inventory.trim() || products.length === 0}>
          {busy ? <><span className="spinner" />Analysing…</> : 'Analyse upgrade impact'}
        </button>
      </div>

      {error && <div className="alert err">{error}</div>}

      {result && (
        <>
          <div className="panel">
            <div className="finding-head" style={{ marginBottom: 8 }}>
              <span className={`tag ${riskTag[result.overallRisk] || ''}`}>Overall risk: {result.overallRisk}</span>
              <span className="tag">{result.estimatedEffortBand}</span>
            </div>
            <p>{result.headline}</p>
            <div style={{ marginTop: 12 }}>
              <SaveToProject
                project={project}
                module="release-navigator"
                title={`${release} impact · ${products.join('/')}`}
                content={{ readinessPct: pct, ...result }}
              />
            </div>
            <RequestCost totals={reqCost.totals} />
          </div>

          {result.items?.map((it, i) => (
            <article key={i} className="impact-card">
              <h4>{it.area} <span className={`tag ${riskTag[it.impact] || ''}`}>{it.impact} impact</span></h4>
              <p style={{ fontSize: 14, marginBottom: 6 }}>{it.rationale}</p>
              <p style={{ fontSize: 14 }}><b>Action:</b> {it.action}</p>
              <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 4 }}><b>Test focus:</b> {it.testFocus}</p>
            </article>
          ))}

          {result.preUpgradeChecklist?.length > 0 && (
            <div className="panel">
              <h3>Pre-upgrade checklist</h3>
              <ul className="plain">{result.preUpgradeChecklist.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import React, { useMemo, useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
import {
  TEST_MIGRATOR_SPLIT_SYSTEM,
  TEST_MIGRATOR_CASE_SYSTEM,
  TEST_MIGRATOR_SYNTH_SYSTEM
} from '../lib/prompts.js'
import SaveToProject from '../components/SaveToProject.jsx'

const FRAMEWORKS = [
  'Katalon (Groovy, keyword-driven)',
  'Guidewire Test (GT — GT-UI / GT-API)',
  'Playwright (TypeScript)',
  'Selenium + Java (TestNG)',
  'Cucumber BDD (Gherkin + Java steps)'
]
const PRODUCTS = ['PolicyCenter', 'ClaimCenter', 'BillingCenter', 'Jutro', 'Cross-suite']

const VERDICT_TAG = { 'automate': 'green', 'automate-with-fixes': 'amber', 'keep-manual': 'red' }
const VERDICT_LABEL = { 'automate': 'Automate', 'automate-with-fixes': 'Automate (after fixes)', 'keep-manual': 'Keep manual' }
const SEV_TAG = { high: 'red', medium: 'amber', low: '' }
const STRATEGY_TAG = { generate: 'green', stage: 'amber', 'existing-record': 'violet' }

const SAMPLE = `Test Case: TC-PC-014 — New Personal Auto policy bind
Preconditions: Underwriter logged into PolicyCenter
Steps:
1. Create a new account for a personal customer
2. Start a Personal Auto submission
3. Add a vehicle and a driver
4. Quote the submission
5. Bind the policy
Expected: Policy is issued and a policy number is shown

Test Case: TC-PC-021 — Verify premium looks reasonable
Steps:
1. Open an existing auto policy
2. Look at the premium on the summary screen
Expected: Premium seems about right for the coverage`

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn btn-ghost"
      style={{ padding: '4px 10px', fontSize: 12.5 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch { /* clipboard blocked — no-op */ }
      }}
    >
      {done ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

export default function TestMigrator({ project }) {
  const [framework, setFramework] = useState(FRAMEWORKS[0])
  const [product, setProduct] = useState(PRODUCTS[0])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [cases, setCases] = useState([])      // filled progressively, one per case
  const [summary, setSummary] = useState(null) // suite-level synthesis
  const [verdictFilter, setVerdictFilter] = useState('all')

  async function run() {
    setBusy(true); setError(''); setCases([]); setSummary(null); setVerdictFilter('all')
    try {
      // Step 1 — split the paste into individual cases (small, fast).
      setProgress('Reading and splitting test cases…')
      let split
      try {
        const splitText = await callClaude({
          system: TEST_MIGRATOR_SPLIT_SYSTEM,
          prompt: `Raw manual test case(s) pasted by the client:\n${input}`,
          maxTokens: 3000
        })
        split = parseModelJson(splitText)
      } catch {
        split = null
      }
      let list = Array.isArray(split?.cases) && split.cases.length
        ? split.cases
        : [{ id: 'MTC-1', title: 'Manual test case', raw: input }]

      // Step 2 — convert each case in its own request (keeps every call small).
      const collected = []
      for (let i = 0; i < list.length; i++) {
        const c = list[i]
        setProgress(`Converting case ${i + 1} of ${list.length}${c.title ? ` — ${c.title}` : ''}…`)
        const caseText = await callClaude({
          system: TEST_MIGRATOR_CASE_SYSTEM,
          prompt: `Target automation framework: ${framework}
Primary product: ${product}
Case id to use: ${c.id || `MTC-${i + 1}`}

Manual test case:
${c.raw || c.title}`,
          maxTokens: 5000
        })
        const parsed = parseModelJson(caseText)
        collected.push(parsed)
        setCases((prev) => [...prev, parsed]) // render as each one lands
      }

      // Step 3 — synthesise the suite-level read from a compact digest.
      setProgress('Summarising the migration…')
      const counts = {
        automate: collected.filter((c) => c.verdict === 'automate').length,
        automateWithFixes: collected.filter((c) => c.verdict === 'automate-with-fixes').length,
        keepManual: collected.filter((c) => c.verdict === 'keep-manual').length
      }
      let synth = {}
      try {
        const digest = collected.map((c) => ({
          id: c.id, title: c.sourceTitle, product: c.product,
          verdict: c.verdict, gapTypes: (c.gaps || []).map((g) => g.type)
        }))
        const synthText = await callClaude({
          system: TEST_MIGRATOR_SYNTH_SYSTEM,
          prompt: `Target automation framework: ${framework}

Per-case digest:
${JSON.stringify(digest, null, 2)}`,
          maxTokens: 2000
        })
        synth = parseModelJson(synthText)
      } catch {
        synth = {}
      }

      setSummary({
        casesAnalysed: collected.length,
        ...counts,
        automationReadiness: synth.automationReadiness ?? null,
        headline: synth.headline || '',
        crossCuttingGaps: synth.crossCuttingGaps || [],
        recommendations: synth.recommendations || []
      })
    } catch (e) {
      setError(e.message || 'Conversion failed')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const verdicts = useMemo(() => [...new Set(cases.map((c) => c.verdict))], [cases])
  const shown = useMemo(
    () => (verdictFilter === 'all' ? cases : cases.filter((c) => c.verdict === verdictFilter)),
    [cases, verdictFilter]
  )

  const saveContent = summary
    ? {
        summary: {
          casesAnalysed: summary.casesAnalysed,
          automate: summary.automate,
          automateWithFixes: summary.automateWithFixes,
          keepManual: summary.keepManual,
          automationReadiness: summary.automationReadiness,
          headline: summary.headline
        },
        cases,
        crossCuttingGaps: summary.crossCuttingGaps,
        recommendations: summary.recommendations
      }
    : null

  return (
    <div>
      <header className="page-head">
        <div className="page-eyebrow">Test · Manual → Automation</div>
        <h1 className="page-title">Test Migrator</h1>
        <p className="page-desc">
          Feed in your existing manual Guidewire test cases and get runnable automation back — Katalon,
          Guidewire GT, Playwright, Selenium or Cucumber. Every case is checked for gaps that would block
          or destabilise automation, and the exact test data each script needs is called out before you run it.
        </p>
      </header>

      <div className="panel">
        <div className="field">
          <label htmlFor="tm-framework">Target automation framework</label>
          <select id="tm-framework" value={framework} onChange={(e) => setFramework(e.target.value)}>
            {FRAMEWORKS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tm-product">Primary product</label>
          <select id="tm-product" value={product} onChange={(e) => setProduct(e.target.value)}>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tm-input">
            Manual test case(s)
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 10 }}
              onClick={() => setInput(SAMPLE)}
            >
              Load sample
            </button>
          </label>
          <textarea
            id="tm-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ minHeight: 200 }}
            placeholder={'Paste manual test cases as you have them — numbered steps, expected results, multiple cases at once. Copy straight from Excel, ALM, Zephyr or qTest.'}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || !input.trim()}>
          {busy ? <><span className="spinner" />{progress || 'Converting…'}</> : 'Convert to automation'}
        </button>
        {busy && cases.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 8 }}>
            {cases.length} case{cases.length === 1 ? '' : 's'} converted so far…
          </p>
        )}
      </div>

      {error && <div className="alert err">{error}</div>}

      {summary && (
        <div className="panel">
          <h3>Migration summary</h3>
          {summary.headline && <p>{summary.headline}</p>}
          <div className="stat-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
            <Stat value={summary.casesAnalysed} label="cases analysed" />
            <Stat value={summary.automate} label="automate" tone="green" />
            <Stat value={summary.automateWithFixes} label="automate after fixes" tone="amber" />
            <Stat value={summary.keepManual} label="keep manual" tone="red" />
            {summary.automationReadiness != null && (
              <Stat value={`${summary.automationReadiness}%`} label="suite readiness" />
            )}
          </div>
          <div style={{ marginTop: 14 }}>
            <SaveToProject
              project={project}
              module="test-migrator"
              title={`Migration · ${framework.split(' ')[0]} · ${new Date().toLocaleDateString()}`}
              content={saveContent}
            />
          </div>
        </div>
      )}

      {verdicts.length > 1 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className={`chip ${verdictFilter === 'all' ? 'on' : ''}`} onClick={() => setVerdictFilter('all')}>
            All ({cases.length})
          </button>
          {verdicts.map((v) => (
            <button key={v} className={`chip ${verdictFilter === v ? 'on' : ''}`} onClick={() => setVerdictFilter(v)}>
              {VERDICT_LABEL[v] || v} ({cases.filter((c) => c.verdict === v).length})
            </button>
          ))}
        </div>
      )}

      {shown.map((c) => (
        <article key={c.id} className="test-card">
          <h4>{c.id} — {c.sourceTitle}</h4>
          <div style={{ marginBottom: 10 }}>
            <span className={`tag ${VERDICT_TAG[c.verdict] || ''}`}>{VERDICT_LABEL[c.verdict] || c.verdict}</span>
            {c.product && <span className="tag">{c.product}</span>}
            {c.flow && <span className="tag">{c.flow}</span>}
            {c.priority && <span className="tag">{c.priority}</span>}
          </div>
          {c.verdictRationale && (
            <p style={{ fontSize: 13.5, color: 'var(--slate)', marginBottom: 12 }}>{c.verdictRationale}</p>
          )}

          {c.gaps?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <h5 style={{ margin: '0 0 6px' }}>Gaps in the manual test ({c.gaps.length})</h5>
              {c.gaps.map((g, i) => (
                <div key={i} className="gap-row" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ marginBottom: 3 }}>
                    <span className={`tag ${SEV_TAG[g.severity] || ''}`}>{g.severity}</span>
                    <span className="tag">{g.type}</span>
                    {g.step && g.step !== '-' && <span className="tag amber">at: {g.step}</span>}
                  </div>
                  <p style={{ fontSize: 13.5, margin: '2px 0' }}>{g.detail}</p>
                  {g.remediation && (
                    <p style={{ fontSize: 13, color: 'var(--slate)', margin: '2px 0' }}>
                      <b>Fix:</b> {g.remediation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {c.testData?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <h5 style={{ margin: '0 0 6px' }}>Test data required ({c.testData.length})</h5>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--slate)' }}>
                      <th style={{ padding: '4px 8px' }}>Item</th>
                      <th style={{ padding: '4px 8px' }}>Example</th>
                      <th style={{ padding: '4px 8px' }}>Strategy</th>
                      <th style={{ padding: '4px 8px' }}>Constraint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.testData.map((d, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '4px 8px' }}><b>{d.item}</b></td>
                        <td style={{ padding: '4px 8px', fontFamily: 'var(--mono, monospace)' }}>{d.example}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <span className={`tag ${STRATEGY_TAG[d.strategy] || ''}`}>{d.strategy}</span>
                        </td>
                        <td style={{ padding: '4px 8px', color: 'var(--slate)' }}>{d.constraint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {c.automatedScript?.files?.map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h5 style={{ margin: '8px 0 4px' }}>
                  {f.filename} <span className="tag">{f.language}</span>
                </h5>
                <CopyButton text={f.content || ''} />
              </div>
              <pre className="code-block"><code>{f.content}</code></pre>
            </div>
          ))}

          {c.automatedScript?.keywordAdditions?.filter((k) => k.method && k.method !== '-').length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <h5 style={{ margin: '8px 0 4px' }}>New keyword methods to add</h5>
              {c.automatedScript.keywordAdditions
                .filter((k) => k.method && k.method !== '-')
                .map((k, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="tag">{k.library}</span>
                      <CopyButton text={k.method || ''} />
                    </div>
                    <pre className="code-block"><code>{k.method}</code></pre>
                  </div>
                ))}
            </div>
          )}

          {c.automatedScript?.assertions?.length > 0 && (
            <div>
              <h5 style={{ margin: '8px 0 4px' }}>Automated assertions</h5>
              <ul className="plain">{c.automatedScript.assertions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
        </article>
      ))}

      {summary?.crossCuttingGaps?.length > 0 && (
        <div className="panel">
          <h3>Cross-cutting gaps</h3>
          <ul className="plain">{summary.crossCuttingGaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
      )}

      {summary?.recommendations?.length > 0 && (
        <div className="panel">
          <h3>Recommended next steps</h3>
          <ol style={{ paddingLeft: 20, fontSize: 14 }}>
            {summary.recommendations.map((r, i) => <li key={i} style={{ padding: '2px 0' }}>{r}</li>)}
          </ol>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, tone }) {
  const color = tone === 'green' ? 'var(--ok, #16a34a)'
    : tone === 'amber' ? 'var(--warn, #d97706)'
    : tone === 'red' ? 'var(--crit, #dc2626)'
    : 'var(--ink)'
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>{label}</div>
    </div>
  )
}

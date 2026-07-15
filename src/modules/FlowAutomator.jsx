import React, { useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
import { FLOW_AUTOMATOR_SYSTEM } from '../lib/prompts.js'
import { withKatalonReference } from '../lib/referenceMaterial.js'
import SaveToProject from '../components/SaveToProject.jsx'
import { useRequestCost, RequestCost } from '../components/RequestCost.jsx'

const PRODUCTS = ['PolicyCenter', 'ClaimCenter', 'BillingCenter', 'Jutro']

// Suggested flows per product — the common journeys the Katalon accelerator ships.
const FLOWS = {
  PolicyCenter: [
    'New Personal Auto submission → quote → bind',
    'Mid-term policy change (add vehicle)',
    'Policy cancellation',
    'Policy renewal quote'
  ],
  ClaimCenter: [
    'FNOL → new auto claim',
    'Set reserve + issue payment',
    'Assign + close claim'
  ],
  BillingCenter: [
    'Take a direct-bill payment',
    'Review invoices',
    'Producer setup + disbursement'
  ],
  Jutro: [
    'Digital quote-and-buy (end to end)',
    'Self-service FNOL from the portal',
    'View my policy / account portal'
  ]
}

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

export default function FlowAutomator({ project }) {
  const [product, setProduct] = useState(PRODUCTS[0])
  const [flow, setFlow] = useState(FLOWS[PRODUCTS[0]][0])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const reqCost = useRequestCost()

  function onProduct(p) {
    setProduct(p)
    setFlow(FLOWS[p][0])
  }

  async function run() {
    setBusy(true); setError(''); setResult(null); reqCost.reset()
    try {
      const prompt = `Target product: ${product}
Flow to automate: ${flow}

Flow notes (optional — screen names, fields, seed data):
${notes || '(none provided — use sensible OOTB defaults for this flow)'}`
      const text = await callClaude({
        system: withKatalonReference(FLOW_AUTOMATOR_SYSTEM, product),
        prompt,
        maxTokens: 16000,
        cacheSystem: true,
        onUsage: reqCost.onUsage
      })
      setResult(parseModelJson(text))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-head">
        <div className="page-eyebrow">Test · Katalon accelerator</div>
        <h1 className="page-title">Flow Automator</h1>
        <p className="page-desc">
          Scaffolds keyword-driven Katalon Studio automation for common Guidewire flows across
          PolicyCenter, ClaimCenter, BillingCenter and Jutro — in the same style as the ready-to-run
          project shipped in <code>/katalon</code>.
        </p>
      </header>

      <div className="panel">
        <div className="field">
          <label htmlFor="fa-product">Product</label>
          <select id="fa-product" value={product} onChange={(e) => onProduct(e.target.value)}>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fa-flow">Flow</label>
          <select id="fa-flow" value={flow} onChange={(e) => setFlow(e.target.value)}>
            {FLOWS[product].map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fa-notes">Flow notes <span style={{ color: 'var(--slate)' }}>(optional)</span></label>
          <textarea
            id="fa-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={'Screen names, fields to set, seed data, customised widget ids… anything that makes the script fit your environment.'}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? <><span className="spinner" />Generating Katalon script…</> : 'Generate Katalon automation'}
        </button>
      </div>

      {error && <div className="alert err">{error}</div>}

      {result && (
        <>
          <div className="panel">
            <h3>{result.flowName} <span className="tag violet">{result.product}</span></h3>
            <p>{result.summary}</p>

            {result.prerequisites?.length > 0 && (
              <>
                <h3 style={{ marginTop: 14 }}>Prerequisites</h3>
                <ul className="plain">{result.prerequisites.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </>
            )}
            {result.testData?.length > 0 && (
              <>
                <h3 style={{ marginTop: 14 }}>Test data</h3>
                <ul className="plain">{result.testData.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <SaveToProject
                project={project}
                module="flow-automator"
                title={`Katalon · ${result.product} · ${result.flowName}`}
                content={result}
              />
            </div>
            <RequestCost totals={reqCost.totals} />
          </div>

          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3>Katalon test case (Groovy)</h3>
              <CopyButton text={result.testCaseScript || ''} />
            </div>
            <pre className="code-block"><code>{result.testCaseScript}</code></pre>
          </div>

          {result.keywordAdditions?.length > 0 && (
            <div className="panel">
              <h3>New keyword methods to add</h3>
              {result.keywordAdditions.map((k, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="tag">{k.library}</span>
                    <CopyButton text={k.method || ''} />
                  </div>
                  <pre className="code-block"><code>{k.method}</code></pre>
                </div>
              ))}
            </div>
          )}

          {result.steps?.length > 0 && (
            <div className="panel">
              <h3>Flow steps</h3>
              <ol style={{ paddingLeft: 20, fontSize: 14 }}>
                {result.steps.map((s, i) => <li key={i} style={{ padding: '2px 0' }}>{s}</li>)}
              </ol>
            </div>
          )}

          {result.assertions?.length > 0 && (
            <div className="panel">
              <h3>Assertions</h3>
              <ul className="plain">{result.assertions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}

          {result.notes?.length > 0 && (
            <div className="panel">
              <h3>Adaptation notes</h3>
              <ul className="plain">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

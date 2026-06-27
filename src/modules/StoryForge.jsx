import React, { useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
import { STORY_FORGE_SYSTEM } from '../lib/prompts.js'
import SaveToProject from '../components/SaveToProject.jsx'
import { useRequestCost, RequestCost } from '../components/RequestCost.jsx'

const PRODUCTS = ['PolicyCenter', 'ClaimCenter', 'BillingCenter', 'Cross-suite']

export default function StoryForge({ project }) {
  const [requirements, setRequirements] = useState('')
  const [product, setProduct] = useState('PolicyCenter')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const reqCost = useRequestCost()

  async function run() {
    setBusy(true); setError(''); setResult(null); reqCost.reset()
    try {
      const prompt = `Primary product: ${product}

Raw requirements from the business:
${requirements}`
      const text = await callClaude({ system: STORY_FORGE_SYSTEM, prompt, maxTokens: 7000, onUsage: reqCost.onUsage })
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
        <div className="page-eyebrow">Plan · Module 1 of 4</div>
        <h1 className="page-title">Story Forge</h1>
        <p className="page-desc">
          Turns raw business requirements into sprint-ready user stories — Gherkin acceptance criteria,
          Guidewire touchpoints mapped, Fibonacci points justified, dependencies made explicit.
        </p>
      </header>

      <div className="panel">
        <div className="field">
          <label htmlFor="sf-product">Primary product</label>
          <select id="sf-product" value={product} onChange={(e) => setProduct(e.target.value)}>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sf-req">Business requirements</label>
          <textarea
            id="sf-req"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder={'Paste requirement text from the BRD, workshop notes or an email…\n\nExample: Underwriters need to place a hold on any personal auto submission where the named insured has had 2+ at-fault accidents in 36 months. The hold must block quote release, notify the UW supervisor, and be releasable only by users with UW authority level 3+.'}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || !requirements.trim()}>
          {busy ? <><span className="spinner" />Forging stories…</> : 'Generate stories'}
        </button>
      </div>

      {error && <div className="alert err">{error}</div>}

      {result && (
        <>
          <div className="panel">
            <h3>Epic: {result.epic}</h3>
            {result.assumptions?.length > 0 && (
              <>
                <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--slate)', margin: '8px 0 4px' }}>Assumptions made</p>
                <ul className="plain">{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <SaveToProject
                project={project}
                module="story-forge"
                title={`Stories · ${result.epic}`}
                content={result}
              />
            </div>
            <RequestCost totals={reqCost.totals} />
          </div>

          {result.stories?.map((s) => (
            <article key={s.id} className="story-card">
              <h4>{s.id} — {s.title}</h4>
              <div style={{ marginBottom: 8 }}>
                <span className="tag">{s.product}</span>
                <span className="tag green">{s.points} pts</span>
                {s.dependsOn?.filter((d) => d !== '-').map((d) => <span key={d} className="tag amber">depends: {d}</span>)}
              </div>
              <p style={{ fontSize: 14, marginBottom: 8 }}>
                As a <b>{s.asA}</b>, I want <b>{s.iWant}</b>, so that <b>{s.soThat}</b>.
              </p>
              {s.acceptanceCriteria?.map((ac, i) => <div key={i} className="gherkin">{ac}</div>)}
              <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 8 }}>
                <b>GW touchpoints:</b> {s.gwTouchpoints?.join(' · ')}
              </p>
              <p style={{ fontSize: 13, color: 'var(--slate)' }}><b>Points rationale:</b> {s.pointsRationale}</p>
            </article>
          ))}

          {result.openQuestions?.length > 0 && (
            <div className="panel">
              <h3>Open questions for the BA</h3>
              <ul className="plain">{result.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

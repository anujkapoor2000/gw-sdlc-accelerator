import React, { useMemo, useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
import { TEST_STRATEGIST_SYSTEM } from '../lib/prompts.js'
import { ragCallOptions } from '../lib/rag.js'
import SaveToProject from '../components/SaveToProject.jsx'
import { useRequestCost, RequestCost } from '../components/RequestCost.jsx'

const INPUT_KINDS = ['User story + acceptance criteria', 'Gosu / integration code', 'Defect description']
const TYPE_TAG = { 'GUnit': 'green', 'GT-API': '', 'GT-UI': 'amber', 'Manual': 'red' }

export default function TestStrategist({ project }) {
  const [kind, setKind] = useState(INPUT_KINDS[0])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const reqCost = useRequestCost()

  async function run() {
    setBusy(true); setError(''); setResult(null); reqCost.reset()
    try {
      const prompt = `Input kind: ${kind}

Material to derive tests from:
${input}`
      const text = await callClaude({
        system: TEST_STRATEGIST_SYSTEM,
        prompt,
        maxTokens: 16000,
        onUsage: reqCost.onUsage,
        ...ragCallOptions(project, 'test-strategist', `${kind}\n${input}`)
      })
      setResult(parseModelJson(text))
      setTypeFilter('all')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const types = useMemo(() => {
    if (!result) return []
    return [...new Set(result.testCases.map((t) => t.type))]
  }, [result])

  const cases = useMemo(() => {
    if (!result) return []
    return typeFilter === 'all' ? result.testCases : result.testCases.filter((t) => t.type === typeFilter)
  }, [result, typeFilter])

  return (
    <div>
      <header className="page-head">
        <div className="page-eyebrow">Test · Module 3 of 4</div>
        <h1 className="page-title">Test Strategist</h1>
        <p className="page-desc">
          Derives executable test coverage from stories, code or defects — pyramid-balanced across
          GUnit, GT-API and GT-UI, with the test data each case needs called out up front.
        </p>
      </header>

      <div className="panel">
        <div className="field">
          <label htmlFor="ts-kind">What are you testing from?</label>
          <select id="ts-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {INPUT_KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ts-input">Story, code or defect</label>
          <textarea
            id="ts-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Paste the story with its acceptance criteria, the code under test, or the defect write-up…'}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || !input.trim()}>
          {busy ? <><span className="spinner" />Designing coverage…</> : 'Generate test cases'}
        </button>
      </div>

      {error && <div className="alert err">{error}</div>}

      {result && (
        <>
          <div className="panel">
            <h3>Coverage strategy</h3>
            <p>{result.strategySummary}</p>
            {result.testData?.length > 0 && (
              <>
                <h3 style={{ marginTop: 14 }}>Test data to stage</h3>
                <ul className="plain">{result.testData.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <SaveToProject
                project={project}
                module="test-strategist"
                title={`Test pack · ${new Date().toLocaleDateString()}`}
                content={result}
              />
            </div>
            <RequestCost totals={reqCost.totals} />
          </div>

          <div className="chips" style={{ marginBottom: 14 }}>
            <button className={`chip ${typeFilter === 'all' ? 'on' : ''}`} onClick={() => setTypeFilter('all')}>
              All ({result.testCases.length})
            </button>
            {types.map((t) => (
              <button key={t} className={`chip ${typeFilter === t ? 'on' : ''}`} onClick={() => setTypeFilter(t)}>
                {t} ({result.testCases.filter((x) => x.type === t).length})
              </button>
            ))}
          </div>

          {cases.map((t) => (
            <article key={t.id} className="test-card">
              <h4>{t.id} — {t.title}</h4>
              <div style={{ marginBottom: 8 }}>
                <span className={`tag ${TYPE_TAG[t.type] || ''}`}>{t.type}</span>
                <span className="tag">{t.priority}</span>
                {t.coversAC && <span className="tag amber">covers: {t.coversAC}</span>}
              </div>
              {t.preconditions?.length > 0 && (
                <p style={{ fontSize: 13.5, color: 'var(--slate)', marginBottom: 6 }}>
                  <b>Preconditions:</b> {t.preconditions.join('; ')}
                </p>
              )}
              <ol style={{ paddingLeft: 20, fontSize: 14, marginBottom: 6 }}>
                {t.steps?.map((s, i) => <li key={i} style={{ padding: '2px 0' }}>{s}</li>)}
              </ol>
              <p style={{ fontSize: 14 }}><b>Expected:</b> {t.expected}</p>
            </article>
          ))}

          {result.automationNotes?.length > 0 && (
            <div className="panel">
              <h3>Automation notes</h3>
              <ul className="plain">{result.automationNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

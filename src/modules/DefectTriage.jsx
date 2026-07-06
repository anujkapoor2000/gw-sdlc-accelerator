import React, { useMemo, useRef, useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
import { queryDatadogLogs, rangeToIso, TIME_RANGES } from '../lib/datadog.js'
import {
  buildDefectReportFromError,
  buildEvidenceForError,
  buildLogDashboard,
  filterAnalysisByService,
  loadDatadogLogFile
} from '../lib/logLoader.js'
import LogErrorDashboard from '../components/LogErrorDashboard.jsx'
import {
  TRIAGE_INTAKE_SYSTEM,
  TRIAGE_INVESTIGATOR_SYSTEM,
  TRIAGE_ROUTER_SYSTEM,
  TRIAGE_PLANNER_SYSTEM
} from '../lib/prompts.js'
import SaveToProject from '../components/SaveToProject.jsx'
import { useRequestCost, RequestCost } from '../components/RequestCost.jsx'

const PRODUCTS = ['PolicyCenter', 'ClaimCenter', 'BillingCenter', 'Cross-suite', 'Unknown']
const ENVIRONMENTS = ['Production', 'Pre-prod', 'UAT', 'SIT', 'Dev']
const MAX_LOOPS = 2
const BULK_MAX_ERRORS = 5
const PRIORITY_TAG = { P1: 'red', P2: 'amber', P3: '', P4: 'green' }

const AGENTS = {
  intake: { name: 'Intake Agent', role: 'Structures the raw report into a case file' },
  investigator: { name: 'Investigator Agent', role: 'Forms ranked root-cause hypotheses with confidence' },
  router: { name: 'Router Agent', role: 'Routes the case — or sends it back for a deeper pass' },
  planner: { name: 'Fix Planner Agent', role: 'Produces workaround, fix plan and regression coverage' }
}

export default function DefectTriage({ project }) {
  const [defect, setDefect] = useState('')
  const [evidence, setEvidence] = useState('')
  const [product, setProduct] = useState('PolicyCenter')
  const [env, setEnv] = useState('Production')
  const [steps, setSteps] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [finalCase, setFinalCase] = useState(null)
  const [logAnalysis, setLogAnalysis] = useState(null)
  const [selectedErrorId, setSelectedErrorId] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState('')
  const [logSource, setLogSource] = useState('paste')
  const [ddQuery, setDdQuery] = useState('status:error')
  const [ddTimeRange, setDdTimeRange] = useState('1h')
  const [ddService, setDdService] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [bulkResults, setBulkResults] = useState([])
  const [bulkProgress, setBulkProgress] = useState('')
  const fileInputRef = useRef(null)
  const runId = useRef(0)
  const reqCost = useRequestCost()

  const visibleErrors = useMemo(() => {
    if (!logAnalysis) return []
    return filterAnalysisByService(logAnalysis, serviceFilter).errors
  }, [logAnalysis, serviceFilter])

  const dashboard = useMemo(() => {
    if (!logAnalysis) return null
    return buildLogDashboard(filterAnalysisByService(logAnalysis, serviceFilter))
  }, [logAnalysis, serviceFilter])

  function pushStep(step) {
    setSteps((s) => [...s, step])
  }
  function completeStep(idx, patch) {
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, ...patch } : st)))
  }

  async function runAgent(agentKey, system, prompt, note) {
    const startedAt = Date.now()
    const idx = stepsCountRef.current++
    pushStep({ agent: agentKey, status: 'running', note, startedAt })
    try {
      const text = await callClaude({ system, prompt, maxTokens: 12000, onUsage: reqCost.onUsage })
      const output = parseModelJson(text)
      completeStep(idx, { status: 'done', output, elapsed: ((Date.now() - startedAt) / 1000).toFixed(1) })
      return output
    } catch (e) {
      completeStep(idx, { status: 'error', error: e.message, elapsed: ((Date.now() - startedAt) / 1000).toFixed(1) })
      throw e
    }
  }
  const stepsCountRef = useRef(0)

  function buildBaseContext(defectText, evidenceText, sourceLabel) {
    return `Product: ${product}
Environment: ${env}
${sourceLabel ? `Log source: ${sourceLabel}` : ''}

Defect report:
${defectText}

Supporting material (logs / stack trace / code, may be empty):
${evidenceText || '(none provided)'}`
  }

  async function runPipeline({ defectText, evidenceText, sourceLabel, thisRun }) {
    const baseContext = buildBaseContext(defectText, evidenceText, sourceLabel)

    const intake = await runAgent('intake', TRIAGE_INTAKE_SYSTEM, baseContext,
      'Parsing the report into a structured case file')
    if (thisRun !== runId.current) throw new Error('Cancelled')

    let investigation = null
    let routing = null
    let loopDirective = ''
    for (let pass = 0; pass <= MAX_LOOPS; pass++) {
      investigation = await runAgent(
        'investigator',
        TRIAGE_INVESTIGATOR_SYSTEM,
        `${baseContext}

Intake case file:
${JSON.stringify(intake, null, 2)}
${loopDirective ? `\nFollow-up directive from Router Agent (pass ${pass + 1}):\n${loopDirective}` : ''}`,
        pass === 0
          ? 'Forming root-cause hypotheses'
          : `Deeper pass ${pass + 1} — focusing on the router's directive`
      )
      if (thisRun !== runId.current) throw new Error('Cancelled')

      routing = await runAgent(
        'router',
        TRIAGE_ROUTER_SYSTEM,
        `Loop budget: pass ${pass + 1} of ${MAX_LOOPS + 1}. ${pass === MAX_LOOPS ? 'This is the final pass — you MUST route.' : ''}

Intake case file:
${JSON.stringify(intake, null, 2)}

Investigation result:
${JSON.stringify(investigation, null, 2)}`,
        'Deciding: route the case, or send it back for another pass'
      )
      if (thisRun !== runId.current) throw new Error('Cancelled')

      if (routing.decision !== 'investigate-further' || pass === MAX_LOOPS) break
      loopDirective = routing.loopDirective
      pushStep({ agent: 'loop', status: 'loop', note: routing.loopDirective, startedAt: Date.now() })
      stepsCountRef.current++
    }

    const plan = await runAgent(
      'planner',
      TRIAGE_PLANNER_SYSTEM,
      `Intake case file:
${JSON.stringify(intake, null, 2)}

Lead hypothesis (confidence ${investigation.overallConfidence}%):
${investigation.leadHypothesis}

Routing decision:
${JSON.stringify(routing, null, 2)}`,
      'Producing workaround, permanent fix and regression coverage'
    )
    if (thisRun !== runId.current) throw new Error('Cancelled')

    return { intake, investigation, routing, plan }
  }

  function applyLogAnalysis(analysis) {
    setLogAnalysis(analysis)
    setServiceFilter('all')
    setBulkResults([])
    setBulkProgress('')
    if (analysis.errors.length === 0) return false
    selectError(analysis, analysis.errors[0].id)
    return true
  }

  async function handleLogFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setLogLoading(true)
    setLogError('')
    setLogAnalysis(null)
    setSelectedErrorId('')

    try {
      const analysis = await loadDatadogLogFile(file)
      if (!applyLogAnalysis(analysis)) {
        setLogError(`Loaded "${file.name}" (${analysis.totalEntries} entries) but no errors were detected. You can still paste content into the evidence field manually.`)
      }
    } catch (err) {
      setLogError(err.message)
    } finally {
      setLogLoading(false)
    }
  }

  async function handleDatadogQuery() {
    setLogLoading(true)
    setLogError('')
    setLogAnalysis(null)
    setSelectedErrorId('')

    try {
      const { from, to } = rangeToIso(ddTimeRange)
      const analysis = await queryDatadogLogs({
        query: ddQuery || 'status:error',
        from,
        to,
        service: ddService.trim(),
        limit: 100
      })
      if (!applyLogAnalysis(analysis)) {
        setLogError(`Query returned ${analysis.totalEntries} log entries but no errors were detected. Try broadening the query or time range.`)
      }
    } catch (err) {
      setLogError(err.message)
    } finally {
      setLogLoading(false)
    }
  }

  function selectError(analysis, errorId) {
    const err = analysis.errors.find((e) => e.id === errorId)
    if (!err) return
    setSelectedErrorId(errorId)
    setDefect(buildDefectReportFromError(err, { filename: analysis.filename, product, env }))
    setEvidence(buildEvidenceForError(analysis, errorId))
  }

  async function investigateError(errorId) {
    if (!logAnalysis) return
    const err = logAnalysis.errors.find((e) => e.id === errorId)
    if (!err) {
      setError('Could not find that error in the loaded logs.')
      return
    }
    const defectText = buildDefectReportFromError(err, { filename: logAnalysis.filename, product, env })
    const evidenceText = buildEvidenceForError(logAnalysis, errorId)
    const sourceLabel = `${logAnalysis.filename} (${logAnalysis.format}, ${logAnalysis.errorCount} errors detected)`
    setSelectedErrorId(errorId)
    setDefect(defectText)
    setEvidence(evidenceText)
    await run({ defectText, evidenceText, sourceLabel })
  }

  async function run(opts = {}) {
    const thisRun = ++runId.current
    stepsCountRef.current = 0
    setSteps([])
    setError('')
    setFinalCase(null)
    setBulkResults([])
    setBulkProgress('')

    let defectText = opts.defectText ?? defect
    let evidenceText = opts.evidenceText ?? evidence
    let sourceLabel = opts.sourceLabel ?? (logAnalysis
      ? `${logAnalysis.filename} (${logAnalysis.format}, ${logAnalysis.errorCount} errors detected)`
      : '')

    if (opts.errorId && logAnalysis && !opts.defectText) {
      const err = logAnalysis.errors.find((e) => e.id === opts.errorId)
      if (err) {
        defectText = buildDefectReportFromError(err, { filename: logAnalysis.filename, product, env })
        evidenceText = buildEvidenceForError(logAnalysis, opts.errorId)
        setSelectedErrorId(opts.errorId)
        setDefect(defectText)
        setEvidence(evidenceText)
      }
    }

    if (!defectText.trim()) {
      setError('Add a defect report or select an error from loaded logs.')
      return
    }

    setRunning(true)
    reqCost.reset()

    try {
      const result = await runPipeline({ defectText, evidenceText, sourceLabel, thisRun })
      if (thisRun === runId.current) setFinalCase(result)
    } catch (e) {
      if (thisRun === runId.current && e.message !== 'Cancelled') setError(e.message)
    } finally {
      if (thisRun === runId.current) setRunning(false)
    }
  }

  async function runBulk() {
    if (!logAnalysis || visibleErrors.length === 0) return

    const errors = visibleErrors.slice(0, BULK_MAX_ERRORS)
    const skipped = visibleErrors.length - errors.length
    const thisRun = ++runId.current
    stepsCountRef.current = 0
    setSteps([])
    setError('')
    setFinalCase(null)
    setBulkResults([])
    setRunning(true)
    reqCost.reset()
    setBulkProgress(`Investigating 0 of ${errors.length}…`)

    const results = []
    for (let i = 0; i < errors.length; i++) {
      if (thisRun !== runId.current) break
      const err = errors[i]
      setBulkProgress(`Investigating ${i + 1} of ${errors.length}: ${err.preview.slice(0, 80)}…`)
      setSelectedErrorId(err.id)
      stepsCountRef.current = 0
      setSteps([])

      const defectText = buildDefectReportFromError(err, { filename: logAnalysis.filename, product, env })
      const evidenceText = buildEvidenceForError(logAnalysis, err.id)
      const sourceLabel = `${logAnalysis.filename} · error ${i + 1}/${errors.length}`

      try {
        const finalCase = await runPipeline({ defectText, evidenceText, sourceLabel, thisRun })
        results.push({ error: err, finalCase, status: 'done' })
      } catch (e) {
        if (e.message === 'Cancelled') break
        results.push({ error: err, failMessage: e.message, status: 'failed' })
      }
      if (thisRun === runId.current) setBulkResults([...results])
    }

    if (thisRun === runId.current) {
      setBulkProgress(skipped > 0
        ? `Done — ${results.length} investigated, ${skipped} skipped (max ${BULK_MAX_ERRORS} per bulk run)`
        : '')
      if (results.length === 1 && results[0].finalCase) setFinalCase(results[0].finalCase)
      setRunning(false)
    }
  }

  return (
    <div>
      <header className="page-head">
        <div className="page-eyebrow">Operate · Agentic module</div>
        <h1 className="page-title">Defect Triage Agent</h1>
        <p className="page-desc">
          Four specialist agents work the case autonomously: intake structures the report, an investigator
          forms ranked hypotheses, a router either assigns the case or sends it back for a deeper pass when
          confidence is low, and a planner writes the fix. Load a Datadog export, query live logs, filter
          by service, and investigate one or many errors. Every handoff is visible below.
        </p>
      </header>

      <div className="panel">
        <div className="row">
          <div className="field">
            <label htmlFor="dt-product">Product</label>
            <select id="dt-product" value={product} onChange={(e) => setProduct(e.target.value)}>
              {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dt-env">Environment</label>
            <select id="dt-env" value={env} onChange={(e) => setEnv(e.target.value)}>
              {ENVIRONMENTS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="dt-defect">Defect report</label>
          <textarea
            id="dt-defect"
            value={defect}
            onChange={(e) => setDefect(e.target.value)}
            style={{ minHeight: 130 }}
            placeholder={'Paste the ticket as reported…\n\nExample: Since Monday, renewal bind fails intermittently for commercial property policies with more than one location. Users see "An unexpected error occurred" on the bind screen. Started after the weekend deployment. Roughly 1 in 5 attempts fail; retrying sometimes works.'}
          />
        </div>

        <div className="field">
          <label>Log evidence</label>
          <div className="chips" style={{ marginBottom: 10 }}>
            <button
              type="button"
              className={`chip ${logSource === 'paste' ? 'on' : ''}`}
              onClick={() => setLogSource('paste')}
              disabled={running}
            >
              Paste / file upload
            </button>
            <button
              type="button"
              className={`chip ${logSource === 'live' ? 'on' : ''}`}
              onClick={() => setLogSource('live')}
              disabled={running}
            >
              Live Datadog query
            </button>
          </div>

          {logSource === 'live' ? (
            <div className="dd-query-panel">
              <div className="row">
                <div className="field" style={{ flex: 2, minWidth: 200 }}>
                  <label htmlFor="dt-dd-query">Log query</label>
                  <input
                    id="dt-dd-query"
                    type="text"
                    value={ddQuery}
                    onChange={(e) => setDdQuery(e.target.value)}
                    placeholder="status:error service:policycenter"
                    disabled={running || logLoading}
                  />
                </div>
                <div className="field">
                  <label htmlFor="dt-dd-range">Time range</label>
                  <select
                    id="dt-dd-range"
                    value={ddTimeRange}
                    onChange={(e) => setDdTimeRange(e.target.value)}
                    disabled={running || logLoading}
                  >
                    {TIME_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="dt-dd-service">Service filter</label>
                  <input
                    id="dt-dd-service"
                    type="text"
                    value={ddService}
                    onChange={(e) => setDdService(e.target.value)}
                    placeholder="e.g. policycenter"
                    disabled={running || logLoading}
                  />
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: '0 0 10px' }}>
                Requires <code>DD_API_KEY</code>, <code>DD_APP_KEY</code>, and optional <code>DD_SITE</code> in Vercel env vars.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={running || logLoading}
                onClick={handleDatadogQuery}
              >
                {logLoading ? 'Querying Datadog…' : 'Fetch logs from Datadog'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt,.log,.ndjson,.csv"
                style={{ display: 'none' }}
                onChange={handleLogFile}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={running || logLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {logLoading ? 'Loading log…' : 'Load Datadog log file'}
              </button>
            </div>
          )}

          <textarea
            id="dt-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            style={{ minHeight: 110 }}
            placeholder={'Paste logs or load a Datadog export (.json / .ndjson / .log)…\n\njava.lang.IllegalStateException: Bean already committed in bundle…\n  at gw.pl.persistence.core.Bundle.commit(…)'}
          />
        </div>

        {logError && <div className="alert err" style={{ marginBottom: 12 }}>{logError}</div>}

        <button className="btn btn-primary" onClick={() => run()} disabled={running || !defect.trim()}>
          {running && !bulkProgress ? <><span className="spinner" />Agents working…</> : 'Run triage pipeline'}
        </button>
      </div>

      {logAnalysis && (
        <LogErrorDashboard
          dashboard={dashboard}
          logAnalysis={logAnalysis}
          visibleErrors={visibleErrors}
          selectedErrorId={selectedErrorId}
          serviceFilter={serviceFilter}
          onServiceFilterChange={setServiceFilter}
          running={running}
          bulkProgress={bulkProgress}
          onSelectError={(errorId) => selectError(logAnalysis, errorId)}
          onInvestigate={investigateError}
          onInvestigateAll={runBulk}
        />
      )}

      {error && <div className="alert err">{error}</div>}

      {bulkResults.length > 0 && (
        <div className="panel">
          <h3>Bulk investigation results</h3>
          <p style={{ fontSize: 13.5, color: 'var(--slate)', marginBottom: 12 }}>
            {bulkResults.filter((r) => r.status === 'done').length} of {bulkResults.length} errors triaged
          </p>
          <div className="bulk-results">
            {bulkResults.map((r, i) => (
              <div key={i} className={`bulk-result-card ${r.status}`}>
                <div className="finding-head" style={{ marginBottom: 6 }}>
                  <span className="tag">{r.error.service}</span>
                  {r.status === 'done' ? (
                    <>
                      <span className={`tag ${PRIORITY_TAG[r.finalCase.routing.priority] || ''}`}>
                        {r.finalCase.routing.priority}
                      </span>
                      <span className="tag green">→ {r.finalCase.routing.routeTo}</span>
                      <span className="tag">{r.finalCase.investigation.overallConfidence}%</span>
                    </>
                  ) : (
                    <span className="tag red">failed</span>
                  )}
                </div>
                <p style={{ fontSize: 13.5, marginBottom: 4 }}>{r.error.preview}</p>
                {r.status === 'done' ? (
                  <p style={{ fontSize: 14 }}><b>Lead hypothesis:</b> {r.finalCase.investigation.leadHypothesis}</p>
                ) : (
                  <p style={{ fontSize: 13.5, color: 'var(--crit)' }}>{r.failMessage}</p>
                )}
              </div>
            ))}
          </div>
          <RequestCost totals={reqCost.totals} />
        </div>
      )}

      {steps.length > 0 && (
        <div className="panel">
          <h3>Agent timeline{bulkProgress ? ' (current error)' : ''}</h3>
          <div className="agent-timeline">
            {steps.map((s, i) =>
              s.agent === 'loop' ? (
                <div key={i} className="agent-loop">
                  ↺ Router sent the case back — directive: “{s.note}”
                </div>
              ) : (
                <AgentStep key={i} step={s} />
              )
            )}
          </div>
        </div>
      )}

      {finalCase && bulkResults.length <= 1 && (
        <>
          <div className="panel">
            <h3>Triage outcome</h3>
            <div className="finding-head" style={{ marginBottom: 10 }}>
              <span className={`tag ${PRIORITY_TAG[finalCase.routing.priority] || ''}`}>{finalCase.routing.priority}</span>
              <span className="tag">{finalCase.routing.ticketType}</span>
              <span className="tag green">→ {finalCase.routing.routeTo}</span>
              <span className="tag">confidence {finalCase.investigation.overallConfidence}%</span>
            </div>
            <p style={{ marginBottom: 6 }}><b>Root cause (lead hypothesis):</b> {finalCase.investigation.leadHypothesis}</p>
            <p style={{ marginBottom: 6 }}><b>Priority rationale:</b> {finalCase.routing.priorityRationale}</p>
            <p><b>Handoff note:</b> {finalCase.routing.handoffNote}</p>
            <div style={{ marginTop: 12 }}>
              <SaveToProject
                project={project}
                module="defect-triage"
                title={`Triage · ${finalCase.routing.priority} → ${finalCase.routing.routeTo}`}
                content={finalCase}
              />
            </div>
            {bulkResults.length === 0 && <RequestCost totals={reqCost.totals} />}
          </div>

          <div className="panel">
            <h3>Fix plan</h3>
            <p style={{ marginBottom: 10 }}><b>Workaround:</b> {finalCase.plan.workaround}</p>
            <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>
              Permanent fix — {finalCase.plan.permanentFix.effortBand}
            </p>
            <ol style={{ paddingLeft: 20, fontSize: 14, marginBottom: 10 }}>
              {finalCase.plan.permanentFix.steps.map((st, i) => <li key={i} style={{ padding: '2px 0' }}>{st}</li>)}
            </ol>
            <p style={{ fontSize: 13.5, color: 'var(--slate)', marginBottom: 10 }}>
              <b>Touches:</b> {finalCase.plan.permanentFix.areasTouched.join(' · ')}
            </p>
            <h3>Regression coverage</h3>
            <ul className="plain">{finalCase.plan.regressionTests.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <p style={{ marginTop: 10, fontSize: 14 }}><b>Deployment:</b> {finalCase.plan.deploymentNote}</p>
            <p style={{ fontSize: 14 }}><b>Prevention:</b> {finalCase.plan.prevention}</p>
          </div>
        </>
      )}
    </div>
  )
}

function AgentStep({ step }) {
  const [open, setOpen] = useState(false)
  const meta = AGENTS[step.agent]
  return (
    <div className={`agent-step ${step.status}`}>
      <div className="agent-step-head">
        <span className="agent-dot" />
        <div style={{ flex: 1 }}>
          <div className="agent-name">{meta.name}</div>
          <div className="agent-note">{step.note}</div>
        </div>
        <div className="agent-status">
          {step.status === 'running' && <span className="agent-pulse">working…</span>}
          {step.status === 'done' && <span>{step.elapsed}s ✓</span>}
          {step.status === 'error' && <span style={{ color: 'var(--crit)' }}>failed</span>}
        </div>
        {step.output && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide output' : 'View output'}
          </button>
        )}
      </div>
      {step.status === 'error' && <div className="alert err" style={{ marginTop: 8 }}>{step.error}</div>}
      {open && step.output && (
        <pre className="agent-output">{JSON.stringify(step.output, null, 2)}</pre>
      )}
    </div>
  )
}

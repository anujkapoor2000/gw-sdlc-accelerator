import React, { useRef, useState } from 'react'
import { callClaude, parseModelJson } from '../lib/api.js'
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
  const runId = useRef(0)
  const reqCost = useRequestCost()

  function pushStep(step) {
    setSteps((s) => [...s, step])
    return Date.now()
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

  async function run() {
    runId.current++
    stepsCountRef.current = 0
    setSteps([]); setError(''); setFinalCase(null); setRunning(true); reqCost.reset()

    const baseContext = `Product: ${product}
Environment: ${env}

Defect report:
${defect}

Supporting material (logs / stack trace / code, may be empty):
${evidence || '(none provided)'}`

    try {
      // 1 — Intake
      const intake = await runAgent('intake', TRIAGE_INTAKE_SYSTEM, baseContext,
        'Parsing the report into a structured case file')

      // 2..n — Investigate, with router-driven loops
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

        if (routing.decision !== 'investigate-further' || pass === MAX_LOOPS) break
        loopDirective = routing.loopDirective
        pushStep({ agent: 'loop', status: 'loop', note: routing.loopDirective, startedAt: Date.now() })
        stepsCountRef.current++
      }

      // final — Fix plan
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

      setFinalCase({ intake, investigation, routing, plan })
    } catch (e) {
      setError(e.message)
    } finally {
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
          confidence is low, and a planner writes the fix. Every handoff is visible below.
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
          <label htmlFor="dt-evidence">Logs / stack trace / suspect code (optional — raises investigation confidence)</label>
          <textarea
            id="dt-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            style={{ minHeight: 110 }}
            placeholder={'java.lang.IllegalStateException: Bean already committed in bundle…\n  at gw.pl.persistence.core.Bundle.commit(…)'}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={running || !defect.trim()}>
          {running ? <><span className="spinner" />Agents working…</> : 'Run triage pipeline'}
        </button>
      </div>

      {error && <div className="alert err">{error}</div>}

      {steps.length > 0 && (
        <div className="panel">
          <h3>Agent timeline</h3>
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

      {finalCase && (
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
            <RequestCost totals={reqCost.totals} />
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

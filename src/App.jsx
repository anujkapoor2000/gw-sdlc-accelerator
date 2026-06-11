import React, { useEffect, useState, useCallback } from 'react'
import { db } from './lib/api.js'
import Home from './modules/Home.jsx'
import Dashboard from './modules/Dashboard.jsx'
import StoryForge from './modules/StoryForge.jsx'
import CodeReview from './modules/CodeReview.jsx'
import TestStrategist from './modules/TestStrategist.jsx'
import ReleaseNavigator from './modules/ReleaseNavigator.jsx'
import DefectTriage from './modules/DefectTriage.jsx'
import ProjectBar from './components/ProjectBar.jsx'

const PHASES = [
  { label: 'Overview', items: [
    { id: 'home', name: 'Showcase' },
    { id: 'dashboard', name: 'Workspace' }
  ] },
  { label: 'Plan', items: [{ id: 'story-forge', name: 'Story Forge' }] },
  { label: 'Build', items: [{ id: 'code-review', name: 'Code Review Copilot' }] },
  { label: 'Test', items: [{ id: 'test-strategist', name: 'Test Strategist' }] },
  { label: 'Release', items: [{ id: 'release-navigator', name: 'Release Navigator' }] },
  { label: 'Operate', items: [{ id: 'defect-triage', name: 'Defect Triage Agent' }] }
]

const VALID_VIEWS = PHASES.flatMap((p) => p.items.map((m) => m.id))

// Hash routing: every module gets a shareable URL, e.g. https://app/#/code-review
function viewFromHash() {
  const v = window.location.hash.replace(/^#\/?/, '')
  return VALID_VIEWS.includes(v) ? v : 'home'
}

export default function App() {
  const [view, setViewState] = useState(viewFromHash)
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [dbError, setDbError] = useState('')

  const setView = useCallback((v) => {
    window.location.hash = `/${v}`
    setViewState(v)
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const onHash = () => setViewState(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const rows = await db.listProjects()
      setProjects(rows)
      setDbError('')
      if (!projectId && rows.length) setProjectId(rows[0].id)
    } catch (e) {
      setDbError(e.message)
    }
  }, [projectId])

  useEffect(() => { refreshProjects() }, [refreshProjects])

  const project = projects.find((p) => p.id === projectId) || null
  const moduleProps = { project, refreshProjects }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span className="ntt">NTT DATA</span><span className="tick" /></div>
          <div className="brand-sub">Guidewire SDLC Accelerator</div>
        </div>
        <nav className="rail" aria-label="Lifecycle modules">
          {PHASES.map((phase, pi) => (
            <div className="rail-phase" key={phase.label} style={{ padding: 0 }}>
              <div className="rail-phase-label" style={{ padding: '0 24px' }}>{phase.label}</div>
              {phase.items.map((m) => (
                <button
                  key={m.id}
                  className={`rail-item ${view === m.id ? 'active' : ''}`}
                  onClick={() => setView(m.id)}
                >
                  <span className="rail-node" />{m.name}
                </button>
              ))}
              {pi < PHASES.length - 1 && <div className="rail-connect" />}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">Guidewire Practice · Global Delivery</div>
      </aside>

      <main className="main">
        {view !== 'home' && (
          <ProjectBar
            projects={projects}
            projectId={projectId}
            setProjectId={setProjectId}
            refreshProjects={refreshProjects}
            dbError={dbError}
          />
        )}
        {view === 'home' && <Home go={setView} />}
        {view === 'dashboard' && <Dashboard {...moduleProps} go={setView} projects={projects} />}
        {view === 'story-forge' && <StoryForge {...moduleProps} />}
        {view === 'code-review' && <CodeReview {...moduleProps} />}
        {view === 'test-strategist' && <TestStrategist {...moduleProps} />}
        {view === 'release-navigator' && <ReleaseNavigator {...moduleProps} />}
        {view === 'defect-triage' && <DefectTriage {...moduleProps} />}
      </main>
    </div>
  )
}

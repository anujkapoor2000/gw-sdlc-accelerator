import React, { useEffect, useState, useCallback } from 'react'
import { db } from './lib/api.js'
import Home from './modules/Home.jsx'
import Dashboard from './modules/Dashboard.jsx'
import StoryForge from './modules/StoryForge.jsx'
import CodeReview from './modules/CodeReview.jsx'
import TestStrategist from './modules/TestStrategist.jsx'
import FlowAutomator from './modules/FlowAutomator.jsx'
import TestMigrator from './modules/TestMigrator.jsx'
import ReleaseNavigator from './modules/ReleaseNavigator.jsx'
import DefectTriage from './modules/DefectTriage.jsx'
import ProjectBar from './components/ProjectBar.jsx'
import ProjectKnowledge from './components/ProjectKnowledge.jsx'
import UsageMeter from './components/UsageMeter.jsx'

const PHASES = [
  { label: 'Overview', items: [
    { id: 'home', name: 'Showcase' },
    { id: 'dashboard', name: 'Workspace' }
  ] },
  { label: 'Plan', items: [{ id: 'story-forge', name: 'Story Forge' }] },
  { label: 'Build', items: [{ id: 'code-review', name: 'Code Review Copilot' }] },
  { label: 'Test', items: [
    { id: 'test-strategist', name: 'Test Strategist' },
    { id: 'flow-automator', name: 'Flow Automator' },
    { id: 'test-migrator', name: 'Test Migrator' }
  ] },
  { label: 'Release', items: [{ id: 'release-navigator', name: 'Release Navigator' }] },
  { label: 'Operate', items: [{ id: 'defect-triage', name: 'Defect Triage Agent' }] }
]

const VALID_VIEWS = PHASES.flatMap((p) => p.items.map((m) => m.id))

// Top-bar quick links (the rest live in the menu)
const NAV_LINKS = [
  { id: 'home', name: 'Home' },
  { id: 'dashboard', name: 'Workspace' },
  { id: 'story-forge', name: 'Testing' },
  { id: 'code-review', name: 'Analysis' }
]

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
  const [menuOpen, setMenuOpen] = useState(false)

  const setView = useCallback((v) => {
    window.location.hash = `/${v}`
    setViewState(v)
    setMenuOpen(false)
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
    <div className="app">
      {view === 'home' && (
        <div className="announce">
          <div className="announce-inner">
            <span className="new-badge">New</span>
            <span>Guidewire AI Testing Suite is live with Claude Sonnet integration</span>
            <button className="announce-link" onClick={() => setView('story-forge')}>Explore tools →</button>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="topbar-inner">
          <button className="logo" onClick={() => setView('home')} aria-label="GuidewireAI home">
            <span className="logo-dash" aria-hidden="true" />
            Guidewire<span className="accent">AI</span>
          </button>
          <nav className="topnav" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                className={view === l.id ? 'active' : ''}
                onClick={() => setView(l.id)}
              >
                {l.name}
              </button>
            ))}
          </nav>
          <span className="topbar-spacer" />
          <button className="btn-demo" onClick={() => setView('dashboard')}>Book a demo</button>
          <button
            className="hamburger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="menu-panel">
          <div className="menu-inner">
            {PHASES.map((phase) => (
              <React.Fragment key={phase.label}>
                <div className="menu-group-label">{phase.label}</div>
                {phase.items.map((m) => (
                  <button
                    key={m.id}
                    className={`menu-item ${view === m.id ? 'active' : ''}`}
                    onClick={() => setView(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <main className="main">
        {view === 'home' ? (
          <Home go={setView} />
        ) : (
          <div className="page">
            <ProjectBar
              projects={projects}
              projectId={projectId}
              setProjectId={setProjectId}
              refreshProjects={refreshProjects}
              dbError={dbError}
            />
            <ProjectKnowledge project={project} dbError={dbError} />
            {view === 'dashboard' && <Dashboard {...moduleProps} go={setView} projects={projects} />}
            {view === 'story-forge' && <StoryForge {...moduleProps} />}
            {view === 'code-review' && <CodeReview {...moduleProps} />}
            {view === 'test-strategist' && <TestStrategist {...moduleProps} />}
            {view === 'flow-automator' && <FlowAutomator {...moduleProps} />}
            {view === 'test-migrator' && <TestMigrator {...moduleProps} />}
            {view === 'release-navigator' && <ReleaseNavigator {...moduleProps} />}
            {view === 'defect-triage' && <DefectTriage {...moduleProps} />}
          </div>
        )}
      </main>

      <footer className="foot">
        <div className="foot-inner">
          <span>
            <strong style={{ color: 'var(--ink)' }}>GuidewireAI</strong> · AI accelerators for Guidewire InsuranceSuite
          </span>
          <span>Powered by Claude Sonnet · NTT DATA Guidewire Practice</span>
        </div>
      </footer>

      <UsageMeter />
    </div>
  )
}

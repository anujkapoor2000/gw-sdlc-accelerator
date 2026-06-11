import React, { useEffect, useState } from 'react'
import { db } from '../lib/api.js'

const MODULES = [
  { id: 'story-forge', phase: 'Plan', name: 'Story Forge', desc: 'Raw requirements → sprint-ready stories with Gherkin ACs, GW touchpoints and points.' },
  { id: 'code-review', phase: 'Build', name: 'Code Review Copilot', desc: 'Principal-level Gosu/PCF/integration review against Guidewire Cloud standards.' },
  { id: 'test-strategist', phase: 'Test', name: 'Test Strategist', desc: 'Pyramid-balanced coverage across GUnit, GT-API and GT-UI with staged test data.' },
  { id: 'release-navigator', phase: 'Release', name: 'Release Navigator', desc: 'CI/CD readiness self-check and ski-release upgrade impact on your customisations.' },
  { id: 'defect-triage', phase: 'Operate · Agentic', name: 'Defect Triage Agent', desc: 'Four agents work the case autonomously: investigate, route — or loop back when confidence is low — then plan the fix.' }
]

const MODULE_NAMES = Object.fromEntries(MODULES.map((m) => [m.id, m.name]))

export default function Dashboard({ project, go }) {
  const [artifacts, setArtifacts] = useState([])
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    if (!project) { setArtifacts([]); return }
    db.listArtifacts(project.id)
      .then(setArtifacts)
      .catch((e) => setLoadErr(e.message))
  }, [project])

  async function removeArtifact(id) {
    if (!confirm('Delete this saved output?')) return
    try {
      await db.deleteArtifact(id)
      setArtifacts((a) => a.filter((x) => x.id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <header className="page-head">
        <div className="page-eyebrow">NTT DATA Guidewire Practice</div>
        <h1 className="page-title">One lifecycle, four copilots</h1>
        <p className="page-desc">
          AI assistance at each gate of the Guidewire delivery lifecycle — plan, build, test, release —
          with every output saved against the project it belongs to.
        </p>
      </header>

      <div className="module-grid">
        {MODULES.map((m) => (
          <button key={m.id} className="module-tile" onClick={() => go(m.id)}>
            <div className="phase">{m.phase}</div>
            <h4>{m.name}</h4>
            <p>{m.desc}</p>
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <h3>{project ? `Saved outputs — ${project.name}` : 'Saved outputs'}</h3>
        {!project && <p style={{ color: 'var(--slate)', fontSize: 14 }}>Create a project above to start saving outputs.</p>}
        {project && loadErr && <div className="alert err">{loadErr}</div>}
        {project && !loadErr && artifacts.length === 0 && (
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>
            Nothing saved yet. Run any module and use “Save to project”.
          </p>
        )}
        {artifacts.map((a) => (
          <div key={a.id} className="artifact-row">
            <div>
              <div style={{ fontWeight: 600 }}>{a.title}</div>
              <div className="meta">{MODULE_NAMES[a.module] || a.module} · {new Date(a.created_at).toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(a.content, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `${a.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
                  link.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Export JSON
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => removeArtifact(a.id)} style={{ color: 'var(--crit)' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

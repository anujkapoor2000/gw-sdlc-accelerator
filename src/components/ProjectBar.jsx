import React, { useState } from 'react'
import { db } from '../lib/api.js'
import { isProjectRagEnabled, setProjectRagEnabled } from '../lib/rag.js'

export default function ProjectBar({ projects, projectId, setProjectId, refreshProjects, dbError }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [busy, setBusy] = useState(false)
  const [ragOn, setRagOn] = useState(isProjectRagEnabled)

  function toggleRag() {
    const next = !ragOn
    setRagOn(next)
    setProjectRagEnabled(next)
  }

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const p = await db.createProject({ name: name.trim(), client: client.trim() })
      setName(''); setClient(''); setCreating(false)
      await refreshProjects()
      setProjectId(p.id)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {dbError && (
        <div className="alert err">
          Database unavailable: {dbError}. Outputs can still be generated; saving is disabled until DATABASE_URL is configured.
        </div>
      )}
      <div className="project-bar">
        <label htmlFor="proj">Project</label>
        <select id="proj" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.length === 0 && <option value="">No projects yet</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.client ? ` — ${p.client}` : ''} ({p.artifact_count} saved)
            </option>
          ))}
        </select>
        {!creating && (
          <button className="btn btn-ghost btn-sm" onClick={() => setCreating(true)}>+ New project</button>
        )}
        {creating && (
          <>
            <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Client (optional)" value={client} onChange={(e) => setClient(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={create} disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>Cancel</button>
          </>
        )}
        {projectId && !dbError && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer', marginLeft: 8 }}>
            <input type="checkbox" checked={ragOn} onChange={toggleRag} />
            Use project knowledge (RAG)
          </label>
        )}
      </div>
    </>
  )
}

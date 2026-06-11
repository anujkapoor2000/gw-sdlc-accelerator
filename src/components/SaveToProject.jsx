import React, { useState } from 'react'
import { db } from '../lib/api.js'

export default function SaveToProject({ project, module, title, content }) {
  const [state, setState] = useState('idle') // idle | busy | done | error
  const [msg, setMsg] = useState('')

  async function save() {
    if (!project) { setState('error'); setMsg('Create or select a project first.'); return }
    setState('busy')
    try {
      await db.saveArtifact(project.id, { module, title, content })
      setState('done'); setMsg(`Saved to ${project.name}`)
    } catch (e) {
      setState('error'); setMsg(e.message)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button className="btn btn-ghost btn-sm" onClick={save} disabled={state === 'busy'}>
        {state === 'busy' ? 'Saving…' : state === 'done' ? 'Saved ✓' : 'Save to project'}
      </button>
      {state === 'error' && <span style={{ color: 'var(--crit)', fontSize: 13 }}>{msg}</span>}
    </span>
  )
}

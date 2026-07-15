import React, { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/api.js'

const DOC_TYPES = [
  { id: 'standard', label: 'Client standards' },
  { id: 'inventory', label: 'Customisation inventory' },
  { id: 'playbook', label: 'Runbook / playbook' },
  { id: 'notes', label: 'General notes' }
]

export default function ProjectKnowledge({ project, dbError }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [loadErr, setLoadErr] = useState('')
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('standard')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const refresh = useCallback(async () => {
    if (!project?.id) { setDocs([]); return }
    try {
      const rows = await db.listKnowledge(project.id)
      setDocs(rows)
      setLoadErr('')
    } catch (e) {
      setLoadErr(e.message)
    }
  }, [project?.id])

  useEffect(() => { if (open) refresh() }, [open, refresh])

  async function addDoc() {
    if (!project?.id || !title.trim() || !content.trim()) return
    setBusy(true)
    try {
      await db.addKnowledge({
        projectId: project.id,
        title: title.trim(),
        docType,
        content: content.trim()
      })
      setTitle('')
      setContent('')
      await refresh()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeDoc(id) {
    if (!confirm('Delete this knowledge document and its indexed chunks?')) return
    try {
      await db.deleteKnowledge(id)
      await refresh()
    } catch (e) {
      alert(e.message)
    }
  }

  async function syncArtifacts() {
    if (!project?.id) return
    setBusy(true)
    setSyncMsg('')
    try {
      const result = await db.syncArtifactKnowledge(project.id)
      setSyncMsg(`Indexed ${result.added} new artifact(s) (${result.total} total saved outputs).`)
      await refresh()
    } catch (e) {
      setSyncMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!project || dbError) return null

  const totalChunks = docs.reduce((n, d) => n + (d.chunk_count || 0), 0)

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Project knowledge (RAG)</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--slate)' }}>
            Client standards, inventories, and saved outputs — embedded and retrieved per accelerator run.
            {docs.length > 0 && ` ${docs.length} doc(s), ${totalChunks} chunk(s) indexed.`}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Collapse' : 'Manage'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          {loadErr && <div className="alert err">{loadErr}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={syncArtifacts} disabled={busy}>
              Index saved outputs
            </button>
            <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={busy}>
              Refresh
            </button>
          </div>
          {syncMsg && <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 12 }}>{syncMsg}</p>}

          <div className="field">
            <label htmlFor="pk-title">Add knowledge document</label>
            <input
              id="pk-title"
              placeholder="Title (e.g. GW Cloud coding standards — Acme)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pk-type">Type</label>
            <select id="pk-type" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pk-content">Content</label>
            <textarea
              id="pk-content"
              rows={6}
              placeholder="Paste client standards, customisation inventory, runbooks, or other reference text…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addDoc} disabled={busy || !title.trim() || !content.trim()}>
            {busy ? 'Indexing…' : 'Add & index'}
          </button>

          {docs.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ marginBottom: 8 }}>Indexed documents</h4>
              {docs.map((d) => (
                <div key={d.id} className="artifact-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.title}</div>
                    <div className="meta">
                      {d.doc_type} · {d.chunk_count} chunks · {d.source} · {new Date(d.updated_at || d.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeDoc(d.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

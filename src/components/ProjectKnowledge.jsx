import React, { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../lib/api.js'

const DOC_TYPES = [
  { id: 'standard', label: 'Client standards' },
  { id: 'inventory', label: 'Customisation inventory' },
  { id: 'playbook', label: 'Runbook / playbook' },
  { id: 'file', label: 'Uploaded file' },
  { id: 'codebase', label: 'Codebase source' },
  { id: 'notes', label: 'General notes' }
]

const UPLOAD_ACCEPT = '.md,.txt,.json,.csv,.gosu,.groovy,.js,.jsx,.sql,.xml,.yaml,.yml,.properties,.java,.feature'

export default function ProjectKnowledge({ project, dbError }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [presets, setPresets] = useState([])
  const [allowedRoots, setAllowedRoots] = useState([])
  const [loadErr, setLoadErr] = useState('')
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('standard')
  const [content, setContent] = useState('')
  const [codebasePaths, setCodebasePaths] = useState('reference')
  const [busy, setBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const fileInputRef = useRef(null)

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

  useEffect(() => {
    if (!open) return
    refresh()
    db.listCodebasePresets()
      .then((data) => {
        setPresets(data.presets || [])
        setAllowedRoots(data.allowedRoots || [])
      })
      .catch(() => {})
  }, [open, refresh])

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

  async function onUploadFile(e) {
    const file = e.target.files?.[0]
    if (!file || !project?.id) return
    setBusy(true)
    setSyncMsg('')
    try {
      const text = await file.text()
      await db.uploadKnowledgeFile({
        projectId: project.id,
        filename: file.name,
        content: text,
        docType: 'file',
        title: file.name
      })
      setSyncMsg(`Indexed file: ${file.name}`)
      await refresh()
    } catch (err) {
      setSyncMsg(err.message)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  async function syncCodebase(preset) {
    if (!project?.id) return
    setBusy(true)
    setSyncMsg('')
    try {
      const paths = preset
        ? undefined
        : codebasePaths.split(',').map((p) => p.trim()).filter(Boolean)
      const result = await db.syncCodebaseKnowledge(project.id, { preset, paths })
      setSyncMsg(
        `Indexed ${result.added} codebase file(s) from ${result.paths?.join(', ') || preset}` +
        (result.skipped ? ` (${result.skipped} skipped).` : '.')
      )
      await refresh()
    } catch (e) {
      setSyncMsg(e.message)
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

  if (!project || dbError) return null

  const totalChunks = docs.reduce((n, d) => n + (d.chunk_count || 0), 0)

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Project knowledge (RAG)</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--slate)' }}>
            Paste text, upload files, index saved outputs, or point at codebase paths — retrieved per accelerator run.
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
            <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              Upload file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              style={{ display: 'none' }}
              onChange={onUploadFile}
            />
            <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={busy}>
              Refresh
            </button>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="pk-codebase">Index from codebase (repo paths)</label>
            <input
              id="pk-codebase"
              placeholder="e.g. reference, katalon/Keywords, src/lib/prompts.js"
              value={codebasePaths}
              onChange={(e) => setCodebasePaths(e.target.value)}
            />
            <p style={{ fontSize: 12, color: 'var(--slate)', margin: '6px 0 8px' }}>
              Allowed roots: {allowedRoots.length ? allowedRoots.join(' · ') : 'reference · katalon · docs · src/lib · db'}
              . Comma-separate multiple paths. Re-index replaces prior codebase docs.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => syncCodebase()}
                disabled={busy || !codebasePaths.trim()}
              >
                {busy ? 'Indexing…' : 'Index paths'}
              </button>
              {presets.map((p) => (
                <button
                  key={p.id}
                  className="btn btn-ghost btn-sm"
                  onClick={() => syncCodebase(p.id)}
                  disabled={busy}
                  title={p.paths.join(', ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {syncMsg && <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 12 }}>{syncMsg}</p>}

          <div className="field">
            <label htmlFor="pk-title">Add knowledge document (paste)</label>
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
                      {d.doc_type} · {d.chunk_count} chunks · {d.source}
                      {d.metadata?.path ? ` · ${d.metadata.path}` : ''}
                      {d.metadata?.filename ? ` · ${d.metadata.filename}` : ''}
                      {' · '}{new Date(d.updated_at || d.created_at).toLocaleString()}
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

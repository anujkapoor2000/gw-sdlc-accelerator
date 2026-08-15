import React, { useEffect, useRef, useState } from 'react'
import { knowledge } from '../lib/api.js'

export default function ProjectKnowledge({ project }) {
  const [status, setStatus] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [docLabel, setDocLabel] = useState('')
  const [docContent, setDocContent] = useState('')
  const fileRef = useRef(null)

  function refresh() {
    if (!project) { setStatus(null); return }
    setLoadErr('')
    knowledge.status(project.id)
      .then(setStatus)
      .catch((e) => setLoadErr(e.message))
  }

  useEffect(refresh, [project?.id])

  async function runSync() {
    setBusy(true)
    setLoadErr('')
    try {
      await knowledge.sync(project.id, {})
      refresh()
    } catch (e) {
      setLoadErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function addGit() {
    if (!gitUrl.trim()) return
    setBusy(true)
    setLoadErr('')
    try {
      await knowledge.addGitSource(project.id, { gitUrl: gitUrl.trim(), branch: gitBranch.trim() || 'main' })
      setGitUrl('')
      refresh()
    } catch (e) {
      setLoadErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadDoc() {
    if (!docContent.trim()) return
    setBusy(true)
    setLoadErr('')
    try {
      const filename = docLabel.trim() || 'runbook.md'
      await knowledge.uploadDoc(project.id, {
        label: docLabel.trim() || filename,
        filename: filename.endsWith('.md') || filename.endsWith('.txt') ? filename : `${filename}.md`,
        content: docContent
      })
      setDocContent('')
      setDocLabel('')
      refresh()
    } catch (e) {
      setLoadErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const content = await file.text()
      await knowledge.uploadDoc(project.id, {
        label: docLabel.trim() || file.name,
        filename: file.name,
        content
      })
      refresh()
    } catch (err) {
      setLoadErr(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeSource(id) {
    if (!confirm('Delete this knowledge source and all its indexed chunks?')) return
    try {
      await knowledge.deleteSource(id)
      refresh()
    } catch (e) {
      setLoadErr(e.message)
    }
  }

  if (!project) {
    return (
      <div className="panel" style={{ marginTop: 24 }}>
        <h3>Project knowledge</h3>
        <p style={{ color: 'var(--slate)', fontSize: 14 }}>Create a project above to index docs, code, and prior triage runs.</p>
      </div>
    )
  }

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <div className="log-dashboard-head">
        <div>
          <h3>Project knowledge</h3>
          <p className="log-dashboard-sub">
            Ground Defect Triage in this project&apos;s docs, codebase, and prior triage artifacts — not web search.
            {status?.chunkCount != null ? ` · ${status.chunkCount} indexed chunks` : ''}
            {status?.embeddingsConfigured ? ' · embeddings on' : ' · keyword search (set EMBEDDING_API_KEY for vectors)'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={runSync}>
          {busy ? 'Syncing…' : 'Sync artifacts'}
        </button>
      </div>

      {loadErr && <div className="alert err" style={{ marginBottom: 12 }}>{loadErr}</div>}

      <div className="knowledge-section">
        <span className="log-breakdown-label">Connect GitHub repo</span>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, minWidth: 200 }}>
            <label htmlFor="kn-git-url">Repository URL</label>
            <input
              id="kn-git-url"
              type="url"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              placeholder="https://github.com/org/gw-customizations"
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="kn-git-branch">Branch</label>
            <input
              id="kn-git-branch"
              type="text"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
              disabled={busy}
            />
          </div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !gitUrl.trim()} onClick={addGit}>
            Index repo
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: '6px 0 0' }}>
          Indexes .gs, .gsx, .pcf, .xml, .java, .md, .txt (public repos; set GITHUB_TOKEN for private).
        </p>
      </div>

      <div className="knowledge-section">
        <span className="log-breakdown-label">Upload runbook / doc</span>
        <div className="field">
          <label htmlFor="kn-doc-label">Label</label>
          <input
            id="kn-doc-label"
            type="text"
            value={docLabel}
            onChange={(e) => setDocLabel(e.target.value)}
            placeholder="e.g. Bind failure runbook"
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="kn-doc-content">Content (Markdown or plain text)</label>
          <textarea
            id="kn-doc-content"
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            style={{ minHeight: 90 }}
            placeholder="# Bind failures&#10;&#10;When renewal bind fails with Bean already committed…"
            disabled={busy}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !docContent.trim()} onClick={uploadDoc}>
            Upload text
          </button>
          <input ref={fileRef} type="file" accept=".md,.txt,.rst" style={{ display: 'none' }} onChange={handleFile} />
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            Load file
          </button>
        </div>
      </div>

      {status?.sources?.length > 0 && (
        <div className="knowledge-section">
          <span className="log-breakdown-label">Indexed sources</span>
          <ul className="plain knowledge-source-list">
            {status.sources.map((s) => (
              <li key={s.id} className="knowledge-source-row">
                <div>
                  <span className="tag">{s.source_type}</span>
                  <span style={{ fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--slate)', marginLeft: 8 }}>
                    {s.chunk_count} chunks · {s.sync_status}
                    {s.last_synced_at ? ` · ${new Date(s.last_synced_at).toLocaleString()}` : ''}
                  </span>
                  {s.sync_error && (
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--crit)' }}>{s.sync_error}</span>
                  )}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--crit)' }} onClick={() => removeSource(s.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

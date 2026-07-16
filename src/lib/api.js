// src/lib/api.js — browser-side helpers. All secrets stay on the server.

// ---------- per-request usage / cost telemetry ----------
// Every callClaude resolves with the prompt text (so existing callers are
// untouched), but also publishes a usage+cost record. A global meter subscribes
// to show token details and cost for each request; individual callers can also
// pass an onUsage callback for inline display.
const usageSubscribers = new Set()

export function subscribeUsage(fn) {
  usageSubscribers.add(fn)
  return () => usageSubscribers.delete(fn)
}

function currentView() {
  return window.location.hash.replace(/^#\/?/, '') || 'home'
}

function emitUsage(record) {
  for (const fn of usageSubscribers) {
    try { fn(record) } catch { /* a bad subscriber must not break the request */ }
  }
}

export async function callClaude({
  system,
  prompt,
  maxTokens = 6000,
  onUsage,
  cacheSystem = false,
  projectId,
  ragModule,
  ragQuery,
  useProjectKnowledge = false
}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system,
      cache_system: cacheSystem,
      max_tokens: maxTokens,
      project_id: projectId,
      rag_module: ragModule,
      rag_query: ragQuery,
      use_project_knowledge: useProjectKnowledge,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  // Read the SSE stream — tokens arrive as { t: "..." } events, with a final
  // { done: true, model, usage, cost } event once generation completes.
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buf = ''
  let gotDone = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      let evt
      try { evt = JSON.parse(line.slice(6)) } catch { continue }

      if (evt.error) throw new Error(evt.error)
      if (evt.t) fullText += evt.t
      if (evt.done) {
        gotDone = true
        if (evt.usage || evt.cost) {
          const record = {
            at: Date.now(),
            view: currentView(),
            model: evt.model,
            usage: evt.usage || {},
            cost: evt.cost || null
          }
          if (onUsage) { try { onUsage(record) } catch { /* ignore */ } }
          emitUsage(record)
        }
      }
    }
  }

  if (!gotDone) {
    throw new Error('Response was interrupted before completing. Please try again.')
  }

  return fullText
}

// Strip accidental markdown fences, then parse strict JSON.
export function parseModelJson(text) {
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Model did not return JSON')
  return JSON.parse(clean.slice(start, end + 1))
}

// ---------- persistence ----------

async function handle(res) {
  if (res.status === 413) {
    throw new Error(
      'Upload too large (platform limit 4.5 MB). For PDFs, use a smaller file or paste extracted text. Text files max 500 KB.'
    )
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data ?? {}
}

export const db = {
  listProjects: () => fetch('/api/projects').then(handle),

  createProject: (payload) =>
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(handle),

  deleteProject: (id) =>
    fetch(`/api/projects?id=${id}`, { method: 'DELETE' }).then(handle),

  listArtifacts: (projectId) =>
    fetch(`/api/projects?id=${projectId}&artifacts=1`).then(handle),

  saveArtifact: (projectId, payload) =>
    fetch(`/api/projects?id=${projectId}&artifacts=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(handle),

  deleteArtifact: (artifactId) =>
    fetch(`/api/projects?artifactId=${artifactId}`, { method: 'DELETE' }).then(handle),

  listKnowledge: (projectId) =>
    fetch(`/api/knowledge?projectId=${projectId}`).then(handle),

  getRagStatus: (projectId) =>
    fetch(`/api/knowledge?action=status${projectId ? `&projectId=${projectId}` : ''}`).then(handle),

  listCodebasePresets: () =>
    fetch('/api/knowledge?action=presets').then(handle),

  addKnowledge: (payload) =>
    fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(handle),

  uploadKnowledgeFile: (payload) =>
    fetch('/api/knowledge?action=upload-file', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(handle),

  deleteKnowledge: (id) =>
    fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' }).then(handle),

  syncArtifactKnowledge: (projectId) =>
    fetch(`/api/knowledge?action=sync-artifacts&projectId=${projectId}`, {
      method: 'POST'
    }).then(handle),

  syncCodebaseKnowledge: (projectId, { preset, paths } = {}) =>
    fetch(`/api/knowledge?action=sync-codebase&projectId=${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preset, paths })
    }).then(handle),

  reindexKnowledge: (projectId) =>
    fetch(`/api/knowledge?action=reindex&projectId=${projectId}`, {
      method: 'POST'
    }).then(handle)
}

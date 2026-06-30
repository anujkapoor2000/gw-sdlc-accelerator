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

export async function callClaude({ system, prompt, maxTokens = 6000, onUsage }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  if (!data) throw new Error('Empty response from server')

  if (data.usage || data.cost) {
    const record = {
      at: Date.now(),
      view: currentView(),
      model: data.model,
      usage: data.usage || {},
      cost: data.cost || null
    }
    if (onUsage) { try { onUsage(record) } catch { /* ignore */ } }
    emitUsage(record)
  }
  return data.text
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
    fetch(`/api/projects?artifactId=${artifactId}`, { method: 'DELETE' }).then(handle)
}

// src/lib/api.js — browser-side helpers. All secrets stay on the server.

export async function callClaude({ system, prompt, maxTokens = 6000 }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  // Errors come back as JSON (the proxy sends them before streaming starts).
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Request failed (${res.status})`)
  }

  // Streamed text/plain response — accumulate the deltas into the full text.
  const contentType = res.headers.get('content-type') || ''
  if (res.body && contentType.includes('text/plain')) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return text
  }

  // Fallback: legacy JSON response shape ({ text }).
  const data = await res.json()
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
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
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

// src/lib/rag.js — client helpers for per-project RAG.

const RAG_PREF_KEY = 'gw-use-project-rag'

export function isProjectRagEnabled() {
  try {
    return localStorage.getItem(RAG_PREF_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setProjectRagEnabled(enabled) {
  try {
    localStorage.setItem(RAG_PREF_KEY, enabled ? 'true' : 'false')
  } catch { /* private browsing */ }
}

/** Options to spread into callClaude when project knowledge should be retrieved. */
export function ragCallOptions(project, module, queryText) {
  if (!project?.id || !isProjectRagEnabled()) return {}
  const q = String(queryText || '').trim()
  if (!q) return {}
  return {
    projectId: project.id,
    ragModule: module,
    ragQuery: q.slice(0, 8000),
    useProjectKnowledge: true
  }
}

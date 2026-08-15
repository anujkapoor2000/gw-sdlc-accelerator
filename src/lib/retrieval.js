// Client-side retrieval query builder and context pack formatter for Defect Triage.

import { knowledge } from './api.js'

const MAX_CONTEXT_CHARS = 32000

/** Extract search terms from defect text, evidence, and log errors. */
export function buildRetrievalQueries({ defectText, evidenceText, logAnalysis, selectedErrorId, product }) {
  const queries = new Set()
  const stackParts = []

  if (product && product !== 'Unknown') {
    queries.add(product.replace('Center', '').toLowerCase())
  }

  const combined = `${defectText}\n${evidenceText}`
  const exceptionRe = /([\w$.]+Exception|[\w$.]+Error)/g
  let m
  while ((m = exceptionRe.exec(combined)) !== null) {
    queries.add(m[1])
  }

  const gwClassRe = /(?:gw|com\.guidewire|entity)\.[\w.$]+/gi
  const gwMatches = combined.match(gwClassRe) || []
  gwMatches.slice(0, 8).forEach((c) => queries.add(c))

  const words = combined
    .replace(/[^\w\s.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 5)
    .slice(0, 10)
  words.forEach((w) => queries.add(w))

  if (logAnalysis?.errors?.length) {
    const err = selectedErrorId
      ? logAnalysis.errors.find((e) => e.id === selectedErrorId)
      : logAnalysis.errors[0]
    if (err) {
      if (err.errorKind) queries.add(err.errorKind)
      if (err.service && err.service !== 'unknown') queries.add(err.service)
      if (err.message) {
        err.message.split(/\s+/).slice(0, 6).forEach((w) => {
          if (w.length > 4) queries.add(w.replace(/[^\w.-]/g, ''))
        })
      }
      if (err.stack) stackParts.push(err.stack)
    }
  }

  return {
    queries: [...queries].filter(Boolean).slice(0, 20),
    stack: stackParts.join('\n')
  }
}

/** Format retrieved chunks into a cited context pack for agent prompts. */
export function formatContextPack(chunks) {
  if (!chunks?.length) {
    return '=== Retrieved from project knowledge ===\n(no relevant project sources found — do not invent code paths or runbooks)\n'
  }

  const parts = [
    '=== Retrieved from project knowledge (cite using the [doc:...] or [code:...] keys below) ===',
    ''
  ]

  chunks.forEach((chunk, i) => {
    const header = `[${i + 1}] ${chunk.citeKey}${chunk.path ? ` (${chunk.sourceType})` : ''}`
    parts.push(header)
    parts.push(chunk.text.slice(0, 4000))
    parts.push('')
  })

  let text = parts.join('\n')
  if (text.length > MAX_CONTEXT_CHARS) {
    text = text.slice(0, MAX_CONTEXT_CHARS) + '\n\n… [retrieved context truncated to fit token budget]'
  }
  return text
}

/**
 * Fetch project knowledge and return context pack + raw chunks.
 * @param {{ projectId: string, defectText: string, evidenceText: string, logAnalysis?: object, selectedErrorId?: string, product?: string, enabled?: boolean }} params
 */
export async function retrieveProjectContext(params) {
  const { projectId, enabled = true } = params
  if (!projectId || !enabled) {
    return { chunks: [], contextPack: '', count: 0 }
  }

  const { queries, stack } = buildRetrievalQueries(params)
  if (queries.length === 0 && !stack) {
    return { chunks: [], contextPack: formatContextPack([]), count: 0 }
  }

  try {
    const { results = [] } = await knowledge.search(projectId, {
      queries,
      stack,
      product: params.product,
      limit: 12
    })
    const contextPack = formatContextPack(results)
    return { chunks: results, contextPack, count: results.length, queries }
  } catch (err) {
    return {
      chunks: [],
      contextPack: `=== Retrieved from project knowledge ===\n(search unavailable: ${err.message})\n`,
      count: 0,
      error: err.message
    }
  }
}

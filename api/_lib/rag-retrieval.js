// Edge-safe RAG retrieval — no Node fs/path (used by api/chat Edge Function).

import { cosineSimilarity, embedTexts, embeddingProvider } from './embeddings.js'
import { ensureSchema, isPgvectorReady } from './schema.js'

const MODULE_DOC_TYPES = {
  'story-forge': ['standard', 'notes', 'artifact', 'playbook', 'file', 'codebase'],
  'code-review': ['standard', 'artifact', 'notes', 'playbook', 'file', 'codebase'],
  'test-strategist': ['standard', 'artifact', 'playbook', 'notes', 'file', 'codebase'],
  'flow-automator': ['standard', 'artifact', 'playbook', 'notes', 'file', 'codebase'],
  'test-migrator': ['standard', 'artifact', 'playbook', 'notes', 'file', 'codebase'],
  'release-navigator': ['inventory', 'standard', 'artifact', 'notes', 'file', 'codebase'],
  'defect-triage': ['playbook', 'artifact', 'notes', 'standard', 'file', 'codebase']
}

const RAG_HEADER = `PROJECT KNOWLEDGE (retrieved) — client-specific material for this engagement.
Prefer these excerpts when they apply. If they conflict with generic guidance, favour project knowledge for client-specific conventions.`

function vectorLiteral(vec) {
  return `[${vec.map((v) => Number(v).toFixed(8)).join(',')}]`
}

function rankChunks(rows, queryVec, limit) {
  return rows
    .map((row) => {
      const emb = row.embedding_json
      const score = cosineSimilarity(queryVec, Array.isArray(emb) ? emb : [])
      return { ...row, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Retrieve top-k chunks for a query, optionally filtered by module doc types. */
export async function retrieveKnowledge(sql, { projectId, query, module, limit = 8 }) {
  await ensureSchema(sql)
  const trimmed = String(query || '').trim()
  if (!projectId || !trimmed) return { chunks: [], provider: embeddingProvider() }

  const preferredTypes = MODULE_DOC_TYPES[module] || null
  const [queryVec] = await embedTexts([trimmed])
  const usePg = isPgvectorReady()

  let rows
  if (usePg) {
    const lit = vectorLiteral(queryVec)
    try {
      rows = preferredTypes?.length
        ? await sql`
            SELECT c.content, c.chunk_index, d.title, d.doc_type, d.id AS doc_id,
                   1 - (c.embedding <=> ${lit}::vector) AS score
            FROM sdlc_knowledge_chunks c
            JOIN sdlc_knowledge_docs d ON d.id = c.doc_id
            WHERE c.project_id = ${projectId}
              AND c.embedding IS NOT NULL
              AND d.doc_type = ANY(${preferredTypes})
            ORDER BY c.embedding <=> ${lit}::vector
            LIMIT ${limit}
          `
        : await sql`
            SELECT c.content, c.chunk_index, d.title, d.doc_type, d.id AS doc_id,
                   1 - (c.embedding <=> ${lit}::vector) AS score
            FROM sdlc_knowledge_chunks c
            JOIN sdlc_knowledge_docs d ON d.id = c.doc_id
            WHERE c.project_id = ${projectId}
              AND c.embedding IS NOT NULL
            ORDER BY c.embedding <=> ${lit}::vector
            LIMIT ${limit}
          `
      if (rows.length) {
        return {
          chunks: rows.map((r) => ({
            title: r.title,
            docType: r.doc_type,
            content: r.content,
            score: Number(r.score)
          })),
          provider: embeddingProvider()
        }
      }
    } catch {
      // Fall through to JSON ranking.
    }
  }

  const all = preferredTypes?.length
    ? await sql`
        SELECT c.content, c.chunk_index, c.embedding_json, d.title, d.doc_type
        FROM sdlc_knowledge_chunks c
        JOIN sdlc_knowledge_docs d ON d.id = c.doc_id
        WHERE c.project_id = ${projectId}
          AND d.doc_type = ANY(${preferredTypes})
      `
    : await sql`
        SELECT c.content, c.chunk_index, c.embedding_json, d.title, d.doc_type
        FROM sdlc_knowledge_chunks c
        JOIN sdlc_knowledge_docs d ON d.id = c.doc_id
        WHERE c.project_id = ${projectId}
      `

  const ranked = rankChunks(all, queryVec, limit)
  return {
    chunks: ranked.map((r) => ({
      title: r.title,
      docType: r.doc_type,
      content: r.content,
      score: r.score
    })),
    provider: embeddingProvider()
  }
}

/** Format retrieved chunks for injection into a system prompt. */
export function formatRetrievedContext(chunks) {
  if (!chunks?.length) return ''
  const body = chunks.map((c, i) => (
    `[${i + 1}] ${c.title} (${c.docType}, score ${(c.score ?? 0).toFixed(3)})\n${c.content}`
  )).join('\n\n')
  return `${RAG_HEADER}\n\n${body}`
}

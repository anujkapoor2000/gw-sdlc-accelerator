// RAG indexing and retrieval for per-project knowledge.

import { chunkText, artifactToText } from './chunking.js'
import { cosineSimilarity, embedTexts, embeddingProvider } from './embeddings.js'
import { ensureSchema, isPgvectorReady } from './schema.js'

const MODULE_DOC_TYPES = {
  'story-forge': ['standard', 'notes', 'artifact', 'playbook'],
  'code-review': ['standard', 'artifact', 'notes', 'playbook'],
  'test-strategist': ['standard', 'artifact', 'playbook', 'notes'],
  'flow-automator': ['standard', 'artifact', 'playbook', 'notes'],
  'test-migrator': ['standard', 'artifact', 'playbook', 'notes'],
  'release-navigator': ['inventory', 'standard', 'artifact', 'notes'],
  'defect-triage': ['playbook', 'artifact', 'notes', 'standard']
}

const RAG_HEADER = `PROJECT KNOWLEDGE (retrieved) — client-specific material for this engagement.
Prefer these excerpts when they apply. If they conflict with generic guidance, favour project knowledge for client-specific conventions.`

function vectorLiteral(vec) {
  return `[${vec.map((v) => Number(v).toFixed(8)).join(',')}]`
}

async function insertChunk(sql, { docId, projectId, chunkIndex, content, embedding, usePg }) {
  const json = JSON.stringify(embedding)
  if (usePg) {
    const lit = vectorLiteral(embedding)
    await sql`
      INSERT INTO sdlc_knowledge_chunks (doc_id, project_id, chunk_index, content, embedding_json, embedding)
      VALUES (
        ${docId},
        ${projectId},
        ${chunkIndex},
        ${content},
        ${json}::jsonb,
        ${lit}::vector
      )
    `
  } else {
    await sql`
      INSERT INTO sdlc_knowledge_chunks (doc_id, project_id, chunk_index, content, embedding_json)
      VALUES (${docId}, ${projectId}, ${chunkIndex}, ${content}, ${json}::jsonb)
    `
  }
}

/** Index a knowledge document: chunk, embed, store. */
export async function indexKnowledgeDoc(sql, doc) {
  const { pgvector } = await ensureSchema(sql)
  const chunks = chunkText(doc.content)
  if (!chunks.length) return 0

  await sql`DELETE FROM sdlc_knowledge_chunks WHERE doc_id = ${doc.id}`
  const embeddings = await embedTexts(chunks)

  for (let i = 0; i < chunks.length; i++) {
    await insertChunk(sql, {
      docId: doc.id,
      projectId: doc.project_id,
      chunkIndex: i,
      content: chunks[i],
      embedding: embeddings[i],
      usePg: pgvector && isPgvectorReady()
    })
  }

  await sql`
    UPDATE sdlc_knowledge_docs
    SET chunk_count = ${chunks.length}, updated_at = now()
    WHERE id = ${doc.id}
  `
  return chunks.length
}

/** Create and index a new knowledge document. */
export async function addKnowledgeDoc(sql, { projectId, title, docType, content, source = 'paste', metadata = {} }) {
  await ensureSchema(sql)
  const rows = await sql`
    INSERT INTO sdlc_knowledge_docs (project_id, title, doc_type, source, content, metadata)
    VALUES (
      ${projectId},
      ${title},
      ${docType || 'notes'},
      ${source},
      ${content},
      ${JSON.stringify(metadata)}::jsonb
    )
    RETURNING id, project_id, title, doc_type, source, chunk_count, created_at, updated_at
  `
  const doc = rows[0]
  const count = await indexKnowledgeDoc(sql, { ...doc, content })
  return { ...doc, chunk_count: count }
}

/** Delete a knowledge document and its chunks. */
export async function deleteKnowledgeDoc(sql, id) {
  await ensureSchema(sql)
  await sql`DELETE FROM sdlc_knowledge_docs WHERE id = ${id}`
}

/** List knowledge docs for a project. */
export async function listKnowledgeDocs(sql, projectId) {
  await ensureSchema(sql)
  return sql`
    SELECT id, title, doc_type, source, chunk_count, metadata, created_at, updated_at
    FROM sdlc_knowledge_docs
    WHERE project_id = ${projectId}
    ORDER BY updated_at DESC
  `
}

/** Index saved artifacts not yet present in knowledge. */
export async function syncArtifactsToKnowledge(sql, projectId) {
  await ensureSchema(sql)
  const artifacts = await sql`
    SELECT id, module, title, content
    FROM sdlc_artifacts
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `
  const existing = await sql`
    SELECT metadata FROM sdlc_knowledge_docs
    WHERE project_id = ${projectId} AND source = 'artifact-sync'
  `
  const indexed = new Set(
    existing.map((r) => r.metadata?.source_artifact_id).filter(Boolean)
  )

  let added = 0
  for (const art of artifacts) {
    if (indexed.has(art.id)) continue
    await addKnowledgeDoc(sql, {
      projectId,
      title: art.title,
      docType: 'artifact',
      source: 'artifact-sync',
      content: artifactToText(art),
      metadata: { source_artifact_id: art.id, module: art.module }
    })
    added++
  }
  return { added, total: artifacts.length }
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

  // JSON + in-memory ranking fallback when pgvector is unavailable.
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

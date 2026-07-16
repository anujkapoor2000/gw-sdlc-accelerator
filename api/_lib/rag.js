// RAG indexing for per-project knowledge (Node.js serverless — uses fs via codebase.js).

import { collectCodebaseFiles, readCodebaseFile, resolvePreset } from './codebase.js'
import { chunkText, artifactToText } from './chunking.js'
import { embedTexts } from './embeddings.js'
import { ensureSchema, isPgvectorReady } from './schema.js'

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

/** Replace codebase-indexed docs for a project and re-index from repo paths. */
export async function syncCodebaseToKnowledge(sql, projectId, { paths, preset } = {}) {
  await ensureSchema(sql)
  let pathList = Array.isArray(paths) ? paths : []
  if (preset) pathList = [...pathList, ...resolvePreset(preset)]
  pathList = [...new Set(pathList.map((p) => String(p).trim()).filter(Boolean))]
  if (!pathList.length) throw new Error('paths or preset is required')

  await sql`
    DELETE FROM sdlc_knowledge_docs
    WHERE project_id = ${projectId} AND source = 'codebase-sync'
  `

  const files = collectCodebaseFiles(pathList)
  let added = 0
  let skipped = 0

  for (const file of files) {
    try {
      const content = readCodebaseFile(file)
      if (!content.trim()) { skipped++; continue }
      await addKnowledgeDoc(sql, {
        projectId,
        title: file.relativePath,
        docType: 'codebase',
        source: 'codebase-sync',
        content,
        metadata: { path: file.relativePath, sync_paths: pathList }
      })
      added++
    } catch {
      skipped++
    }
  }

  return { added, skipped, scanned: files.length, paths: pathList }
}

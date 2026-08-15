import { deleteSourceChunks, insertChunk, updateSourceStatus } from './knowledgeDb.js'
import { chunkArtifact } from './knowledgeChunker.js'
import { embedTexts } from './knowledgeEmbed.js'

export async function syncArtifactsForProject(sql, projectId) {
  const artifacts = await sql`
    SELECT id, module, title, content, created_at
    FROM sdlc_artifacts
    WHERE project_id = ${projectId} AND module = 'defect-triage'
    ORDER BY created_at DESC
    LIMIT 200
  `

  let source = await sql`
    SELECT id FROM sdlc_knowledge_sources
    WHERE project_id = ${projectId} AND source_type = 'artifact'
    LIMIT 1
  `

  if (!source.length) {
    source = await sql`
      INSERT INTO sdlc_knowledge_sources (project_id, source_type, label, config, sync_status)
      VALUES (${projectId}, 'artifact', 'Prior triage artifacts', ${JSON.stringify({ auto: true })}, 'syncing')
      RETURNING id
    `
  } else {
    await sql`
      UPDATE sdlc_knowledge_sources SET sync_status = 'syncing', sync_error = NULL WHERE id = ${source[0].id}
    `
  }

  const sourceId = source[0].id
  await deleteSourceChunks(sql, sourceId)

  let count = 0
  const batch = []

  for (const artifact of artifacts) {
    const chunks = chunkArtifact(artifact)
    for (const chunk of chunks) {
      batch.push({ ...chunk, artifactId: artifact.id, createdAt: artifact.created_at })
    }
  }

  const embeddings = await embedTexts(batch.map((b) => b.chunkText.slice(0, 8000))).catch(() => batch.map(() => null))

  for (let i = 0; i < batch.length; i++) {
    const b = batch[i]
    await insertChunk(sql, {
      projectId,
      sourceId,
      citeKey: b.citeKey,
      chunkText: b.chunkText,
      path: b.path,
      lineStart: b.lineStart,
      lineEnd: b.lineEnd,
      language: b.language,
      product: b.product,
      sourceType: 'artifact',
      embedding: embeddings[i],
      metadata: { artifactId: b.artifactId, title: artifacts.find((a) => a.id === b.artifactId)?.title, createdAt: b.createdAt }
    })
    count++
  }

  await updateSourceStatus(sql, sourceId, { status: 'ready', chunkCount: count })
  return { sourceId, chunkCount: count, artifactCount: artifacts.length }
}

export async function syncDocUpload(sql, { projectId, label, filename, content }) {
  const { chunkTextFile } = await import('./knowledgeChunker.js')

  const sourceRows = await sql`
    INSERT INTO sdlc_knowledge_sources (project_id, source_type, label, config, sync_status)
    VALUES (${projectId}, 'doc', ${label || filename}, ${JSON.stringify({ filename })}, 'syncing')
    RETURNING id
  `
  const sourceId = sourceRows[0].id

  const chunks = chunkTextFile({ path: filename, content, sourceType: 'doc' })
  const embeddings = await embedTexts(chunks.map((c) => c.chunkText.slice(0, 8000))).catch(() => chunks.map(() => null))

  let count = 0
  for (let i = 0; i < chunks.length; i++) {
    await insertChunk(sql, {
      projectId,
      sourceId,
      citeKey: chunks[i].citeKey,
      chunkText: chunks[i].chunkText,
      path: chunks[i].path,
      lineStart: chunks[i].lineStart,
      lineEnd: chunks[i].lineEnd,
      language: chunks[i].language,
      product: chunks[i].product,
      sourceType: 'doc',
      embedding: embeddings[i],
      metadata: { filename }
    })
    count++
  }

  await updateSourceStatus(sql, sourceId, { status: 'ready', chunkCount: count })
  return { sourceId, chunkCount: count }
}

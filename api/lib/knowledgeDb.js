// Shared knowledge-layer DB helpers for /api/knowledge.js

let schemaReady = false
let vectorReady = false

export async function ensureKnowledgeSchema(sql) {
  if (schemaReady) return { vectorReady }

  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      client TEXT DEFAULT '',
      product TEXT DEFAULT 'InsuranceSuite',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
      module TEXT NOT NULL,
      title TEXT NOT NULL,
      content JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_knowledge_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      label TEXT NOT NULL,
      config JSONB DEFAULT '{}',
      chunk_count INT DEFAULT 0,
      last_synced_at TIMESTAMPTZ,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_knowledge_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
      source_id UUID NOT NULL REFERENCES sdlc_knowledge_sources(id) ON DELETE CASCADE,
      cite_key TEXT NOT NULL,
      chunk_text TEXT NOT NULL,
      path TEXT,
      line_start INT,
      line_end INT,
      language TEXT,
      product TEXT,
      source_type TEXT,
      search_vector tsvector,
      embedding_json JSONB,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_knowledge_sync_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
      source_id UUID REFERENCES sdlc_knowledge_sources(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'running',
      started_at TIMESTAMPTZ DEFAULT now(),
      finished_at TIMESTAMPTZ,
      error TEXT,
      stats JSONB DEFAULT '{}'
    )
  `

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`
    vectorReady = true
  } catch {
    vectorReady = false
  }

  schemaReady = true
  return { vectorReady }
}

export async function deleteSourceChunks(sql, sourceId) {
  await sql`DELETE FROM sdlc_knowledge_chunks WHERE source_id = ${sourceId}`
}

export async function insertChunk(sql, chunk) {
  const {
    projectId, sourceId, citeKey, chunkText, path, lineStart, lineEnd,
    language, product, sourceType, embedding, metadata
  } = chunk

  const rows = await sql`
    INSERT INTO sdlc_knowledge_chunks (
      project_id, source_id, cite_key, chunk_text, path, line_start, line_end,
      language, product, source_type, search_vector, embedding_json, metadata
    ) VALUES (
      ${projectId},
      ${sourceId},
      ${citeKey},
      ${chunkText},
      ${path || null},
      ${lineStart ?? null},
      ${lineEnd ?? null},
      ${language || null},
      ${product || null},
      ${sourceType || null},
      to_tsvector('english', ${chunkText}),
      ${embedding ? JSON.stringify(embedding) : null},
      ${JSON.stringify(metadata || {})}
    )
    RETURNING id
  `
  return rows[0]?.id
}

export async function updateSourceStatus(sql, sourceId, { status, chunkCount, error }) {
  await sql`
    UPDATE sdlc_knowledge_sources
    SET sync_status = ${status},
        chunk_count = ${chunkCount ?? 0},
        last_synced_at = ${status === 'ready' ? new Date().toISOString() : null},
        sync_error = ${error || null}
    WHERE id = ${sourceId}
  `
}

/** Hybrid search: keyword (tsvector) + optional vector cosine on embedding_json. */
export async function searchChunks(sql, { projectId, queries, product, limit = 12 }) {
  const terms = [...new Set(queries.filter(Boolean).map((q) => q.trim()).filter(Boolean))]
  if (terms.length === 0) return []

  const tsQuery = terms
    .slice(0, 8)
    .map((t) => t.replace(/[^\w.*-]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' & '))
    .filter(Boolean)
    .join(' | ')

  const likePatterns = terms.slice(0, 10).map((t) => `%${t.replace(/[%_]/g, '')}%`)

  const rows = product && product !== 'Cross-suite' && product !== 'Unknown'
    ? await sql`
        SELECT id, cite_key, chunk_text, path, line_start, line_end, language, product,
               source_type, metadata, embedding_json,
               ts_rank(search_vector, to_tsquery('english', ${tsQuery || 'error'})) AS text_rank
        FROM sdlc_knowledge_chunks
        WHERE project_id = ${projectId}
          AND (product IS NULL OR product = ${product} OR product = 'Cross-suite')
          AND (
            search_vector @@ to_tsquery('english', ${tsQuery || 'error'})
            OR chunk_text ILIKE ANY(${likePatterns})
            OR path ILIKE ANY(${likePatterns})
            OR cite_key ILIKE ANY(${likePatterns})
          )
        ORDER BY text_rank DESC NULLS LAST
        LIMIT ${Math.min(limit * 3, 40)}
      `
    : await sql`
        SELECT id, cite_key, chunk_text, path, line_start, line_end, language, product,
               source_type, metadata, embedding_json,
               ts_rank(search_vector, to_tsquery('english', ${tsQuery || 'error'})) AS text_rank
        FROM sdlc_knowledge_chunks
        WHERE project_id = ${projectId}
          AND (
            search_vector @@ to_tsquery('english', ${tsQuery || 'error'})
            OR chunk_text ILIKE ANY(${likePatterns})
            OR path ILIKE ANY(${likePatterns})
            OR cite_key ILIKE ANY(${likePatterns})
          )
        ORDER BY text_rank DESC NULLS LAST
        LIMIT ${Math.min(limit * 3, 40)}
      `

  const scored = rows.map((row) => {
    let score = Number(row.text_rank) || 0
    const lower = row.chunk_text.toLowerCase()
    for (const term of terms) {
      const t = term.toLowerCase()
      if (lower.includes(t)) score += 0.5
      if (row.path?.toLowerCase().includes(t)) score += 1
      if (row.cite_key?.toLowerCase().includes(t)) score += 0.8
    }
    return { ...row, score }
  })

  scored.sort((a, b) => b.score - a.score)

  const seen = new Set()
  const out = []
  for (const row of scored) {
    if (seen.has(row.cite_key)) continue
    seen.add(row.cite_key)
    out.push({
      id: row.id,
      citeKey: row.cite_key,
      text: row.chunk_text,
      path: row.path,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      language: row.language,
      product: row.product,
      sourceType: row.source_type,
      metadata: row.metadata,
      score: row.score
    })
    if (out.length >= limit) break
  }
  return out
}

export async function getKnowledgeStatus(sql, projectId) {
  const sources = await sql`
    SELECT id, source_type, label, config, chunk_count, last_synced_at, sync_status, sync_error, created_at
    FROM sdlc_knowledge_sources
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `
  const totals = await sql`
    SELECT COUNT(*)::int AS chunk_count
    FROM sdlc_knowledge_chunks
    WHERE project_id = ${projectId}
  `
  const lastJob = await sql`
    SELECT id, status, started_at, finished_at, error, stats
    FROM sdlc_knowledge_sync_jobs
    WHERE project_id = ${projectId}
    ORDER BY started_at DESC
    LIMIT 1
  `
  return {
    sources,
    chunkCount: totals[0]?.chunk_count || 0,
    lastJob: lastJob[0] || null
  }
}

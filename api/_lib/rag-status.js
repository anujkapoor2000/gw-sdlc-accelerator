// RAG / Voyage / database status for UI and health checks.

import { getEmbeddingConfig } from './embeddings.js'
import { isPgvectorReady } from './schema.js'

/** Return embedding provider, database, and pgvector readiness. */
export async function getRagStatus(sql) {
  const embedding = getEmbeddingConfig()
  let docCount = 0
  let chunkCount = 0

  if (sql) {
    try {
      const [docs] = await sql`SELECT COUNT(*)::int AS n FROM sdlc_knowledge_docs`
      const [chunks] = await sql`SELECT COUNT(*)::int AS n FROM sdlc_knowledge_chunks`
      docCount = docs?.n ?? 0
      chunkCount = chunks?.n ?? 0
    } catch {
      // Tables may not exist yet.
    }
  }

  return {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    pgvectorEnabled: isPgvectorReady(),
    autoIndexArtifacts: process.env.RAG_AUTO_INDEX_ARTIFACTS !== 'false',
    embedding,
    storage: {
      docCount,
      chunkCount
    },
    setup: {
      required: ['DATABASE_URL', 'ANTHROPIC_API_KEY'],
      recommended: ['VOYAGE_API_KEY'],
      optional: ['VOYAGE_EMBEDDING_MODEL', 'OPENAI_API_KEY', 'OPENAI_EMBEDDING_MODEL']
    }
  }
}

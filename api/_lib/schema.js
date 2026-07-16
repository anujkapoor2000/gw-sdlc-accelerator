// Shared DB schema — projects, artifacts, knowledge docs + RAG chunks.

import { neon } from '@neondatabase/serverless'

let schemaReady = false
let pgvectorReady = false

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }
  return neon(process.env.DATABASE_URL)
}

export function isPgvectorReady() {
  return pgvectorReady
}

export async function ensureSchema(sql = getSql()) {
  if (schemaReady) return { pgvector: pgvectorReady }

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
    CREATE TABLE IF NOT EXISTS sdlc_knowledge_docs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      doc_type TEXT NOT NULL DEFAULT 'notes',
      source TEXT NOT NULL DEFAULT 'paste',
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      chunk_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_knowledge_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doc_id UUID NOT NULL REFERENCES sdlc_knowledge_docs(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      embedding_json JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON sdlc_knowledge_docs(project_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_project ON sdlc_knowledge_chunks(project_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON sdlc_knowledge_chunks(doc_id)`

  await sql`ALTER TABLE sdlc_knowledge_docs ADD COLUMN IF NOT EXISTS embedding_provider TEXT`
  await sql`ALTER TABLE sdlc_knowledge_docs ADD COLUMN IF NOT EXISTS embedding_model TEXT`

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`
    await sql`ALTER TABLE sdlc_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(512)`
    pgvectorReady = true
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
        ON sdlc_knowledge_chunks USING hnsw (embedding vector_cosine_ops)
      `
    } catch {
      // HNSW may be unavailable on some Neon tiers — pgvector column still works.
    }
  } catch {
    pgvectorReady = false
  }

  schemaReady = true
  return { pgvector: pgvectorReady }
}

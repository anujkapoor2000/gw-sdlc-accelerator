-- Reference schema. The API auto-creates these tables on first request,
-- so running this manually in the Neon SQL editor is optional.

CREATE TABLE IF NOT EXISTS sdlc_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT DEFAULT '',
  product TEXT DEFAULT 'InsuranceSuite',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdlc_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-project knowledge for RAG (client standards, inventories, synced artifacts)
CREATE TABLE IF NOT EXISTS sdlc_knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'notes',
  source TEXT NOT NULL DEFAULT 'paste',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  chunk_count INT NOT NULL DEFAULT 0,
  embedding_provider TEXT,
  embedding_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdlc_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES sdlc_knowledge_docs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON sdlc_knowledge_docs(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_project ON sdlc_knowledge_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON sdlc_knowledge_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_project ON sdlc_artifacts(project_id);

-- Optional: enable pgvector in Neon SQL editor for faster similarity search at scale
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE sdlc_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(512);
-- CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
--   ON sdlc_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

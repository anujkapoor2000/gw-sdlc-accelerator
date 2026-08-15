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

-- Project knowledge layer (Defect Triage grounding)
-- Enable pgvector in Neon SQL editor if not already: CREATE EXTENSION vector;

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
);

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
);

CREATE TABLE IF NOT EXISTS sdlc_knowledge_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sdlc_knowledge_sources(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error TEXT,
  stats JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_project ON sdlc_knowledge_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_project ON sdlc_knowledge_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON sdlc_knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search ON sdlc_knowledge_chunks USING gin(search_vector);

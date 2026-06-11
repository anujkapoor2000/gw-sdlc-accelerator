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
  module TEXT NOT NULL,           -- code-review | release-navigator | story-forge | test-strategist
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- In DO Time v2 — Release document drafts

CREATE TABLE release_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode TEXT NOT NULL CHECK (mode IN ('internal', 'client')),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL,
  structured_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_observation_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'fallback')),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_release_documents_scope ON release_documents(mode, trail_id, end_date DESC);
CREATE INDEX idx_release_documents_created_at ON release_documents(created_at DESC);

DROP TRIGGER IF EXISTS update_release_documents_updated_at ON release_documents;
CREATE TRIGGER update_release_documents_updated_at
  BEFORE UPDATE ON release_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE release_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for release_documents" ON release_documents FOR ALL USING (true) WITH CHECK (true);

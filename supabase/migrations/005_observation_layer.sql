-- In DO Time v2 — Observation layer foundation

-- Observations emitted by agents/tools.
CREATE TABLE observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  related_trail_id UUID REFERENCES trails(id) ON DELETE SET NULL,
  related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Tasks fold into open loops; manual order is scoped to a project.
CREATE TABLE open_loops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'abandoned')),
  "order" INTEGER NOT NULL DEFAULT 0,
  parsed_tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ
);

-- Small ordered checklist per project.
ALTER TABLE projects
  ADD COLUMN phases JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Nightly reflection journal.
CREATE TABLE journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_date DATE NOT NULL UNIQUE,
  content TEXT NOT NULL,
  parsed_tags JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_observations_created_at ON observations(created_at DESC);
CREATE INDEX idx_observations_related_trail ON observations(related_trail_id);
CREATE INDEX idx_observations_related_project ON observations(related_project_id);
CREATE INDEX idx_open_loops_project_order ON open_loops(project_id, "order");
CREATE INDEX idx_open_loops_status ON open_loops(status);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date DESC);

DROP TRIGGER IF EXISTS update_open_loops_updated_at ON open_loops;
CREATE TRIGGER update_open_loops_updated_at
  BEFORE UPDATE ON open_loops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for observations" ON observations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for open_loops" ON open_loops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for journal_entries" ON journal_entries FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_source_observation_id_fkey
  FOREIGN KEY (source_observation_id) REFERENCES observations(id) ON DELETE SET NULL;

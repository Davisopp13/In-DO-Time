-- In DO Time v2 — Destructive Schema Reset
-- WARNING: This drops all v1 tables and creates v2 schema from scratch.
-- Davis has confirmed no production data worth preserving.
-- Run manually in Supabase SQL Editor after Ralph completes this run.

-- ============================================================
-- STEP 1: DROP TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;

-- ============================================================
-- STEP 2: DROP V1 TABLES (cascade handles FK children)
-- ============================================================

DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- ============================================================
-- STEP 3: CREATE V2 TABLES
-- ============================================================

-- Trails (replaces v1 clients; top-level entity)
CREATE TABLE trails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('client', 'employer', 'personal', 'project')),
  is_billable BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT DEFAULT '#3A7D44',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (re-parented to trails)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rates (time-versioned, trail or project level)
CREATE TABLE rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  hourly_rate DECIMAL(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

-- Time entries (pure intervals; notes = invoice line description only)
CREATE TABLE time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_running BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'manual',
  -- source_observation_id: column exists but FK deferred to run #2 (observations table not yet created)
  source_observation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 4: CREATE INDEXES
-- ============================================================

CREATE INDEX idx_projects_trail ON projects(trail_id);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_start ON time_entries(start_time);
CREATE INDEX idx_time_entries_running ON time_entries(is_running) WHERE is_running = TRUE;
CREATE INDEX idx_rates_trail ON rates(trail_id);
CREATE INDEX idx_rates_project ON rates(project_id);
CREATE INDEX idx_rates_effective ON rates(effective_from, effective_until);
CREATE INDEX idx_trails_status ON trails(status, display_order);

-- ============================================================
-- STEP 5: CREATE TRIGGERS
-- ============================================================

-- Reuse existing trigger function (created in 001_initial_schema.sql)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trails_updated_at ON trails;
CREATE TRIGGER update_trails_updated_at
  BEFORE UPDATE ON trails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- No trigger on rates — rate rows are immutable once created.
-- Rate changes mean inserting a new row, not updating in place.

-- ============================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 7: CREATE RLS POLICIES
-- ============================================================

-- Single-user app, no auth — permissive anon policy per table
CREATE POLICY "Allow all for trails" ON trails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for rates" ON rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for time_entries" ON time_entries FOR ALL USING (true) WITH CHECK (true);

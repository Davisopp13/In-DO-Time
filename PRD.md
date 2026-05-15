# In DO Time v2 — Foundation PRD

> Reset In DO Time around "trails" — the v2 conceptual model. This run lays the foundation. Journal, observations, and briefing come in run #2.

## Project Overview

In DO Time v2 is a personal work observation and orientation system. The v1 app was a DO Code Lab billable-hours tracker; v2 reframes that single use case into one trail (a billable client trail) within a broader system that also covers employer work (Hapag-Lloyd), personal projects (DObot, In DO Time itself), and other contexts. This Ralph run rebuilds the foundation: new schema with `trails` replacing `clients`, a `rates` ledger for time-versioned billing, ported timer engine, and updated dashboard. Journal, observations, and morning briefing are explicitly OUT of scope for this run.

## Architecture & Key Decisions

These are settled. Ralph should NOT question or change them.

- **Framework:** Next.js 16 (App Router), already in use
- **Database:** Supabase (Postgres) with RLS, single-user (no auth), already in use
- **Types:** TypeScript, `Database` type in `src/types/database.ts` is the source of truth
- **Styling:** Tailwind CSS 4, `next-themes` for light/dark, `lucide-react` for icons
- **State:** No new state library. React state + Supabase queries, same pattern as v1.
- **Testing:** Vitest, `npm run test`. Typecheck via `npx tsc --noEmit`. Build via `npm run build`.
- **Migrations:** Ralph writes SQL migration files to `supabase/migrations/`. Davis runs them manually in Supabase SQL Editor before deploy.

### Conceptual model (the v2 mental picture)

- **Trails** replace the v1 `clients` table. A trail is a top-level area of work life (B.B., Mariah, Hapag-Lloyd, DObot, In DO Time, Personal).
- **Projects** live under trails (unchanged in shape, just re-parented).
- **Time entries** stay shape-compatible but lose any implicit rate. They are pure intervals.
- **Rates** become their own table — time-versioned, attachable to a trail or to a specific project, with `effective_from` and optional `effective_until`.
- **Notes on time entries** stay, but conceptually mean *invoice line description only*. Substantive "what happened" content will live in observations and journal entries in run #2.

### Naming conventions

- Schema/code: `trails`, `projects`, `time_entries`, `rates`
- UI copy: "Trails" (sidebar header, page title). Buttons/forms stay neutral ("Add trail", "Trail name") — do not over-theme.

## Schema (Destructive Reset)

This Ralph run produces ONE new migration file: `supabase/migrations/003_v2_schema_reset.sql`.

The migration is **destructive** — it DROPs the v1 tables and CREATEs the v2 tables. Davis has no production data worth preserving. Migration order: DROP triggers → DROP tables → CREATE tables → CREATE indexes → CREATE triggers → ENABLE RLS → CREATE policies → seed minimal default trails.

### Target schema

```sql
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
  -- source_observation_id: column exists but FK constraint deferred to run #2
  source_observation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_trail ON projects(trail_id);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_start ON time_entries(start_time);
CREATE INDEX idx_time_entries_running ON time_entries(is_running) WHERE is_running = TRUE;
CREATE INDEX idx_rates_trail ON rates(trail_id);
CREATE INDEX idx_rates_project ON rates(project_id);
CREATE INDEX idx_rates_effective ON rates(effective_from, effective_until);
CREATE INDEX idx_trails_status ON trails(status, display_order);
```

Standard `updated_at` triggers on `trails`, `projects`, `time_entries` (same pattern as v1 migration `001_initial_schema.sql`). No trigger on `rates` — rate rows are immutable once created; rate changes mean inserting a new row.

RLS: enable on all four tables, single permissive policy per table for `anon` (same pattern as v1 — single-user app).

### Seed data (in migration `004_v2_seed_trails.sql`)

Seed these default trails so the dashboard isn't empty on first run:

| Name | Slug | Kind | Billable | Color |
|------|------|------|----------|-------|
| B.B. | bb | client | TRUE | `#3A7D44` |
| Evermore Equine | evermore-equine | client | TRUE | `#8B4513` |
| Hapag-Lloyd | hapag-lloyd | employer | FALSE | `#003D6B` |
| DObot | dobot | project | FALSE | `#6B46C1` |
| In DO Time | in-do-time | project | FALSE | `#1B5E20` |
| Personal | personal | personal | FALSE | `#6B7280` |

Also seed one rate for each client trail at `$50/hr` effective `2026-01-01` with `effective_until = NULL`. Davis can edit these via the UI later.

## File Structure (target)

```
src/
  app/
    page.tsx                  -- dashboard (updated)
    trails/                   -- renamed from clients/
      page.tsx                -- list trails
      [id]/page.tsx           -- trail detail (projects + rates + recent entries)
    projects/
      page.tsx                -- list projects (across trails)
    time-log/
      page.tsx                -- chronological time entries (updated)
    reports/
      page.tsx                -- CSV export (updated)
  components/
    Dashboard.tsx             -- updated for trails
    Header.tsx                -- updated nav: Trails | Time Log | Reports
    TrailCard.tsx             -- new
    ActiveTimers.tsx          -- minor updates
    [theme components unchanged]
  lib/
    supabase.ts               -- unchanged
    supabaseDemo.ts           -- updated for new schema
    timer.ts                  -- updated (rate decoupling)
    rates.ts                  -- NEW: rate lookup helpers
    csv.ts                    -- updated for new schema
    mockData.ts               -- updated for new schema
    seed.ts                   -- updated for new schema
  types/
    database.ts               -- regenerated for new schema
  hooks/
    useRunningTimers.ts       -- minor updates
supabase/
  migrations/
    003_v2_schema_reset.sql   -- NEW
    004_v2_seed_trails.sql    -- NEW
```

Note: the v1 `clients/` route directory gets removed entirely. Do not preserve it.

## Environment & Setup

Already configured in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEMO_MODE`

Demo mode (`supabaseDemo.ts`) must continue to work and serve mock data matching the new schema.

## Tasks

### Phase 1: Schema & Types

- [x] **Task 1: Write destructive migration SQL**
  - Create `supabase/migrations/003_v2_schema_reset.sql` exactly as specified in the Schema section above.
  - File should DROP v1 tables (`time_entries`, `projects`, `clients`), then CREATE v2 tables (`trails`, `projects`, `rates`, `time_entries`), indexes, triggers, RLS, and policies.
  - Test: SQL file parses (use `npx supabase db lint` if available, otherwise visually verify against schema spec).
  - Acceptance: file exists, contains all four CREATE TABLE statements, all listed indexes, RLS enabled.

- [x] **Task 2: Write seed migration SQL**
  - Create `supabase/migrations/004_v2_seed_trails.sql` with the seed trails table and seed rates rows from the spec.
  - Test: SQL file parses.
  - Acceptance: file contains 6 trail INSERTs and 2 rate INSERTs (one for each client trail).

- [x] **Task 3: Rewrite `src/types/database.ts`**
  - Replace the v1 `Database` type entirely. Define types for `trails`, `projects`, `rates`, `time_entries` matching the new schema exactly (Row/Insert/Update for each).
  - Export convenience types: `Trail`, `TrailInsert`, `TrailUpdate`, `Project`, `ProjectInsert`, `ProjectUpdate`, `Rate`, `RateInsert`, `RateUpdate`, `TimeEntry`, `TimeEntryInsert`, `TimeEntryUpdate`.
  - Delete the old `Client` exports entirely.
  - Test: `npx tsc --noEmit` — will fail in other files referencing `Client`. Ralph should expect this and proceed; later tasks fix the references.
  - Acceptance: file defines all four tables, exports listed convenience types.

### Phase 2: Core Library Layer

- [x] **Task 4: Create `src/lib/rates.ts` rate-lookup helper**
  - Export `getEffectiveRate(trailId: string, projectId: string | null, atDate: Date): Promise<number | null>`.
  - Logic: prefer the most recent rate row where `project_id = projectId` AND `effective_from <= atDate` AND (`effective_until IS NULL OR effective_until >= atDate`). Fall back to trail-level rate (`project_id IS NULL`) with same date constraints. Return null if no rate found.
  - Also export `computeEntryCost(entry: TimeEntry, trailId: string): Promise<number>` that uses `getEffectiveRate` against the entry's `start_time`.
  - Test: write a Vitest unit test in `src/__tests__/rates.test.ts` with mock data covering: project rate wins over trail rate, fallback to trail when no project rate, returns null when no rate exists, time-effectivity (rate change between two dates).
  - Acceptance: tests pass with `npm run test`.

- [x] **Task 5: Update `src/lib/timer.ts` for trails**
  - Remove any references to clients or implicit rate-on-entry.
  - Timer functions (`startTimer`, `stopTimer`, `pauseTimer`, `resumeTimer`, `getRunningTimers`, etc.) operate on `project_id` as before, but make no assumptions about rate.
  - Add `source: 'manual'` to inserts (the new column).
  - Cost computation is NOT done inside timer.ts — callers use `rates.ts` when they need cost.
  - Test: `npx tsc --noEmit` passes for this file.
  - Acceptance: no `client` or `client_id` references remain in `timer.ts`. All inserts include `source`.

- [x] **Task 6: Update `src/lib/supabaseDemo.ts` for new schema**
  - Replace mock client data with mock trail data matching the seed table.
  - Update all queries the demo client handles (`from('clients')` → `from('trails')`, add `from('rates')`, etc.).
  - Mock rate lookups must work for the demo client trails.
  - Test: `npx tsc --noEmit` passes; `NEXT_PUBLIC_DEMO_MODE=true npm run build` succeeds.
  - Acceptance: demo mode loads without runtime errors, shows seed trails.

- [x] **Task 7: Update `src/lib/mockData.ts` and `src/lib/seed.ts`**
  - `mockData.ts`: regenerate mock data structures to match new schema (trails instead of clients).
  - `seed.ts`: if this is used at runtime for fresh installs, update it to insert trails not clients. If it's dev-only, mark it clearly.
  - Test: `npx tsc --noEmit` passes.

- [x] **Task 8: Update `src/lib/csv.ts` for new schema**
  - Export joins `time_entries` → `projects` → `trails` (was `time_entries` → `projects` → `clients`).
  - Cost column in CSV uses `computeEntryCost` from `rates.ts` for each row.
  - CSV column headers: Date, Trail, Project, Start, End, Duration, Rate (effective), Cost, Notes.
  - Test: `npx tsc --noEmit` passes; if a CSV export test exists in `__tests__`, update it.
  - Acceptance: CSV export function compiles and produces a row per time entry with correct columns.

### Phase 3: UI Layer

- [x] **Task 9: Update `src/components/Header.tsx`**
  - Replace any "Clients" nav link with "Trails".
  - Nav order: Dashboard | Trails | Time Log | Reports.
  - Keep brand: DO Code Lab logo + "In DO Time" wordmark, theme toggle.
  - Test: `npx tsc --noEmit`, `npm run build`.

- [x] **Task 10: Rename and rebuild `src/app/clients/` → `src/app/trails/`**
  - Delete `src/app/clients/` entirely.
  - Create `src/app/trails/page.tsx` — list view of all active trails, grouped by `kind` (Clients section, Work section, Personal section, Projects section).
  - Each trail card shows: name, kind badge, billable indicator (if applicable), current effective rate (if billable), color swatch.
  - "Add trail" button opens a form with: name, slug (auto-generated from name, editable), kind dropdown, is_billable checkbox (default based on kind: TRUE for client, FALSE for others), color picker, optional initial rate (only if billable).
  - On submit, if billable + rate given, also insert one rate row with `effective_from = today`.
  - Test: `npx tsc --noEmit`, `npm run build`. Visual: `npm run dev` and confirm seed trails render in grouped sections.

- [x] **Task 11: Create `src/app/trails/[id]/page.tsx` trail detail view**
  - Header: trail name, kind, edit button.
  - Sections: Projects (list, add new), Rate history (if billable — list of rate rows with effective_from/until, add new rate button), Recent time entries.
  - Adding a new rate inserts a new row AND sets the previous active rate's `effective_until` to (new rate's `effective_from` - 1 day).
  - Test: `npx tsc --noEmit`, `npm run build`.

- [x] **Task 12: Update `src/components/Dashboard.tsx`**
  - Replace v1 client-grouped cards with trail-grouped cards.
  - Show only `is_billable = TRUE` trails by default with active timer controls (preserves the billable-client workflow). Add a toggle/section for non-billable trails so Hapag-Lloyd/personal can be timed too.
  - Each project card under a trail shows: trail name, project name, live elapsed time (ticking), live cost (only if trail is billable — use `rates.ts`).
  - Start/Stop/Pause buttons per project, same UX as v1.
  - "Today's summary" block: total hours (across all trails), total billable earnings, count of entries.
  - Test: `npx tsc --noEmit`, `npm run build`. Visual: timers can be started and stopped against seed trails.

- [x] **Task 13: Update `src/app/time-log/page.tsx`**
  - Filter UI: trail dropdown (replaces client dropdown), project dropdown (cascades from trail), date range.
  - Each entry row shows: trail, project, start, end, duration, computed cost (if billable), notes.
  - Edit/delete actions preserved from v1.
  - Manual time entry: select trail → select project → set times → notes.
  - Test: `npx tsc --noEmit`, `npm run build`.

- [x] **Task 14: Update `src/app/projects/page.tsx`**
  - List view of all projects across trails. Group by trail.
  - "Add project" form: select trail → name → description → optional initial project-level rate override (only if trail is billable).
  - Edit/archive actions preserved.
  - Test: `npx tsc --noEmit`, `npm run build`.

- [x] **Task 15: Update `src/app/reports/page.tsx`**
  - Summary view grouped by trail → project.
  - Show: trail name, project name, total hours, total cost (using `computeEntryCost`).
  - CSV export filtered by trail + date range. Uses updated `csv.ts`.
  - Logo in report header preserved.
  - Test: `npx tsc --noEmit`, `npm run build`.

### Phase 4: Hooks, Tests, Final Verification

- [x] **Task 16: Update `src/hooks/useRunningTimers.ts`**
  - Adjust types and queries for new schema.
  - Test: `npx tsc --noEmit`.

- [ ] **Task 17: Update or rewrite `src/__tests__/full-loop.test.ts`**
  - Update test to use trails instead of clients.
  - Full loop: create trail → add project → start timer → stop timer → verify time entry exists with correct project_id → verify computed cost via rates.ts matches expected.
  - Test: `npm run test` passes.

- [ ] **Task 18: Full project verification**
  - `npx tsc --noEmit` passes with zero errors.
  - `npm run build` succeeds.
  - `npm run lint` passes (or only has pre-existing warnings).
  - `npm run test` passes.
  - Acceptance: all four commands clean.

- [ ] **Task 19: Update `PRD.md` archive**
  - Rename existing `PRD.md` to `PRD_v1.md` to preserve history.
  - Leave this v2 PRD as the active `PRD.md` (or write a brief `PRD_v2_summary.md` reflecting completed state).
  - Test: file rename only.

## Testing Strategy

Run in this order after every task:
1. `npx tsc --noEmit` — typecheck, fastest signal
2. `npm run test` — unit tests where they exist
3. `npm run build` — full build, catches integration issues
4. `npm run lint` — code quality, lower priority

If typecheck fails, do NOT move to the next task — fix the current one.

For visual verification during UI tasks (Tasks 9–15), if Ralph has a way to spawn `npm run dev` and check rendered output, use it. Otherwise rely on typecheck + build and trust the design will be reviewed manually by Davis.

## Out of Scope

These are NOT for this Ralph run. They come in run #2.

- Journal entries (table, UI, parser, anything related)
- Observations (table, UI, ingestion API)
- Open loops (table, UI, briefing surfacing)
- Morning briefing view
- Evening reflection view ("trail report")
- Skill ingestion infrastructure
- DObot integration / API endpoints for AI tools
- README rewrite (defer to run #2)
- Per-entry billable override flag
- Tag management UI / normalized tags table

Also explicitly NOT in scope:
- Authentication / multi-user
- Real-time sync features
- Mobile-native versions
- PDF export

## Notes for Ralph

**Patterns already in the codebase (preserve these):**
- Supabase client is accessed via `getSupabase()` from `src/lib/supabase.ts`. Do not create new clients elsewhere.
- Demo mode toggles via `NEXT_PUBLIC_DEMO_MODE`. Demo client is in `supabaseDemo.ts`. Both code paths must continue to work.
- Types flow from `src/types/database.ts` outward. Update this file FIRST in any data-shape change.
- Theme system uses `next-themes` and a small set of components (`ThemeProvider`, `ThemeToggle`, `ThemeWatcher`). Do not modify these — they already work.
- Brand assets stay: `public/DO_CODE_LAB_LOGO.png`, `public/In_DO_Time_Logo.png`, mountain backgrounds. Brand colors in `tailwind.config` or global CSS stay as defined.

**Things that will trip Ralph up if not careful:**
- The schema migration is destructive. Do NOT try to write reversible migrations or preserve v1 data — Davis has confirmed this is intentional.
- `time_entries.source_observation_id` is a column added now but with NO foreign key constraint yet (because the `observations` table doesn't exist until run #2). Just declare it as `UUID` nullable. Run #2 will add the FK.
- The trail `kind` enum has exactly four values: `client`, `employer`, `personal`, `project`. The CHECK constraint enforces this. Do not add others.
- Rate immutability: a `rates` row, once inserted, is never UPDATED in place. Changing a rate means inserting a new row and updating the previous row's `effective_until`. Build the UI around this pattern.
- `notes` on `time_entries` is now semantically "invoice line description only." Do not treat it as a general capture field — that's what observations will be in run #2.

**Migration deployment workflow:**
- Ralph commits the migration files. Ralph does NOT execute them.
- Davis runs `003_v2_schema_reset.sql` and `004_v2_seed_trails.sql` manually in Supabase SQL Editor after Ralph completes.
- If Ralph needs to query against the new schema during development (e.g., for tests), it should rely on demo mode (`supabaseDemo.ts`) rather than against live Supabase.

**Style of work:**
- Prefer small, single-concern commits per task.
- Do not refactor unrelated code "while you're in there." If a v1 pattern works and isn't on the change list, leave it.
- Adapt to existing patterns rather than introducing new ones. If unsure, match the closest v1 example.

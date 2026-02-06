# PRD.md — In DO Time

> "I'm helping!" - One task at a time. Ship fast, no scope creep.

## One-Liner
**In DO Time** — A multi-client time tracking app for DO Code Lab that lets Davis run simultaneous timers across projects and generate exportable invoices.

## Core User Loop
1. Davis opens the dashboard → sees all clients/projects with timer controls
2. Starts one or more timers (multiple can run simultaneously)
3. Works on projects, pauses/resumes as needed → stops timer → time entry auto-logs
4. At invoicing time → filters by client + date range → exports CSV report

## Tech Stack
- **Framework:** Next.js (App Router)
- **Database:** Supabase (Postgres)
- **Auth:** None for MVP (single user — just Davis)
- **Styling:** TailwindCSS
- **Deployment:** Vercel
- **CSV Export:** Native JS
- **PDF Export:** Stretch goal — @react-pdf/renderer or html2pdf

## DO Code Lab Branding

### Logo
- File: `public/DO_CODE_LAB_LOGO_NO_TEXT.png`
- Use in: app header/nav (32-40px height), report exports (larger, top of page), empty states (centered watermark), and generate a favicon from it
- The logo is the "DO" letterforms with mountain imagery in green gradient — no text included, always pair with "In DO Time" or "DO Code Lab" text beside it

### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#3A7D44` | Forest green — buttons, links, nav |
| Primary Dark | `#1B5E20` | Hover/active states |
| Primary Light | `#E8F5E9` | Soft backgrounds, cards |
| Surface | `#F1F8F2` | Subtle green tint on page bg |
| Accent | `#D97706` | Warm amber — active/running timer indicators |
| Accent Light | `#F59E0B` | Hover on accent elements |
| Text | `#1F2937` | Primary text |
| Text Muted | `#6B7280` | Secondary text |
| Border | `#E5E7EB` | Default borders |
| Background | `#FFFFFF` | Main background |

### Typography
- **Headings:** Playfair Display (Google Fonts)
- **Body:** Inter (Google Fonts)

### Design Tokens
- Border radius: 8px (buttons, inputs), 12px (cards)
- Shadows: subtle `0 1px 3px rgba(0,0,0,0.1)` for cards
- Spacing: 8px grid system (8, 16, 24, 32, 48, 64px)

## Database Schema

```sql
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3A7D44',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hourly_rate_override DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  is_manual BOOLEAN DEFAULT FALSE,
  is_running BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_start ON time_entries(start_time);
CREATE INDEX idx_projects_client ON projects(client_id);
```

## This Sprint's Scope

### Phase 1: Foundation (Days 1-2)
- [x] Scaffold Next.js project with TailwindCSS and App Router
- [x] Set up Supabase client and environment variables
- [x] Run database schema migration (create all 3 tables + indexes)
- [x] Place DO Code Lab logo in `public/` and generate favicon
- [x] Create app layout with branded header (logo + "In DO Time" + nav)
- [x] Build Client CRUD (add, edit, archive clients with name, hourly rate, color)
- [ ] Build Project CRUD (add, edit, archive projects under clients with optional rate override)

### Phase 2: Timer Engine (Days 2-3)
- [ ] Create timer engine: start timer → creates time_entry with is_running=true
- [ ] Stop timer → sets end_time, calculates duration_seconds, sets is_running=false
- [ ] Pause/resume functionality (stop current entry, start new one on resume)
- [ ] Support multiple simultaneous running timers (one per project)
- [ ] Timer state persists in Supabase (survives browser close/refresh)
- [ ] On app load, detect any is_running=true entries and resume display

### Phase 3: Dashboard UI (Days 3-4)
- [ ] Card-based dashboard showing all active projects with timer controls
- [ ] Each card: client name, project name, live elapsed time (ticking), running cost
- [ ] Start/Stop/Pause buttons per card
- [ ] Green pulsing indicator for running timers, amber accent for active states
- [ ] Quick-start: click a project card to begin timing
- [ ] "Recent Activity" section below cards showing today's logged entries
- [ ] Today's summary: total hours + total earnings
- [ ] Responsive layout: 3 columns desktop, 1 column mobile

### Phase 4: Time Log & Reports (Days 4-6)
- [ ] Time log page: chronological list of all time entries
- [ ] Filter by client, project, and date range
- [ ] Each entry: project, client, start/end time, duration, calculated cost
- [ ] Edit entries (adjust start/end times for corrections)
- [ ] Delete entries with confirmation dialog
- [ ] Manual time entry option (add time after the fact)
- [ ] Reports page: summary view grouped by client → project
- [ ] CSV export filtered by client + date range
- [ ] Include DO Code Lab logo in report header

### Phase 5: Polish & Deploy (Days 6-7)
- [ ] Responsive design pass (mobile + desktop)
- [ ] Empty states with DO Code Lab logo watermark
- [ ] Loading states and error handling
- [ ] Seed B.B. (GA Gymnastics State Meets) and Mariah (Evermore Equine) as default clients
- [ ] Deploy to Vercel
- [ ] Test full loop: add client → start timer → stop → view log → export CSV

## Explicitly NOT Building
- User authentication / multi-user support
- Team features
- Recurring timers / templates
- Calendar view
- Integrations (QuickBooks, Stripe, etc.)
- Mobile native app
- Client portal
- Automated invoicing / payment links
- Tags / categories beyond client → project hierarchy
- Dark mode
- Notifications / reminders
- PDF invoice export (CSV only for MVP)

## Success Criteria
- [ ] Can start/stop/pause multiple timers simultaneously
- [ ] Timers persist across browser sessions via Supabase
- [ ] Can add clients with hourly rates and projects under them
- [ ] Time entries auto-log when timer stops
- [ ] Can view, filter, edit, and delete time history
- [ ] Can export CSV filtered by client + date range
- [ ] DO Code Lab logo appears in header, reports, and empty states
- [ ] Deployed to Vercel and accessible from any device
- [ ] Used to track 1 full week of work on B.B.'s site

## UI Layout Reference

```
┌─────────────────────────────────────────────────────┐
│  [DO Logo] In DO Time       [+ New Timer]  [Reports]│
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 🟢 BB    │  │ ⏸ Mariah │  │ ⬚ New    │          │
│  │ GA Gym   │  │ Evermore │  │ Client   │          │
│  │ 01:23:45 │  │ 00:45:12 │  │          │          │
│  │ $41.18   │  │ $33.84   │  │  + Add   │          │
│  │ [⏹ Stop] │  │ [▶ Play] │  │          │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  ─── Recent Activity ────────────────────────       │
│  Today: 3 entries | 4h 12m | $187.50                │
│  • GA Gym Site — Header redesign    1:23:45         │
│  • Evermore — Contact form          0:45:12         │
│  • GA Gym Site — Event calendar     2:03:18         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

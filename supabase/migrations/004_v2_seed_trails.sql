-- In DO Time v2 — Seed Default Trails and Rates
-- Run after 003_v2_schema_reset.sql has been applied.
-- Inserts 6 default trails and 2 rates (one per client trail at $50/hr from 2026-01-01).

-- ============================================================
-- SEED TRAILS
-- ============================================================

INSERT INTO trails (name, slug, kind, is_billable, color, display_order) VALUES
  ('B.B.',             'bb',              'client',   TRUE,  '#3A7D44', 1),
  ('Evermore Equine',  'evermore-equine', 'client',   TRUE,  '#8B4513', 2),
  ('Hapag-Lloyd',      'hapag-lloyd',     'employer', FALSE, '#003D6B', 3),
  ('DObot',            'dobot',           'project',  FALSE, '#6B46C1', 4),
  ('In DO Time',       'in-do-time',      'project',  FALSE, '#1B5E20', 5),
  ('Personal',         'personal',        'personal', FALSE, '#6B7280', 6);

-- ============================================================
-- SEED RATES (client trails only, $50/hr from 2026-01-01)
-- ============================================================

INSERT INTO rates (trail_id, project_id, hourly_rate, effective_from, effective_until)
SELECT id, NULL, 50.00, '2026-01-01', NULL
FROM trails
WHERE slug IN ('bb', 'evermore-equine');

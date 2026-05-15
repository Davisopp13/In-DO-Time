'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Trail, TrailInsert, Rate } from '@/types/database';
import EmptyState from '@/components/EmptyState';

const TRAIL_COLORS = [
  '#3A7D44',
  '#1B5E20',
  '#D97706',
  '#2563EB',
  '#7C3AED',
  '#DC2626',
  '#059669',
  '#D946EF',
  '#8B4513',
  '#003D6B',
  '#6B46C1',
  '#6B7280',
];

type TrailKind = Trail['kind'];

const KIND_LABELS: Record<TrailKind, string> = {
  client: 'Client',
  employer: 'Employer',
  personal: 'Personal',
  project: 'Project',
};

const KIND_GROUPS: Array<{ kind: TrailKind; label: string }> = [
  { kind: 'client', label: 'Clients' },
  { kind: 'employer', label: 'Work' },
  { kind: 'project', label: 'Projects' },
  { kind: 'personal', label: 'Personal' },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentRate(trailId: string, rates: Rate[]): number | null {
  const today = getTodayISO();
  const trailRates = rates.filter(
    (r) =>
      r.trail_id === trailId &&
      r.project_id === null &&
      r.effective_from <= today &&
      (r.effective_until === null || r.effective_until >= today)
  );
  if (trailRates.length === 0) return null;
  trailRates.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return trailRates[0].hourly_rate;
}

export default function TrailsPage() {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formSlugManual, setFormSlugManual] = useState(false);
  const [formKind, setFormKind] = useState<TrailKind>('client');
  const [formBillable, setFormBillable] = useState(true);
  const [formColor, setFormColor] = useState(TRAIL_COLORS[0]);
  const [formRate, setFormRate] = useState('');

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    async function load() {
      const [trailsResult, ratesResult] = await Promise.all([
        supabase.from('trails').select('*').order('display_order'),
        supabase.from('rates').select('*'),
      ]);

      if (cancelled) return;

      if (trailsResult.error) {
        setError('Failed to load trails');
      } else {
        setTrails(trailsResult.data || []);
        setError(null);
      }

      if (!ratesResult.error) {
        setRates(ratesResult.data || []);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  function refresh() {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }

  function openAddForm() {
    setFormName('');
    setFormSlug('');
    setFormSlugManual(false);
    setFormKind('client');
    setFormBillable(true);
    setFormColor(TRAIL_COLORS[0]);
    setFormRate('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
  }

  function handleNameChange(name: string) {
    setFormName(name);
    if (!formSlugManual) {
      setFormSlug(generateSlug(name));
    }
  }

  function handleKindChange(kind: TrailKind) {
    setFormKind(kind);
    setFormBillable(kind === 'client');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const supabase = getSupabase();

    try {
      // Generate ID client-side so we can use it for the rate insert without
      // relying on insert().select().single() which breaks the mock client.
      const trailId = crypto.randomUUID();

      const newTrail: TrailInsert = {
        id: trailId,
        name: formName,
        slug: formSlug,
        kind: formKind,
        is_billable: formBillable,
        color: formColor,
      };

      const { error: insertError } = await supabase.from('trails').insert(newTrail);

      if (insertError) {
        setError('Failed to create trail');
        return;
      }

      if (formBillable && formRate) {
        const rateValue = parseFloat(formRate);
        if (!isNaN(rateValue) && rateValue > 0) {
          await supabase.from('rates').insert({
            trail_id: trailId,
            project_id: null,
            hourly_rate: rateValue,
            effective_from: getTodayISO(),
            effective_until: null,
          });
        }
      }

      closeForm();
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(trail: Trail) {
    const newStatus = trail.status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'archive' : 'restore';

    if (!confirm(`Are you sure you want to ${action} "${trail.name}"?`)) return;

    setArchivingId(trail.id);
    const supabase = getSupabase();
    try {
      const { error } = await supabase
        .from('trails')
        .update({ status: newStatus })
        .eq('id', trail.id);

      if (error) {
        setError(`Failed to ${action} trail`);
        return;
      }

      refresh();
    } finally {
      setArchivingId(null);
    }
  }

  const visibleTrails = showArchived ? trails : trails.filter((t) => t.status === 'active');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-white">Trails</h1>
        <button
          onClick={openAddForm}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 self-start sm:self-auto shadow-lg shadow-primary/20"
        >
          + Add trail
        </button>
      </div>

      {error && (
        <div className="rounded-button bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showArchived"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-surface/50 dark:bg-black/20 text-primary focus:ring-primary"
        />
        <label htmlFor="showArchived" className="text-sm font-medium text-text-muted">
          Show archived trails
        </label>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 border-l-4 border-border animate-pulse">
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-surface/20 dark:bg-white/10" />
                <div className="h-3 w-16 rounded bg-surface/20 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleTrails.length === 0 ? (
        <EmptyState title={showArchived ? 'No trails found' : 'No active trails'}>
          {showArchived ? 'Try disabling the archived filter.' : 'Add your first trail to get started!'}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {KIND_GROUPS.map(({ kind, label }) => {
            const group = visibleTrails.filter((t) => t.kind === kind);
            if (group.length === 0) return null;

            return (
              <section key={kind}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                  {label}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((trail) => {
                    const currentRate = trail.is_billable ? getCurrentRate(trail.id, rates) : null;
                    return (
                      <div
                        key={trail.id}
                        className={`glass-card p-6 shadow-card border-l-4 transition-all duration-300 hover:scale-[1.01] hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${
                          trail.status === 'archived' ? 'opacity-60 grayscale' : ''
                        }`}
                        style={{ borderLeftColor: trail.color ?? '#3A7D44' }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-text dark:text-white truncate">
                              {trail.name}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-surface-foreground/10 dark:bg-white/10 text-text-muted dark:text-white/60 rounded">
                                {KIND_LABELS[trail.kind]}
                              </span>
                              {trail.is_billable && (
                                <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-primary/10 text-primary rounded">
                                  Billable
                                </span>
                              )}
                              {trail.status === 'archived' && (
                                <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-surface-foreground/10 dark:bg-white/10 text-text-muted/70 dark:text-white/50 rounded">
                                  Archived
                                </span>
                              )}
                            </div>
                            {trail.is_billable && currentRate !== null && (
                              <p className="mt-2 text-sm text-text-muted">
                                ${currentRate.toFixed(2)}
                                <span className="text-xs text-text-muted/70">/hr</span>
                              </p>
                            )}
                          </div>
                          <div
                            className="ml-3 h-4 w-4 shrink-0 rounded-full"
                            style={{ backgroundColor: trail.color ?? '#3A7D44' }}
                          />
                        </div>
                        <div className="mt-6 flex gap-2">
                          <button
                            onClick={() => handleArchive(trail)}
                            disabled={archivingId === trail.id}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border border-border dark:border-white/5 disabled:opacity-50 disabled:cursor-not-allowed ${
                              trail.status === 'active'
                                ? 'text-text-muted hover:text-text dark:text-white/70 bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 dark:hover:text-white'
                                : 'text-primary bg-primary/10 hover:bg-primary/20'
                            }`}
                          >
                            {archivingId === trail.id
                              ? 'Processing...'
                              : trail.status === 'active'
                              ? 'Archive'
                              : 'Restore'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-xl font-bold text-text dark:text-white">Add trail</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="trailName" className="block text-sm font-medium text-text">
                  Trail name
                </label>
                <input
                  type="text"
                  id="trailName"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                  placeholder="e.g. B.B."
                />
              </div>

              <div>
                <label htmlFor="trailSlug" className="block text-sm font-medium text-text">
                  Slug
                </label>
                <input
                  type="text"
                  id="trailSlug"
                  value={formSlug}
                  onChange={(e) => {
                    setFormSlug(e.target.value);
                    setFormSlugManual(true);
                  }}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20 font-mono"
                  placeholder="e.g. bb"
                />
              </div>

              <div>
                <label htmlFor="trailKind" className="block text-sm font-medium text-text">
                  Kind
                </label>
                <select
                  id="trailKind"
                  value={formKind}
                  onChange={(e) => handleKindChange(e.target.value as TrailKind)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="client">Client</option>
                  <option value="employer">Employer</option>
                  <option value="project">Project</option>
                  <option value="personal">Personal</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="formBillable"
                  checked={formBillable}
                  onChange={(e) => setFormBillable(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-surface/50 dark:bg-black/20 text-primary focus:ring-primary"
                />
                <label htmlFor="formBillable" className="text-sm font-medium text-text">
                  Billable
                </label>
              </div>

              {formBillable && (
                <div>
                  <label htmlFor="formRate" className="block text-sm font-medium text-text">
                    Initial rate ($/hr, optional)
                  </label>
                  <input
                    type="number"
                    id="formRate"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    min="0"
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                    placeholder="0.00"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text">Color</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TRAIL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={`h-8 w-8 rounded-full transition-transform ${
                        formColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Add trail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

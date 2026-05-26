'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Observation, Project, Trail } from '@/types/database';
import EmptyState from '@/components/EmptyState';

type ObservationRow = Observation & {
  trailName?: string;
  projectName?: string;
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ObservationsPage() {
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedObservationId, setCopiedObservationId] = useState<string | null>(null);

  async function copyObservation(observation: ObservationRow) {
    await navigator.clipboard.writeText(observation.content);
    setCopiedObservationId(observation.id);
    window.setTimeout(() => setCopiedObservationId((current) => (current === observation.id ? null : current)), 1400);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    async function load() {
      setLoading(true);
      const [observationsResult, trailsResult, projectsResult] = await Promise.all([
        supabase.from('observations').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('trails').select('id, name'),
        supabase.from('projects').select('id, name'),
      ]);

      if (cancelled) return;

      if (observationsResult.error) {
        setError('Failed to load observations');
        setLoading(false);
        return;
      }

      const trailMap = new Map(((trailsResult.data as Pick<Trail, 'id' | 'name'>[]) || []).map((trail) => [trail.id, trail.name]));
      const projectMap = new Map(((projectsResult.data as Pick<Project, 'id' | 'name'>[]) || []).map((project) => [project.id, project.name]));

      setObservations(((observationsResult.data as Observation[]) || []).map((observation) => ({
        ...observation,
        trailName: observation.related_trail_id ? trailMap.get(observation.related_trail_id) : undefined,
        projectName: observation.related_project_id ? projectMap.get(observation.related_project_id) : undefined,
      })));
      setError(null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-white">Observations</h1>
        <p className="mt-1 text-sm text-text-muted">Reverse-chronological debug feed from agent ingest.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="glass-card h-28 animate-pulse p-4">
              <div className="h-4 w-36 rounded bg-surface/20 dark:bg-white/10" />
              <div className="mt-4 h-3 w-4/5 rounded bg-surface/20 dark:bg-white/10" />
            </div>
          ))}
        </div>
      ) : observations.length === 0 ? (
        <EmptyState title="No observations yet">Agent events will appear here after the API receives them.</EmptyState>
      ) : (
        <div className="space-y-3">
          {observations.map((observation) => (
            <article key={observation.id} className="glass-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="font-semibold uppercase tracking-wider text-primary">{observation.source}</span>
                  <span>{formatTimestamp(observation.created_at)}</span>
                  {observation.trailName && <span className="rounded-full bg-surface-foreground/10 px-2 py-0.5">{observation.trailName}</span>}
                  {observation.projectName && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">{observation.projectName}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => void copyObservation(observation)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface/60 text-text-muted transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring/40 dark:border-white/10 dark:bg-white/5"
                  aria-label={copiedObservationId === observation.id ? 'Observation copied' : 'Copy observation'}
                  title={copiedObservationId === observation.id ? 'Copied' : 'Copy observation'}
                >
                  {copiedObservationId === observation.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-text dark:text-white">{observation.content}</p>
              {observation.metadata && Object.keys(observation.metadata as Record<string, unknown>).length > 0 && (
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface/50 p-3 text-xs text-text-muted dark:border-white/5 dark:bg-black/20">
                  {JSON.stringify(observation.metadata, null, 2)}
                </pre>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

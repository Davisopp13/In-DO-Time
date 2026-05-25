'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import type { JournalEntry, Observation, OpenLoop, Project, Trail } from '@/types/database';

type ProjectWithTrail = Project & { trail?: Pick<Trail, 'name' | 'color'> };
type LoopWithProject = OpenLoop & { project?: ProjectWithTrail };

function startOfDay(offsetDays: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function BriefingPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [openLoops, setOpenLoops] = useState<LoopWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    async function load() {
      setLoading(true);
      const since = startOfDay(-1).toISOString();
      const [obsResult, journalResult, loopsResult, projectsResult, trailsResult] = await Promise.all([
        supabase.from('observations').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(30),
        supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(3),
        supabase.from('open_loops').select('*').eq('status', 'open').order('order', { ascending: true }).limit(30),
        supabase.from('projects').select('*'),
        supabase.from('trails').select('id, name, color'),
      ]);

      if (cancelled) return;

      if (obsResult.error || journalResult.error || loopsResult.error) {
        setError('Failed to load briefing inputs');
        setLoading(false);
        return;
      }

      const trails = new Map(((trailsResult.data as Pick<Trail, 'id' | 'name' | 'color'>[]) || []).map((trail) => [trail.id, trail]));
      const projects = new Map(((projectsResult.data as Project[]) || []).map((project) => [
        project.id,
        { ...project, trail: trails.get(project.trail_id) },
      ]));

      setObservations((obsResult.data as Observation[]) || []);
      setJournalEntries((journalResult.data as JournalEntry[]) || []);
      setOpenLoops(((loopsResult.data as OpenLoop[]) || []).map((loop) => ({ ...loop, project: projects.get(loop.project_id) })));
      setError(null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const topProjects = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; color?: string | null }>();
    for (const loop of openLoops) {
      const key = loop.project_id;
      const current = counts.get(key) ?? { name: loop.project?.name ?? 'Unknown project', count: 0, color: loop.project?.trail?.color };
      current.count += 1;
      counts.set(key, current);
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [openLoops]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Compass className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-white">Morning Briefing</h1>
          <p className="mt-1 text-sm text-text-muted">A quiet synthesis of recent observations, reflection, and open loops.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="glass-card h-40 animate-pulse" />)}
        </div>
      ) : (
        <>
          <section className="glass-card p-5 shadow-card">
            <h2 className="text-lg font-bold text-text dark:text-white">Orientation</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface/40 p-4 dark:border-white/5 dark:bg-black/20">
                <div className="text-2xl font-bold text-text dark:text-white">{observations.length}</div>
                <div className="text-xs uppercase tracking-wider text-text-muted">recent observations</div>
              </div>
              <div className="rounded-lg border border-border bg-surface/40 p-4 dark:border-white/5 dark:bg-black/20">
                <div className="text-2xl font-bold text-text dark:text-white">{openLoops.length}</div>
                <div className="text-xs uppercase tracking-wider text-text-muted">open loops</div>
              </div>
              <div className="rounded-lg border border-border bg-surface/40 p-4 dark:border-white/5 dark:bg-black/20">
                <div className="text-2xl font-bold text-text dark:text-white">{journalEntries.length}</div>
                <div className="text-xs uppercase tracking-wider text-text-muted">journal entries</div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Most Loaded Projects</h2>
              <div className="mt-4 space-y-3">
                {topProjects.length === 0 ? (
                  <p className="text-sm text-text-muted">No open project loops right now.</p>
                ) : topProjects.map((project) => (
                  <div key={project.name} className="flex items-center justify-between rounded-lg bg-surface-foreground/5 p-3 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color ?? '#3A7D44' }} />
                      <span className="text-sm font-medium text-text dark:text-white">{project.name}</span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{project.count} loops</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Latest Reflection</h2>
              {journalEntries[0] ? (
                <div className="mt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted">{journalEntries[0].entry_date}</div>
                  <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-text dark:text-white">{journalEntries[0].content}</p>
                  <Link href="/journal" className="mt-3 inline-block text-xs font-medium text-primary hover:text-primary/80">
                    Open journal
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-text-muted">No journal entries yet.</p>
              )}
            </section>
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Recent Observations</h2>
              <div className="mt-4 space-y-3">
                {observations.slice(0, 6).map((observation) => (
                  <div key={observation.id} className="border-b border-border pb-3 last:border-0 last:pb-0 dark:border-white/5">
                    <div className="text-xs text-text-muted">{formatTime(observation.created_at)} · {observation.source}</div>
                    <p className="mt-1 text-sm leading-6 text-text dark:text-white">{observation.content}</p>
                  </div>
                ))}
                {observations.length === 0 && <p className="text-sm text-text-muted">No observations since yesterday morning.</p>}
              </div>
            </div>

            <div className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Open Loops</h2>
              <div className="mt-4 space-y-3">
                {openLoops.slice(0, 8).map((loop) => (
                  <div key={loop.id} className="rounded-lg bg-surface-foreground/5 p-3 dark:bg-white/5">
                    <div className="text-sm font-medium text-text dark:text-white">{loop.title}</div>
                    <div className="mt-1 text-xs text-text-muted">{loop.project?.name ?? 'Unknown project'}</div>
                  </div>
                ))}
                {openLoops.length === 0 && <p className="text-sm text-text-muted">No open loops. Nice clean runway.</p>}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

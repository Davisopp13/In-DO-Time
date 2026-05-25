'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { gatherBriefingInputs } from '@/lib/briefing/gather';
import { synthesizeBriefing } from '@/lib/briefing/synthesize';
import type { BriefingData } from '@/lib/briefing/types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const inputs = await gatherBriefingInputs();
        if (cancelled) return;
        setBriefing(synthesizeBriefing(inputs));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load briefing');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      ) : briefing && (
        <>
          <section className="glass-card p-5 shadow-card">
            <h2 className="text-lg font-bold text-text dark:text-white">Orientation</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface/40 p-4 dark:border-white/5 dark:bg-black/20">
                <div className="text-2xl font-bold text-text dark:text-white">{briefing.observationCount}</div>
                <div className="text-xs uppercase tracking-wider text-text-muted">recent observations</div>
              </div>
              <div className="rounded-lg border border-border bg-surface/40 p-4 dark:border-white/5 dark:bg-black/20">
                <div className="text-2xl font-bold text-text dark:text-white">{briefing.openLoopCount}</div>
                <div className="text-xs uppercase tracking-wider text-text-muted">open loops</div>
              </div>
              <div className="rounded-lg border border-border bg-surface/40 p-4 dark:border-white/5 dark:bg-black/20">
                <div className="text-2xl font-bold text-text dark:text-white">{briefing.journalEntryCount}</div>
                <div className="text-xs uppercase tracking-wider text-text-muted">journal entries</div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Most Loaded Projects</h2>
              <div className="mt-4 space-y-3">
                {briefing.topProjects.length === 0 ? (
                  <p className="text-sm text-text-muted">No open project loops right now.</p>
                ) : briefing.topProjects.map((project) => (
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
              {briefing.latestReflection ? (
                <div className="mt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted">{briefing.latestReflection.entry_date}</div>
                  <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-text dark:text-white">{briefing.latestReflection.content}</p>
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
                {briefing.recentObservations.map((obs) => (
                  <div key={obs.id} className="border-b border-border pb-3 last:border-0 last:pb-0 dark:border-white/5">
                    <div className="text-xs text-text-muted">{formatTime(obs.created_at)} · {obs.source}</div>
                    <p className="mt-1 text-sm leading-6 text-text dark:text-white">{obs.content}</p>
                  </div>
                ))}
                {briefing.recentObservations.length === 0 && <p className="text-sm text-text-muted">No observations since yesterday morning.</p>}
              </div>
            </div>

            <div className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Open Loops</h2>
              <div className="mt-4 space-y-3">
                {briefing.openLoopItems.map((loop) => (
                  <div key={loop.id} className="rounded-lg bg-surface-foreground/5 p-3 dark:bg-white/5">
                    <div className="text-sm font-medium text-text dark:text-white">{loop.title}</div>
                    <div className="mt-1 text-xs text-text-muted">{loop.projectName}</div>
                  </div>
                ))}
                {briefing.openLoopItems.length === 0 && <p className="text-sm text-text-muted">No open loops. Nice clean runway.</p>}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

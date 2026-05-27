'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Compass, Copy } from 'lucide-react'
import { gatherBriefingInputs } from '@/lib/briefing/gather'
import { synthesizeBriefing } from '@/lib/briefing/synthesize'
import type { BriefingData } from '@/lib/briefing/types'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

const BRIEFING_CACHE_TTL_MS = 60_000
let cachedBriefing: BriefingData | null = null
let cachedBriefingAt = 0

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<BriefingData | null>(() => cachedBriefing)
  const [loading, setLoading] = useState(() => cachedBriefing === null)
  const [showLoadingShell, setShowLoadingShell] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedObservationId, setCopiedObservationId] = useState<string | null>(null)
  const [copyErrorObservationId, setCopyErrorObservationId] = useState<string | null>(null)
  const [manualCopyObservationId, setManualCopyObservationId] = useState<string | null>(null)

  async function copyObservation(id: string, content: string) {
    const copied = await copyToClipboard(content)
    if (!copied) {
      setCopyErrorObservationId(id)
      setManualCopyObservationId(id)
      window.setTimeout(() => setCopyErrorObservationId((current) => (current === id ? null : current)), 1800)
      return
    }

    setCopyErrorObservationId(null)
    setManualCopyObservationId(null)
    setCopiedObservationId(id)
    window.setTimeout(() => setCopiedObservationId((current) => (current === id ? null : current)), 1400)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const hasFreshCache = cachedBriefing !== null && Date.now() - cachedBriefingAt < BRIEFING_CACHE_TTL_MS
      if (!hasFreshCache) setLoading(true)

      try {
        const inputs = await gatherBriefingInputs()
        if (cancelled) return
        const nextBriefing = synthesizeBriefing(inputs)
        cachedBriefing = nextBriefing
        cachedBriefingAt = Date.now()
        setBriefing(nextBriefing)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load briefing')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loading) {
      setShowLoadingShell(false)
      return
    }

    const timer = window.setTimeout(() => setShowLoadingShell(true), 220)
    return () => window.clearTimeout(timer)
  }, [loading])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text dark:text-white">Briefing</h1>
            <p className="mt-1 text-sm text-text-muted">A fuller orientation view for observations, reflection, and open loops.</p>
          </div>
        </div>
        <Link href="/" className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-text-muted transition hover:border-accent hover:text-text dark:hover:text-white">
          Back to dashboard
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {loading && !showLoadingShell ? (
        <div className="min-h-[28rem]" aria-busy="true" />
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="glass-card h-40 animate-pulse" />)}
        </div>
      ) : briefing && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="glass-card p-4 shadow-card">
              <div className="text-2xl font-bold text-text dark:text-white">{briefing.observationCount}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">recent observations</div>
            </div>
            <div className="glass-card p-4 shadow-card">
              <div className="text-2xl font-bold text-text dark:text-white">{briefing.openLoopCount}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">open loops</div>
            </div>
            <div className="glass-card p-4 shadow-card">
              <div className="text-2xl font-bold text-text dark:text-white">{briefing.journalEntryCount}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">journal entries</div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Most Loaded Projects</h2>
              <div className="mt-4 space-y-3">
                {briefing.topProjects.length === 0 ? (
                  <p className="text-sm text-text-muted">No open project loops right now.</p>
                ) : briefing.topProjects.map((project) => (
                  <div key={project.name} className="flex items-center justify-between gap-3 rounded-lg bg-surface-foreground/5 p-3 dark:bg-white/5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? '#3A7D44' }} />
                      <span className="truncate text-sm font-medium text-text dark:text-white">{project.name}</span>
                    </div>
                    <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-text-muted">{project.count} loops</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5 shadow-card">
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
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card p-5 shadow-card">
              <h2 className="text-lg font-bold text-text dark:text-white">Recent Observations</h2>
              <div className="mt-4 space-y-3">
                {briefing.recentObservations.map((obs) => (
                  <div key={obs.id} className="border-b border-border pb-3 last:border-0 last:pb-0 dark:border-white/5">
                    <div className="text-xs text-text-muted">{formatTime(obs.created_at)} · {obs.source}</div>
                    <p className="mt-1 text-sm leading-6 text-text dark:text-white">
                      {obs.content}
                      <button
                        type="button"
                        onClick={() => void copyObservation(obs.id, obs.content)}
                        className="ml-1 inline-flex h-6 w-6 translate-y-1 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-foreground/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring/40 dark:hover:bg-white/10"
                        aria-label={copyErrorObservationId === obs.id ? 'Copy failed' : copiedObservationId === obs.id ? 'Observation copied' : 'Copy observation'}
                        title={copyErrorObservationId === obs.id ? 'Copy failed' : copiedObservationId === obs.id ? 'Copied' : 'Copy observation'}
                      >
                        {copiedObservationId === obs.id ? <Check className="h-3.5 w-3.5" /> : <Copy className={copyErrorObservationId === obs.id ? 'h-3.5 w-3.5 text-red-500' : 'h-3.5 w-3.5'} />}
                      </button>
                    </p>
                    {manualCopyObservationId === obs.id && (
                      <textarea
                        readOnly
                        autoFocus
                        value={obs.content}
                        onFocus={(event) => event.currentTarget.select()}
                        className="mt-2 h-24 w-full resize-none rounded-lg border border-primary/30 bg-surface/80 p-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-black/30 dark:text-white"
                        aria-label="Observation text selected for manual copy"
                      />
                    )}
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
  )
}

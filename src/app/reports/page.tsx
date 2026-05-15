'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'
import { formatDuration, calculateRunningCost, formatCurrency } from '@/lib/timer'
import { generateCSV, downloadCSV, generateCSVFilename } from '@/lib/csv'
import { Rate } from '@/types/database'
import EmptyState from '@/components/EmptyState'

interface ReportEntry {
  id: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  notes: string | null
  project_id: string
  project_name: string
  trail_id: string
  trail_name: string
  trail_color: string
  trail_is_billable: boolean
}

interface ProjectSummary {
  id: string
  name: string
  totalSeconds: number
  totalCost: number
  entryCount: number
}

interface TrailSummary {
  id: string
  name: string
  color: string
  is_billable: boolean
  totalSeconds: number
  totalCost: number
  entryCount: number
  projects: ProjectSummary[]
}

function getEffectiveRateFromCache(
  rates: Rate[],
  trailId: string,
  projectId: string,
  atDate: Date
): number | null {
  const dateStr = atDate.toISOString().split('T')[0]
  const projectRates = rates.filter(
    r =>
      r.trail_id === trailId &&
      r.project_id === projectId &&
      r.effective_from <= dateStr &&
      (r.effective_until === null || r.effective_until >= dateStr)
  )
  if (projectRates.length > 0) {
    return projectRates.sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0].hourly_rate
  }
  const trailRates = rates.filter(
    r =>
      r.trail_id === trailId &&
      r.project_id === null &&
      r.effective_from <= dateStr &&
      (r.effective_until === null || r.effective_until >= dateStr)
  )
  if (trailRates.length > 0) {
    return trailRates.sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0].hourly_rate
  }
  return null
}

export default function ReportsPage() {
  const [trailSummaries, setTrailSummaries] = useState<TrailSummary[]>([])
  const [reportEntries, setReportEntries] = useState<ReportEntry[]>([])
  const [allRates, setAllRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [trails, setTrails] = useState<{ id: string; name: string }[]>([])
  const [selectedTrail, setSelectedTrail] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Collapse state per trail
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Load filter options and rates
  useEffect(() => {
    async function loadMeta() {
      const supabase = getSupabase()
      const [trailsRes, ratesRes] = await Promise.all([
        supabase.from('trails').select('id, name').eq('status', 'active').order('display_order'),
        supabase.from('rates').select('*'),
      ])
      if (trailsRes.data) setTrails(trailsRes.data)
      if (ratesRes.data) setAllRates(ratesRes.data as Rate[])
    }
    loadMeta()
  }, [])

  const loadReport = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()

      let query = supabase
        .from('time_entries')
        .select(`
          id, start_time, end_time, duration_seconds, notes,
          project_id,
          projects!inner(
            id,
            name,
            trail_id,
            trails(id, name, color, is_billable)
          )
        `)
        .eq('is_running', false)
        .order('start_time', { ascending: false })

      if (startDate) {
        query = query.gte('start_time', new Date(startDate).toISOString())
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('start_time', end.toISOString())
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let entries: ReportEntry[] = (data || []).map((e: any) => {
        const trail = e.projects.trails || { id: '', name: 'Unknown', color: '#6B7280', is_billable: false }
        return {
          id: e.id,
          start_time: e.start_time,
          end_time: e.end_time,
          duration_seconds: e.duration_seconds,
          notes: e.notes,
          project_id: e.project_id,
          project_name: e.projects.name,
          trail_id: e.projects.trail_id,
          trail_name: trail.name,
          trail_color: trail.color ?? '#6B7280',
          trail_is_billable: trail.is_billable,
        }
      })

      // JS-side trail filter for mock compatibility
      if (selectedTrail) {
        entries = entries.filter(e => e.trail_id === selectedTrail)
      }

      setReportEntries(entries)

      // Group by trail → project
      const trailMap = new Map<string, TrailSummary>()

      for (const entry of entries) {
        const seconds = entry.duration_seconds ?? 0
        const rate = entry.trail_is_billable
          ? getEffectiveRateFromCache(allRates, entry.trail_id, entry.project_id, new Date(entry.start_time))
          : null
        const cost = rate != null ? calculateRunningCost(seconds, rate) : 0

        if (!trailMap.has(entry.trail_id)) {
          trailMap.set(entry.trail_id, {
            id: entry.trail_id,
            name: entry.trail_name,
            color: entry.trail_color,
            is_billable: entry.trail_is_billable,
            totalSeconds: 0,
            totalCost: 0,
            entryCount: 0,
            projects: [],
          })
        }

        const trail = trailMap.get(entry.trail_id)!
        trail.totalSeconds += seconds
        trail.totalCost += cost
        trail.entryCount += 1

        let project = trail.projects.find(p => p.id === entry.project_id)
        if (!project) {
          project = { id: entry.project_id, name: entry.project_name, totalSeconds: 0, totalCost: 0, entryCount: 0 }
          trail.projects.push(project)
        }
        project.totalSeconds += seconds
        project.totalCost += cost
        project.entryCount += 1
      }

      const summaries = Array.from(trailMap.values())
        .sort((a, b) => b.totalSeconds - a.totalSeconds)
        .map(trail => ({
          ...trail,
          projects: trail.projects.sort((a, b) => b.totalSeconds - a.totalSeconds),
        }))

      setTrailSummaries(summaries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [selectedTrail, startDate, endDate, allRates])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const clearFilters = () => {
    setSelectedTrail('')
    setStartDate('')
    setEndDate('')
  }

  const toggleCollapse = (trailId: string) => {
    setCollapsed(prev => ({ ...prev, [trailId]: !prev[trailId] }))
  }

  const hasFilters = selectedTrail || startDate || endDate

  const handleExportCSV = () => {
    if (reportEntries.length === 0) return

    const csvEntries = reportEntries.map(e => {
      const rate = e.trail_is_billable
        ? getEffectiveRateFromCache(allRates, e.trail_id, e.project_id, new Date(e.start_time))
        : null
      return {
        trail_name: e.trail_name,
        project_name: e.project_name,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_seconds: e.duration_seconds,
        notes: e.notes,
        effectiveRate: rate,
      }
    })

    const csv = generateCSV(csvEntries)
    const trailName = selectedTrail ? trails.find(t => t.id === selectedTrail)?.name : undefined
    const filename = generateCSVFilename(trailName, startDate, endDate)
    downloadCSV(csv, filename)
  }

  // Grand totals
  const grandTotalSeconds = trailSummaries.reduce((sum, t) => sum + t.totalSeconds, 0)
  const grandTotalEarned = trailSummaries.filter(t => t.is_billable).reduce((sum, t) => sum + t.totalCost, 0)
  const grandTotalEntries = trailSummaries.reduce((sum, t) => sum + t.entryCount, 0)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded bg-surface/20 dark:bg-white/10" />
          <div className="space-y-2">
            <div className="h-6 w-24 rounded bg-surface/20 dark:bg-white/10" />
            <div className="h-3 w-40 rounded bg-surface/20 dark:bg-white/10" />
          </div>
        </div>
        <div className="glass-card border border-border bg-surface/50 p-4 shadow-card">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="h-10 rounded bg-surface/20 dark:bg-white/10 col-span-2 sm:col-span-1" />
            <div className="h-10 rounded bg-surface/20 dark:bg-white/10" />
            <div className="h-10 rounded bg-surface/20 dark:bg-white/10" />
          </div>
        </div>
        <div className="glass-card border border-accent/20 bg-accent/5 p-4 shadow-card">
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded bg-surface/20 dark:bg-white/10" />
            <div className="flex gap-6">
              <div className="h-6 w-20 rounded bg-surface/20 dark:bg-white/10" />
              <div className="h-6 w-20 rounded bg-surface/20 dark:bg-white/10" />
            </div>
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="glass-card border border-border bg-surface/50 p-5 shadow-card">
            <div className="flex justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-surface/20 dark:bg-white/10" />
                <div className="space-y-1">
                  <div className="h-4 w-28 rounded bg-surface/20 dark:bg-white/10" />
                  <div className="h-3 w-20 rounded bg-surface/20 dark:bg-white/10" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-16 rounded bg-surface/20 dark:bg-white/10" />
                <div className="h-4 w-16 rounded bg-surface/20 dark:bg-white/10" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card border border-red-500/20 bg-red-500/10 p-6">
        <p className="text-red-500">Failed to load report: {error}</p>
        <button
          onClick={loadReport}
          className="mt-2 text-sm font-medium text-text dark:text-white hover:text-accent underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/DO_CODE_LAB_LOGO.png"
            alt="DO Code Lab"
            width={72}
            height={48}
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-text dark:text-white">Reports</h1>
            <p className="text-sm text-text-muted">
              Summary by trail and project
              {hasFilters ? ' (filtered)' : ''}
            </p>
          </div>
        </div>
        {reportEntries.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors self-start"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 glass-card border border-border p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="col-span-1 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">Trail</label>
            <select
              value={selectedTrail}
              onChange={(e) => setSelectedTrail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="" className="bg-surface dark:bg-slate-900">All Trails</option>
              {trails.map((t) => (
                <option key={t.id} value={t.id} className="bg-surface dark:bg-slate-900">{t.name}</option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-text-muted">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full min-w-0 rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-text-muted">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full min-w-0 rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {hasFilters && (
            <div className="col-span-1 flex items-end sm:col-span-3 lg:col-span-1">
              <button
                onClick={clearFilters}
                className="w-full sm:w-auto rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white border border-transparent hover:border-border transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grand Totals */}
      {trailSummaries.length > 0 && (
        <div className="mb-6 glass-card border-l-4 border-accent p-6 shadow-card bg-surface/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-text dark:text-white">Total</p>
              <p className="text-xs text-text-muted">
                {grandTotalEntries} {grandTotalEntries === 1 ? 'entry' : 'entries'} across {trailSummaries.length} {trailSummaries.length === 1 ? 'trail' : 'trails'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="sm:text-right">
                <p className="font-mono text-lg font-bold text-accent">
                  {formatDuration(grandTotalSeconds)}
                </p>
                <p className="text-xs text-text-muted">Total Time</p>
              </div>
              {grandTotalEarned > 0 && (
                <div className="sm:text-right">
                  <p className="font-mono text-lg font-bold text-accent">
                    {formatCurrency(grandTotalEarned)}
                  </p>
                  <p className="text-xs text-text-muted">Total Earned</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trail Summaries */}
      {trailSummaries.length === 0 ? (
        <EmptyState title={hasFilters ? 'No matching entries' : 'No completed time entries yet'}>
          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="font-medium text-accent hover:text-accent/80"
            >
              Clear filters
            </button>
          ) : (
            'Complete some timer sessions to see your report.'
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {trailSummaries.map((trail) => (
            <div
              key={trail.id}
              className="overflow-hidden glass-card shadow-card"
            >
              {/* Trail Header */}
              <button
                onClick={() => toggleCollapse(trail.id)}
                className="flex w-full items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-4 text-left hover:bg-surface-foreground/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span
                    className="h-4 w-4 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: trail.color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm sm:text-base font-bold text-text dark:text-white truncate">{trail.name}</p>
                      {trail.is_billable && (
                        <span className="hidden sm:inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          Billable
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {trail.entryCount} {trail.entryCount === 1 ? 'entry' : 'entries'} · {trail.projects.length} {trail.projects.length === 1 ? 'project' : 'projects'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-mono text-xs sm:text-sm font-medium text-text dark:text-white">
                      {formatDuration(trail.totalSeconds)}
                    </p>
                    <p className="hidden sm:block text-xs text-text-muted">Time</p>
                  </div>
                  {trail.is_billable && (
                    <div className="text-right">
                      <p className="font-mono text-xs sm:text-sm font-medium text-text dark:text-white">
                        {formatCurrency(trail.totalCost)}
                      </p>
                      <p className="hidden sm:block text-xs text-text-muted">Earned</p>
                    </div>
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-text-muted transition-transform ${collapsed[trail.id] ? '' : 'rotate-180'}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>

              {/* Project Breakdown */}
              {!collapsed[trail.id] && (
                <div className="border-t border-border">
                  <div className="divide-y divide-border">
                    {trail.projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 pl-6 sm:pl-12 hover:bg-surface-foreground/[0.02] dark:hover:bg-white/[0.02]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text dark:text-white truncate">{project.name}</p>
                          <p className="text-xs text-text-muted">
                            {project.entryCount} {project.entryCount === 1 ? 'entry' : 'entries'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="font-mono text-xs sm:text-sm text-text dark:text-white">
                              {formatDuration(project.totalSeconds)}
                            </p>
                          </div>
                          {trail.is_billable && (
                            <div className="text-right">
                              <p className="font-mono text-xs sm:text-sm text-text dark:text-white">
                                {formatCurrency(project.totalCost)}
                              </p>
                            </div>
                          )}
                          <div className="w-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

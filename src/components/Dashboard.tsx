'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import type { Rate } from '@/types/database'
import {
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  getAllRunningTimersWithProjects,
  calculateElapsedSeconds,
  formatDuration,
  calculateRunningCost,
  formatCurrency,
  type RunningTimerWithProject,
} from '@/lib/timer'
import EmptyState from '@/components/EmptyState'
import { seedDefaultTrails } from '@/lib/seed'

// Pure helper — compute effective rate from a cached rates array
function getEffectiveRateFromCache(
  trailId: string,
  projectId: string | null,
  rates: Rate[]
): number | null {
  const today = new Date().toISOString().split('T')[0]
  const active = rates.filter(
    (r) =>
      r.trail_id === trailId &&
      r.effective_from <= today &&
      (r.effective_until === null || r.effective_until >= today)
  )
  if (projectId) {
    const projectRates = active
      .filter((r) => r.project_id === projectId)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
    if (projectRates.length > 0) return Number(projectRates[0].hourly_rate)
  }
  const trailRates = active
    .filter((r) => r.project_id === null)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  if (trailRates.length > 0) return Number(trailRates[0].hourly_rate)
  return null
}

interface ProjectWithTrail {
  id: string
  name: string
  status: string
  trail_id: string
  trail_name: string
  trail_color: string
  trail_is_billable: boolean
  trail_kind: string
}

interface TrailGroup {
  trailId: string
  trailName: string
  trailColor: string
  trailIsBillable: boolean
  trailKind: string
  projects: ProjectWithTrail[]
}

interface TimerDisplayInfo {
  timeEntryId: string
  startTime: string
  elapsedSeconds: number
}

interface RecentEntry {
  id: string
  start_time: string
  end_time: string
  duration_seconds: number
  notes: string | null
  project_name: string
  project_id: string
  trail_name: string
  trail_color: string
  trail_is_billable: boolean
  trail_id: string
}

// Icons
const PlayIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
  </svg>
)

const PauseIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
  </svg>
)

const StopIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
  </svg>
)

const CircularProgress = ({
  value,
  max,
  children,
  size = 180,
  strokeWidth = 12,
}: {
  value: number
  max: number
  children: React.ReactNode
  size?: number
  strokeWidth?: number
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const dashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex items-center justify-center transition-all duration-700" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-surface-foreground/10 dark:text-white/10" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--color-accent)" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={dashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProjects(projectData: any[]): ProjectWithTrail[] {
  return projectData.map((p) => {
    const trail = p.trails || { id: '', name: 'Unknown', color: '#3A7D44', is_billable: false, kind: 'personal' }
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      trail_id: trail.id,
      trail_name: trail.name,
      trail_color: trail.color,
      trail_is_billable: trail.is_billable,
      trail_kind: trail.kind,
    }
  })
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectWithTrail[]>([])
  const [allRates, setAllRates] = useState<Rate[]>([])
  const [runningTimers, setRunningTimers] = useState<Map<string, TimerDisplayInfo>>(new Map())
  const [pausedProjects, setPausedProjects] = useState<Set<string>>(new Set())
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [showNonBillable, setShowNonBillable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase()

      // Fetch active projects with trail info
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, trails!inner(id, name, color, is_billable, kind, status)')
        .eq('status', 'active')
        .order('name')

      if (projectError) throw projectError

      let activeProjectData = projectData || []

      // Auto-seed default trails if no projects exist (first-time setup)
      if (activeProjectData.length === 0) {
        const { seeded } = await seedDefaultTrails()
        if (seeded) {
          const { data: seededData, error: seededError } = await supabase
            .from('projects')
            .select('*, trails!inner(id, name, color, is_billable, kind, status)')
            .eq('status', 'active')
            .order('name')
          if (!seededError && seededData) {
            activeProjectData = seededData
          }
        }
      }

      const mappedProjects = mapProjects(activeProjectData)
      const projectIds = mappedProjects.map((p) => p.id)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const pausedSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const [ratesResult, running, pausedResult, entriesResult] = await Promise.all([
        supabase.from('rates').select('*'),
        getAllRunningTimersWithProjects(),
        projectIds.length > 0
          ? supabase
              .from('time_entries')
              .select('project_id, end_time')
              .in('project_id', projectIds)
              .eq('is_running', false)
              .not('end_time', 'is', null)
              .gte('end_time', pausedSince)
              .order('end_time', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('time_entries')
          .select(`
            id, start_time, end_time, duration_seconds, notes, project_id,
            projects!inner(
              id,
              name,
              trail_id,
              trails!inner(id, name, color, is_billable)
            )
          `)
          .eq('is_running', false)
          .gte('start_time', todayStart.toISOString())
          .order('start_time', { ascending: false }),
      ])

      setProjects(mappedProjects)

      // Fetch running timers
      const timerMap = new Map<string, TimerDisplayInfo>()
      running.forEach((t: RunningTimerWithProject) => {
        timerMap.set(t.timeEntry.project_id, {
          timeEntryId: t.timeEntry.id,
          startTime: t.timeEntry.start_time,
          elapsedSeconds: calculateElapsedSeconds(t.timeEntry.start_time),
        })
      })
      setRunningTimers(timerMap)

      // Detect paused projects
      const pausedSet = new Set<string>()
      // A project is considered paused if it has a stopped entry in the last 24 hours
      // and does not currently have a running timer.
      if (!pausedResult.error && pausedResult.data) {
        pausedResult.data.forEach((entry: { project_id: string }) => {
          if (!timerMap.has(entry.project_id)) pausedSet.add(entry.project_id)
        })
      }
      setPausedProjects(pausedSet)

      setAllRates((ratesResult.data as Rate[]) || [])

      if (!entriesResult.error && entriesResult.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: RecentEntry[] = entriesResult.data.map((e: any) => {
          const trail = e.projects?.trails || { id: '', name: 'Unknown', color: '#3A7D44', is_billable: false }
          return {
            id: e.id,
            start_time: e.start_time,
            end_time: e.end_time,
            duration_seconds: e.duration_seconds ?? 0,
            notes: e.notes,
            project_name: e.projects?.name || 'Unknown',
            project_id: e.project_id,
            trail_name: trail.name,
            trail_color: trail.color,
            trail_is_billable: trail.is_billable,
            trail_id: trail.id,
          }
        })
        setRecentEntries(mapped)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Tick elapsed seconds every second
  useEffect(() => {
    if (runningTimers.size === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setRunningTimers((prev) => {
        const updated = new Map(prev)
        updated.forEach((info, projectId) => {
          updated.set(projectId, {
            ...info,
            elapsedSeconds: calculateElapsedSeconds(info.startTime),
          })
        })
        return updated
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [runningTimers.size])

  async function handleStart(projectId: string) {
    setActionLoading(projectId)
    const result = await startTimer(projectId)
    if (result.success) await loadData()
    setActionLoading(null)
  }

  async function handleStop(projectId: string) {
    const timer = runningTimers.get(projectId)
    if (!timer) return
    setActionLoading(projectId)
    const result = await stopTimer(timer.timeEntryId)
    if (result.success) await loadData()
    setActionLoading(null)
  }

  async function handlePause(projectId: string) {
    setActionLoading(projectId)
    const result = await pauseTimer(projectId)
    if (result.success) await loadData()
    setActionLoading(null)
  }

  async function handleResume(projectId: string) {
    setActionLoading(projectId)
    const result = await resumeTimer(projectId)
    if (result.success) await loadData()
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card p-4 skeleton-card sm:p-6">
            <div className="mb-4 space-y-3">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-6 w-32 rounded" />
            </div>
            <div className="skeleton mb-4 h-4 w-16 rounded" />
            <div className="skeleton h-12 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card border-red-500/30 bg-red-900/10 p-6">
        <p className="text-red-400">Failed to load dashboard: {error}</p>
        <button onClick={loadData} className="mt-3 rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10">
          Retry
        </button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <EmptyState title="No active projects">
        Add a trail and project from the{' '}
        <Link href="/trails" className="font-medium text-accent hover:text-accent-light">
          Trails
        </Link>{' '}
        page to get started.
      </EmptyState>
    )
  }

  // Group projects by trail
  const trailGroupMap = new Map<string, TrailGroup>()
  for (const p of projects) {
    if (!trailGroupMap.has(p.trail_id)) {
      trailGroupMap.set(p.trail_id, {
        trailId: p.trail_id,
        trailName: p.trail_name,
        trailColor: p.trail_color,
        trailIsBillable: p.trail_is_billable,
        trailKind: p.trail_kind,
        projects: [],
      })
    }
    trailGroupMap.get(p.trail_id)!.projects.push(p)
  }
  const allTrailGroups = Array.from(trailGroupMap.values())
  const billableGroups = allTrailGroups.filter((g) => g.trailIsBillable)
  const nonBillableGroups = allTrailGroups.filter((g) => !g.trailIsBillable)

  // Today's summary
  const completedSeconds = recentEntries.reduce((sum, e) => sum + e.duration_seconds, 0)
  const completedBillableEarnings = recentEntries
    .filter((e) => e.trail_is_billable)
    .reduce((sum, e) => {
      const rate = getEffectiveRateFromCache(e.trail_id, e.project_id, allRates)
      return sum + (rate ? calculateRunningCost(e.duration_seconds, rate) : 0)
    }, 0)

  let runningSeconds = 0
  let runningBillableEarnings = 0
  runningTimers.forEach((timer, projectId) => {
    runningSeconds += timer.elapsedSeconds
    const project = projects.find((p) => p.id === projectId)
    if (project?.trail_is_billable) {
      const rate = getEffectiveRateFromCache(project.trail_id, project.id, allRates)
      if (rate) runningBillableEarnings += calculateRunningCost(timer.elapsedSeconds, rate)
    }
  })

  const totalSeconds = completedSeconds + runningSeconds
  const totalEarnings = completedBillableEarnings + runningBillableEarnings
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const runningCount = runningTimers.size

  function renderProjectCard(project: ProjectWithTrail, group: TrailGroup) {
    const timer = runningTimers.get(project.id)
    const isRunning = !!timer
    const isPaused = pausedProjects.has(project.id)
    const isDisabled = actionLoading === project.id
    const canQuickStart = !isRunning && !isPaused && !isDisabled
    const effectiveRate = group.trailIsBillable
      ? getEffectiveRateFromCache(group.trailId, project.id, allRates)
      : null
    const currentCost =
      isRunning && timer && effectiveRate !== null
        ? calculateRunningCost(timer.elapsedSeconds, effectiveRate)
        : null

    return (
      <div
        key={project.id}
        onClick={() => {
          if (canQuickStart) handleStart(project.id)
          else if (isPaused && !isRunning && !isDisabled) handleResume(project.id)
        }}
        className={`group relative overflow-hidden glass-card p-4 transition-all duration-300 hover:scale-[1.01] hover:bg-surface-foreground/5 sm:p-6 sm:hover:scale-[1.02] dark:hover:bg-white/5 ${
          isRunning ? 'ring-1 ring-accent shadow-[0_0_20px_rgba(132,204,22,0.15)] bg-accent/5' : ''
        } ${canQuickStart || (isPaused && !isRunning) ? 'cursor-pointer' : ''}`}
      >
        {/* Status indicator */}
        <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
          {isRunning ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/10 border border-accent/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Active</span>
            </div>
          ) : isPaused ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-500/10 border border-slate-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paused</span>
            </div>
          ) : null}
        </div>

        {/* Trail + Project */}
        <div className="mb-4 pr-14 sm:pr-16">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.trailColor }} />
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{group.trailName}</p>
          </div>
          <p className="text-lg font-bold leading-tight text-text transition-colors group-hover:text-accent sm:text-xl dark:text-white">
            {project.name}
          </p>
        </div>

        {/* Timer & Cost */}
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
          <div>
            <p className="text-xs text-text-muted mb-1">Current Session</p>
            <p className={`font-mono text-xl font-bold sm:text-2xl ${isRunning ? 'text-accent' : 'text-text/60 dark:text-white/60'}`}>
              {isRunning && timer ? formatDuration(timer.elapsedSeconds) : '00:00:00'}
            </p>
          </div>
          {effectiveRate !== null && (
            <div className="shrink-0 text-right">
              {currentCost !== null && isRunning ? (
                <>
                  <p className="text-xs text-text-muted mb-1">Earned</p>
                  <p className="text-sm font-medium text-accent">{formatCurrency(currentCost)}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-text-muted mb-1">Rate</p>
                  <p className="text-sm font-medium text-text/80 dark:text-white/80">{formatCurrency(effectiveRate)}/hr</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isRunning ? (
            <>
              <button
                onClick={() => handlePause(project.id)}
                disabled={isDisabled}
                className="flex-1 rounded-full h-12 flex items-center justify-center bg-slate-700/50 hover:bg-slate-700 text-white transition-all disabled:opacity-50"
                title="Pause Timer"
              >
                <PauseIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => handleStop(project.id)}
                disabled={isDisabled}
                className="flex-1 rounded-full h-12 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/30 transition-all disabled:opacity-50"
                title="Stop Timer"
              >
                <StopIcon className="w-6 h-6" />
              </button>
            </>
          ) : pausedProjects.has(project.id) ? (
            <button
              onClick={() => handleResume(project.id)}
              disabled={isDisabled}
              className="w-full rounded-full h-12 flex items-center justify-center gap-2 bg-accent hover:bg-accent-light text-black font-bold transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
            >
              <PlayIcon className="w-5 h-5" />
              Resume
            </button>
          ) : (
            <button
              onClick={() => handleStart(project.id)}
              disabled={isDisabled}
              className="w-full rounded-full h-12 flex items-center justify-center gap-2 bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 border border-border text-text dark:text-white font-medium group-hover:bg-accent group-hover:text-black group-hover:border-accent transition-all disabled:opacity-50"
            >
              <PlayIcon className="w-5 h-5" />
              Start Timer
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderTrailGroup(group: TrailGroup) {
    const trailRate = group.trailIsBillable
      ? getEffectiveRateFromCache(group.trailId, null, allRates)
      : null

    return (
      <div key={group.trailId} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.trailColor }} />
          <h3 className="min-w-0 flex-1 text-base font-semibold text-text dark:text-white/90">{group.trailName}</h3>
          {trailRate !== null && (
            <span className="shrink-0 rounded-full bg-surface-foreground/5 px-2 py-0.5 text-xs text-text-muted dark:bg-white/5">
              {formatCurrency(trailRate)}/hr
            </span>
          )}
          <span className="hidden text-xs capitalize text-text-muted sm:block">{group.trailKind}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {group.projects.map((project) => renderProjectCard(project, group))}
        </div>
      </div>
    )
  }

  return (
    <div className="content-enter space-y-7 sm:space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center pb-2 pt-1 sm:py-6">
        <div className="scale-90 transform transition-transform duration-300 sm:scale-100">
          <CircularProgress value={totalSeconds} max={28800} size={220}>
            <div className="flex flex-col items-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-text-muted mb-2">Today</span>
              <div className="mb-1 text-4xl font-bold tracking-tight text-text sm:text-5xl dark:text-white">
                {hours}<span className="mx-1 text-xl text-text-muted sm:text-2xl">h</span>
                {mins}<span className="text-xl text-text-muted sm:text-2xl">m</span>
              </div>
              <div className="text-lg font-medium text-accent">
                {formatCurrency(totalEarnings)}
              </div>
            </div>
          </CircularProgress>
        </div>

        <div className="glass-panel mt-2 grid w-full max-w-sm grid-cols-3 items-stretch overflow-hidden rounded-2xl px-0 py-0 text-sm text-text-muted sm:mt-4 sm:flex sm:w-auto sm:max-w-none sm:items-center sm:gap-6 sm:rounded-full sm:px-6 sm:py-3">
          <div className="px-3 py-3 text-center sm:p-0">
            <p className="mb-0.5 text-[11px] uppercase tracking-wider sm:text-xs">Entries</p>
            <p className="font-semibold text-text dark:text-white">{recentEntries.length}</p>
          </div>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <div className="border-x border-border px-3 py-3 text-center sm:border-x-0 sm:p-0">
            <p className="mb-0.5 text-[11px] uppercase tracking-wider sm:text-xs">Billable</p>
            <p className="font-semibold text-accent">{formatCurrency(totalEarnings)}</p>
          </div>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <div className="px-3 py-3 text-center sm:p-0">
            {runningCount > 0 ? (
              <>
                <p className="mb-0.5 text-[11px] uppercase tracking-wider sm:text-xs">Active</p>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <p className="font-semibold text-text dark:text-white">{runningCount}</p>
                </div>
              </>
            ) : (
              <>
                <p className="mb-0.5 text-[11px] uppercase tracking-wider sm:text-xs">Status</p>
                <p className="font-semibold text-text dark:text-white">Ready</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Billable Trails */}
      {billableGroups.length > 0 && (
        <div className="space-y-6 sm:space-y-8">
          <h2 className="text-lg font-semibold text-text dark:text-white/90 pl-2 border-l-4 border-accent">
            Billable
          </h2>
          {billableGroups.map(renderTrailGroup)}
        </div>
      )}

      {/* Non-billable toggle */}
      {nonBillableGroups.length > 0 && (
        <div className="space-y-6">
          <button
            onClick={() => setShowNonBillable((v) => !v)}
            className="flex min-h-11 items-center gap-2 border-l-4 border-border pl-2 text-sm font-medium text-text-muted transition-colors hover:text-text dark:hover:text-white"
          >
            <span>{showNonBillable ? 'Hide' : 'Show'} non-billable trails</span>
            <span className="text-xs">{showNonBillable ? '▲' : '▼'}</span>
          </button>

          {showNonBillable && (
            <div className="space-y-8">
              {nonBillableGroups.map(renderTrailGroup)}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      {recentEntries.length > 0 && (
        <div className="mt-10 sm:mt-12">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text dark:text-white/90 pl-2 border-l-4 border-slate-500">
              Recent Activity
            </h2>
            <span className="shrink-0 rounded bg-surface-foreground/5 px-2 py-1 text-xs font-medium uppercase tracking-wider text-text-muted dark:bg-white/5">
              {recentEntries.length} {recentEntries.length === 1 ? 'entry' : 'entries'} today
            </span>
          </div>
          <div className="glass-panel overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-black/5 dark:bg-black/20 text-xs font-bold uppercase tracking-widest text-text-muted">
              <div className="col-span-5">Project</div>
              <div className="col-span-3">Trail</div>
              <div className="col-span-2 text-right">Time</div>
              <div className="col-span-2 text-right">Earned</div>
            </div>
            <div>
              {recentEntries.map((entry, index) => {
                const rate = entry.trail_is_billable
                  ? getEffectiveRateFromCache(entry.trail_id, entry.project_id, allRates)
                  : null
                const cost = rate ? calculateRunningCost(entry.duration_seconds, rate) : null
                const startDate = new Date(entry.start_time)
                const endDate = new Date(entry.end_time)
                const timeRange = `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`

                return (
                  <div
                    key={entry.id}
                    className={`group flex flex-col gap-2 border-b border-border px-4 py-4 transition-colors last:border-0 hover:bg-surface-foreground/5 sm:grid sm:grid-cols-12 sm:gap-4 sm:px-6 dark:hover:bg-white/5 ${
                      index % 2 === 0 ? 'bg-transparent' : 'bg-surface-foreground/[0.02] dark:bg-white/[0.02]'
                    }`}
                  >
                    <div className="col-span-5">
                      <p className="font-medium text-text dark:text-white truncate group-hover:text-accent transition-colors">
                        {entry.project_name}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-text-muted mt-0.5 truncate">{entry.notes}</p>
                      )}
                    </div>

                    <div className="col-span-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.trail_color }} />
                      <p className="text-sm text-text-muted truncate">{entry.trail_name}</p>
                    </div>

                    <div className="col-span-2 text-left sm:text-right">
                      <p className="font-mono text-sm font-medium text-text dark:text-white">
                        {formatDuration(entry.duration_seconds)}
                      </p>
                      <p className="text-xs text-text-muted sm:hidden md:block">{timeRange}</p>
                    </div>

                    <div className="col-span-2 text-left sm:text-right">
                      {cost !== null ? (
                        <p className="font-medium text-accent">{formatCurrency(cost)}</p>
                      ) : (
                        <p className="text-sm text-text-muted">—</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  getAllRunningTimersWithProjects,
  getPausedTimerForProject,
  calculateElapsedSeconds,
  formatDuration,
  calculateRunningCost,
  formatCurrency,
  type RunningTimerWithProject,
} from '@/lib/timer'

interface ProjectWithClient {
  id: string
  name: string
  hourly_rate_override: number | null
  status: string
  client_id: string
  client_name: string
  client_color: string
  client_hourly_rate: number
  effectiveRate: number
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
  client_name: string
  client_color: string
  effectiveRate: number
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectWithClient[]>([])
  const [runningTimers, setRunningTimers] = useState<Map<string, TimerDisplayInfo>>(new Map())
  const [pausedProjects, setPausedProjects] = useState<Set<string>>(new Set())
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase()

      // Fetch active projects with client info
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, clients!inner(id, name, hourly_rate, color)')
        .eq('status', 'active')
        .order('name')

      if (projectError) throw projectError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedProjects: ProjectWithClient[] = (projectData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        hourly_rate_override: p.hourly_rate_override,
        status: p.status,
        client_id: p.clients.id,
        client_name: p.clients.name,
        client_color: p.clients.color,
        client_hourly_rate: p.clients.hourly_rate,
        effectiveRate: p.hourly_rate_override ?? p.clients.hourly_rate,
      }))

      setProjects(mappedProjects)

      // Fetch running timers
      const running = await getAllRunningTimersWithProjects()
      const timerMap = new Map<string, TimerDisplayInfo>()
      running.forEach((t: RunningTimerWithProject) => {
        timerMap.set(t.timeEntry.project_id, {
          timeEntryId: t.timeEntry.id,
          startTime: t.timeEntry.start_time,
          elapsedSeconds: calculateElapsedSeconds(t.timeEntry.start_time),
        })
      })
      setRunningTimers(timerMap)

      // Detect paused projects (recently stopped, not currently running)
      const pausedSet = new Set<string>()
      const pauseChecks = mappedProjects
        .filter((p) => !timerMap.has(p.id))
        .map(async (p) => {
          const paused = await getPausedTimerForProject(p.id)
          if (paused) pausedSet.add(p.id)
        })
      await Promise.all(pauseChecks)
      setPausedProjects(pausedSet)

      // Fetch today's completed entries for Recent Activity
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: todayEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select(`
          id, start_time, end_time, duration_seconds, notes,
          projects!inner(
            name,
            hourly_rate_override,
            clients!inner(name, hourly_rate, color)
          )
        `)
        .eq('is_running', false)
        .gte('start_time', todayStart.toISOString())
        .order('start_time', { ascending: false })

      if (!entriesError && todayEntries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: RecentEntry[] = todayEntries.map((e: any) => ({
          id: e.id,
          start_time: e.start_time,
          end_time: e.end_time,
          duration_seconds: e.duration_seconds ?? 0,
          notes: e.notes,
          project_name: e.projects.name,
          client_name: e.projects.clients.name,
          client_color: e.projects.clients.color,
          effectiveRate: e.projects.hourly_rate_override ?? e.projects.clients.hourly_rate,
        }))
        setRecentEntries(mapped)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [loadData])

  // Tick elapsed seconds every second for running timers
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
    if (result.success) {
      await loadData()
    }
    setActionLoading(null)
  }

  async function handleStop(projectId: string) {
    const timer = runningTimers.get(projectId)
    if (!timer) return
    setActionLoading(projectId)
    const result = await stopTimer(timer.timeEntryId)
    if (result.success) {
      await loadData()
    }
    setActionLoading(null)
  }

  async function handlePause(projectId: string) {
    setActionLoading(projectId)
    const result = await pauseTimer(projectId)
    if (result.success) {
      await loadData()
    }
    setActionLoading(null)
  }

  async function handleResume(projectId: string) {
    setActionLoading(projectId)
    const result = await resumeTimer(projectId)
    if (result.success) {
      await loadData()
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-background p-6 shadow-card">
        <div className="animate-pulse text-text-muted">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 p-6">
        <p className="text-red-600">Failed to load dashboard: {error}</p>
        <button
          onClick={loadData}
          className="mt-2 text-sm font-medium text-primary hover:text-primary-dark"
        >
          Retry
        </button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-card border border-border bg-background py-16 shadow-card">
        <p className="mb-2 text-lg font-semibold text-text">No active projects</p>
        <p className="text-text-muted">
          Add a client and project from the{' '}
          <a href="/clients" className="font-medium text-primary hover:text-primary-dark">
            Clients
          </a>{' '}
          or{' '}
          <a href="/projects" className="font-medium text-primary hover:text-primary-dark">
            Projects
          </a>{' '}
          page to get started.
        </p>
      </div>
    )
  }

  const runningCount = runningTimers.size

  return (
    <div>
      {/* Summary bar */}
      {runningCount > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-text-muted">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span>
            {runningCount} timer{runningCount !== 1 ? 's' : ''} running
          </span>
        </div>
      )}

      {/* Project cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const timer = runningTimers.get(project.id)
          const isRunning = !!timer
          const isPaused = pausedProjects.has(project.id)
          const isDisabled = actionLoading === project.id

          const canQuickStart = !isRunning && !isPaused && !isDisabled

          return (
            <div
              key={project.id}
              onClick={() => {
                if (canQuickStart) handleStart(project.id)
                else if (isPaused && !isRunning && !isDisabled) handleResume(project.id)
              }}
              className={`relative overflow-hidden rounded-card border-2 bg-background p-5 shadow-card transition-shadow hover:shadow-md ${
                isRunning ? 'ring-2 ring-primary/20' : ''
              } ${canQuickStart || (isPaused && !isRunning) ? 'cursor-pointer' : ''}`}
              style={{ borderColor: project.client_color }}
            >
              {/* Status indicator */}
              {isRunning && (
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs font-medium text-primary">Running</span>
                </div>
              )}
              {isPaused && !isRunning && (
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <span className="inline-flex h-3 w-3 rounded-full bg-accent" />
                  <span className="text-xs font-medium text-accent">Paused</span>
                </div>
              )}

              {/* Client + Project */}
              <div className="mb-3">
                <p className="text-sm font-medium text-text-muted">{project.client_name}</p>
                <p className="text-lg font-semibold text-text">{project.name}</p>
              </div>

              {/* Rate info */}
              <p className="mb-3 text-sm text-text-muted">
                {formatCurrency(project.effectiveRate)}/hr
              </p>

              {/* Timer display (when running) */}
              {isRunning && timer && (
                <div className="mb-4">
                  <p className="font-mono text-2xl font-bold text-accent">
                    {formatDuration(timer.elapsedSeconds)}
                  </p>
                  <p className="text-sm text-text-muted">
                    {formatCurrency(calculateRunningCost(timer.elapsedSeconds, project.effectiveRate))}
                  </p>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {isRunning ? (
                  <>
                    <button
                      onClick={() => handlePause(project.id)}
                      disabled={isDisabled}
                      className="flex-1 rounded-button bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => handleStop(project.id)}
                      disabled={isDisabled}
                      className="flex-1 rounded-button bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      Stop
                    </button>
                  </>
                ) : pausedProjects.has(project.id) ? (
                  <button
                    onClick={() => handleResume(project.id)}
                    disabled={isDisabled}
                    className="flex-1 rounded-button bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button
                    onClick={() => handleStart(project.id)}
                    disabled={isDisabled}
                    className="flex-1 rounded-button bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    Start Timer
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      {recentEntries.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text">Recent Activity</h2>
            <span className="text-sm text-text-muted">
              Today: {recentEntries.length} {recentEntries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-background shadow-card">
            {recentEntries.map((entry) => {
              const cost = calculateRunningCost(entry.duration_seconds, entry.effectiveRate)
              const startDate = new Date(entry.start_time)
              const endDate = new Date(entry.end_time)
              const timeRange = `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`

              return (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: entry.client_color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {entry.project_name}
                      {entry.notes && (
                        <span className="ml-1 font-normal text-text-muted">— {entry.notes}</span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">
                      {entry.client_name} · {timeRange}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-mono text-sm font-medium text-text">
                      {formatDuration(entry.duration_seconds)}
                    </p>
                    <p className="text-xs text-text-muted">{formatCurrency(cost)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

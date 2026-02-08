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
import EmptyState from '@/components/EmptyState'
import { seedDefaultClients } from '@/lib/seed'

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

// Circular Progress Component
const CircularProgress = ({ value, max, children, size = 180, strokeWidth = 12 }: { value: number, max: number, children: React.ReactNode, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  // Cap at max or allow overflow (looping) visual? Let's just clamp for simple progress or loop.
  // Assuming 8 hours (28800s) as a "full day" target for visualization, or just use a visual filler.
  // Let's us 8 hours as '100%'.
  const percentage = Math.min(100, Math.max(0, (value / (8 * 3600)) * 100))
  const dashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex items-center justify-center transition-all duration-700" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-surface-foreground/10 dark:text-white/10"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-accent)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  )
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
        .select('*, clients(id, name, hourly_rate, color)')
        .eq('status', 'active')
        .order('name')

      if (projectError) throw projectError

      // Auto-seed default clients if no projects exist (first-time setup)
      if (!projectData || projectData.length === 0) {
        const { seeded } = await seedDefaultClients()
        if (seeded) {
          // Re-fetch projects after seeding
          const { data: seededData, error: seededError } = await supabase
            .from('projects')
            .select('*, clients(id, name, hourly_rate, color)')
            .eq('status', 'active')
            .order('name')
          if (!seededError && seededData) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const seededProjects: ProjectWithClient[] = seededData.map((p: any) => {
              const client = p.clients || { id: '', name: 'Unknown', hourly_rate: 0, color: '#000000' }
              return {
                id: p.id,
                name: p.name,
                hourly_rate_override: p.hourly_rate_override,
                status: p.status,
                client_id: client.id,
                client_name: client.name,
                client_color: client.color,
                client_hourly_rate: client.hourly_rate,
                effectiveRate: p.hourly_rate_override ?? client.hourly_rate,
              }
            })
            setProjects(seededProjects)
            setLoading(false)
            return
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedProjects: ProjectWithClient[] = (projectData || []).map((p: any) => {
        const client = p.clients || { id: '', name: 'Unknown', hourly_rate: 0, color: '#000000' }
        return {
          id: p.id,
          name: p.name,
          hourly_rate_override: p.hourly_rate_override,
          status: p.status,
          client_id: client.id,
          client_name: client.name,
          client_color: client.color,
          client_hourly_rate: client.hourly_rate,
          effectiveRate: p.hourly_rate_override ?? client.hourly_rate,
        }
      })

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
            clients(name, hourly_rate, color)
          )
        `)
        .eq('is_running', false)
        .gte('start_time', todayStart.toISOString())
        .order('start_time', { ascending: false })

      if (!entriesError && todayEntries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: RecentEntry[] = todayEntries.map((e: any) => {
          const client = e.projects.clients || { name: 'Unknown', hourly_rate: 0, color: '#000000' }
          return {
            id: e.id,
            start_time: e.start_time,
            end_time: e.end_time,
            duration_seconds: e.duration_seconds ?? 0,
            notes: e.notes,
            project_name: e.projects.name,
            client_name: client.name,
            client_color: client.color,
            effectiveRate: e.projects.hourly_rate_override ?? client.hourly_rate,
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="mb-4 space-y-3">
              <div className="h-3 w-20 rounded bg-surface-foreground/10 dark:bg-white/10" />
              <div className="h-6 w-32 rounded bg-surface-foreground/10 dark:bg-white/10" />
            </div>
            <div className="mb-4 h-4 w-16 rounded bg-surface-foreground/10 dark:bg-white/10" />
            <div className="h-12 rounded-full bg-surface-foreground/10 dark:bg-white/10" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card border-red-500/30 bg-red-900/10 p-6">
        <p className="text-red-400">Failed to load dashboard: {error}</p>
        <button
          onClick={loadData}
          className="mt-3 rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
        >
          Retry
        </button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <EmptyState title="No active projects">
        Add a client and project from the{' '}
        <a href="/clients" className="font-medium text-accent hover:text-accent-light">
          Clients
        </a>{' '}
        or{' '}
        <a href="/projects" className="font-medium text-accent hover:text-accent-light">
          Projects
        </a>{' '}
        page to get started.
      </EmptyState>
    )
  }

  const runningCount = runningTimers.size

  // Calculate today's summary: completed entries + running timers
  const completedSeconds = recentEntries.reduce((sum, e) => sum + e.duration_seconds, 0)
  const completedEarnings = recentEntries.reduce(
    (sum, e) => sum + calculateRunningCost(e.duration_seconds, e.effectiveRate),
    0
  )

  let runningSeconds = 0
  let runningEarnings = 0
  runningTimers.forEach((timer, projectId) => {
    runningSeconds += timer.elapsedSeconds
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      runningEarnings += calculateRunningCost(timer.elapsedSeconds, project.effectiveRate)
    }
  })

  const totalSeconds = completedSeconds + runningSeconds
  const totalEarnings = completedEarnings + runningEarnings
  const showSummary = true // Always show hero area for look and feel

  // Formatting helpers for the hero
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center py-6">
        <div className="transform scale-75 sm:scale-100 transition-transform duration-300">
          <CircularProgress value={totalSeconds} max={28800} size={240}>
            <div className="flex flex-col items-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-text-muted mb-2">Today</span>
              <div className="text-5xl font-bold tracking-tight text-text dark:text-white mb-1">
                {hours}<span className="text-2xl text-text-muted mx-1">h</span>
                {mins}<span className="text-2xl text-text-muted">m</span>
              </div>
              <div className="text-lg font-medium text-accent">
                {formatCurrency(totalEarnings)}
              </div>
            </div>
          </CircularProgress>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm text-text-muted/80 glass-panel px-4 py-2 rounded-full">
          {runningCount > 0 ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              <span>{runningCount} project{runningCount !== 1 ? 's' : ''} active</span>
            </>
          ) : (
            <span>Ready to explore</span>
          )}
        </div>
      </div>

      {/* Project cards grid */}
      <h3 className="text-lg font-semibold text-text dark:text-white/90 pl-2 border-l-4 border-accent">Projects</h3>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              className={`group relative overflow-hidden glass-card p-6 transition-all duration-300 hover:scale-[1.02] hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${isRunning ? 'ring-1 ring-accent shadow-[0_0_20px_rgba(132,204,22,0.15)] bg-accent/5' : ''
                } ${canQuickStart || (isPaused && !isRunning) ? 'cursor-pointer' : ''}`}
            >
              {/* Status indicator (Top Right) */}
              <div className="absolute top-4 right-4">
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
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paused</span>
                  </div>
                ) : null}
              </div>

              {/* Client + Project */}
              <div className="mb-4 pr-16">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.client_color }}></span>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{project.client_name}</p>
                </div>
                <p className="text-xl font-bold text-text dark:text-white group-hover:text-accent transition-colors">{project.name}</p>
              </div>

              {/* Timer & Rate Area */}
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-xs text-text-muted mb-1">Current Session</p>
                  <p className={`font-mono text-2xl font-bold ${isRunning ? 'text-accent' : 'text-text/60 dark:text-white/60'}`}>
                    {isRunning && timer ? formatDuration(timer.elapsedSeconds) : '00:00:00'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted mb-1">Rate</p>
                  <p className="text-sm font-medium text-text/80 dark:text-white/80">{formatCurrency(project.effectiveRate)}/hr</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
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
        })}
      </div>

      {/* Recent Activity */}
      {recentEntries.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text dark:text-white/90 pl-2 border-l-4 border-slate-500">Recent Activity</h2>
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-surface-foreground/5 dark:bg-white/5 px-2 py-1 rounded">
              {recentEntries.length} {recentEntries.length === 1 ? 'entry' : 'entries'} today
            </span>
          </div>
          <div className="glass-panel overflow-hidden">
            {/* List Header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-black/5 dark:bg-black/20 text-xs font-bold uppercase tracking-widest text-text-muted">
              <div className="col-span-5">Project / Task</div>
              <div className="col-span-3">Client</div>
              <div className="col-span-2 text-right">Time</div>
              <div className="col-span-2 text-right">Earned</div>
            </div>

            {/* List Body */}
            <div>
              {recentEntries.map((entry, index) => {
                const cost = calculateRunningCost(entry.duration_seconds, entry.effectiveRate)
                const startDate = new Date(entry.start_time)
                const endDate = new Date(entry.end_time)
                const timeRange = `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`

                return (
                  <div key={entry.id} className={`group flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-4 border-b border-border last:border-0 hover:bg-surface-foreground/5 dark:hover:bg-white/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-surface-foreground/[0.02] dark:bg-white/[0.02]'}`}>
                    <div className="col-span-5">
                      <p className="font-medium text-text dark:text-white truncate group-hover:text-accent transition-colors">{entry.project_name}</p>
                      {entry.notes && (
                        <p className="text-xs text-text-muted mt-0.5 truncate">{entry.notes}</p>
                      )}
                    </div>

                    <div className="col-span-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.client_color }}></span>
                      <p className="text-sm text-text-muted">{entry.client_name}</p>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="font-mono text-sm font-medium text-text dark:text-white">
                        {formatDuration(entry.duration_seconds)}
                      </p>
                      <p className="text-xs text-text-muted sm:hidden md:block lg:block">{timeRange}</p>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="font-medium text-accent">{formatCurrency(cost)}</p>
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

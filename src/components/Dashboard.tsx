'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Compass,
  Search,
  Folder,
  Play,
  Pause,
  Square,
  Check,
  ChevronDown,
  Plus,
  Clock,
  DollarSign,
  ListTodo,
  FileText,
  X
} from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import type { Rate } from '@/types/database'
import { gatherBriefingInputs } from '@/lib/briefing/gather'
import { synthesizeBriefing } from '@/lib/briefing/synthesize'
import type { BriefingData, LoopWithProject } from '@/lib/briefing/types'
import {
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  updateTimeEntry,
  calculateElapsedSeconds,
  formatDuration,
  calculateRunningCost,
  formatCurrency,
} from '@/lib/timer'
import EmptyState from '@/components/EmptyState'
import { seedDefaultTrails } from '@/lib/seed'

function getEffectiveRateFromCache(
  trailId: string,
  projectId: string | null,
  rates: Rate[]
): number | null {
  const today = new Date().toISOString().split('T')[0]
  const active = rates.filter(
    (rate) =>
      rate.trail_id === trailId &&
      rate.effective_from <= today &&
      (rate.effective_until === null || rate.effective_until >= today)
  )

  if (projectId) {
    const projectRates = active
      .filter((rate) => rate.project_id === projectId)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
    if (projectRates.length > 0) return Number(projectRates[0].hourly_rate)
  }

  const trailRates = active
    .filter((rate) => rate.project_id === null)
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

interface RunningTimerRow {
  id: string
  project_id: string
  start_time: string
}

interface StoppedEntryRow {
  id: string
  start_time: string
  end_time: string
  duration_seconds: number | null
  notes: string | null
  project_id: string
  projects?: {
    name?: string
    trails?: {
      id: string
      name: string
      color: string
      is_billable: boolean
    } | null
  } | null
}

interface JustCompletedEntry {
  id: string
  project_id: string
  start_time: string
  end_time: string
  duration_seconds: number
  projectName: string
  trailId: string
  trailName: string
  trailColor: string
  trailIsBillable: boolean
  notes: string
  logObservation?: boolean
  observationText?: string
  selectedLoopId?: string
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProjects(projectData: any[]): ProjectWithTrail[] {
  return projectData.map((project) => {
    const trail = project.trails || { id: '', name: 'Unknown', color: '#3A7D44', is_billable: false, kind: 'personal' }
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      trail_id: trail.id,
      trail_name: trail.name,
      trail_color: trail.color,
      trail_is_billable: trail.is_billable,
      trail_kind: trail.kind,
    }
  })
}

export default function Dashboard() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(true)
  const [briefingError, setBriefingError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectWithTrail[]>([])
  const [allRates, setAllRates] = useState<Rate[]>([])
  const [runningTimers, setRunningTimers] = useState<Map<string, TimerDisplayInfo>>(new Map())
  const [pausedProjects, setPausedProjects] = useState<Set<string>>(new Set())
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showLoadingShell, setShowLoadingShell] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Redesigned timer states
  const [justCompletedQueue, setJustCompletedQueue] = useState<JustCompletedEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [rawOpenLoops, setRawOpenLoops] = useState<LoopWithProject[]>([])

  const loadBriefing = useCallback(async () => {
    try {
      setBriefingLoading(true)
      const inputs = await gatherBriefingInputs()
      setBriefing(synthesizeBriefing(inputs))
      setRawOpenLoops(inputs.openLoops)
      setBriefingError(null)
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : 'Failed to load orientation data')
    } finally {
      setBriefingLoading(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, trails!inner(id, name, color, is_billable, kind, status)')
        .eq('status', 'active')
        .order('name')

      if (projectError) throw projectError

      let activeProjectData = projectData || []
      if (activeProjectData.length === 0) {
        const { seeded } = await seedDefaultTrails()
        if (seeded) {
          const { data: seededData, error: seededError } = await supabase
            .from('projects')
            .select('*, trails!inner(id, name, color, is_billable, kind, status)')
            .eq('status', 'active')
            .order('name')
          if (!seededError && seededData) activeProjectData = seededData
        }
      }

      const mappedProjects = mapProjects(activeProjectData)
      const projectIds = mappedProjects.map((project) => project.id)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const pausedSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const [ratesResult, runningResult, entriesResult] = await Promise.all([
        supabase.from('rates').select('*'),
        supabase
          .from('time_entries')
          .select('id, project_id, start_time')
          .eq('is_running', true)
          .order('start_time', { ascending: false }),
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
          .not('end_time', 'is', null)
          .gte('end_time', pausedSince)
          .order('start_time', { ascending: false }),
      ])

      setProjects(mappedProjects)

      const timerMap = new Map<string, TimerDisplayInfo>()
      if (!runningResult.error && runningResult.data) {
        ;(runningResult.data as RunningTimerRow[]).forEach((timer) => {
          timerMap.set(timer.project_id, {
            timeEntryId: timer.id,
            startTime: timer.start_time,
            elapsedSeconds: calculateElapsedSeconds(timer.start_time),
          })
        })
      }
      setRunningTimers(timerMap)

      const pausedSet = new Set<string>()
      if (!entriesResult.error && entriesResult.data) {
        ;(entriesResult.data as StoppedEntryRow[]).forEach((entry) => {
          if (projectIds.includes(entry.project_id) && !timerMap.has(entry.project_id)) {
            pausedSet.add(entry.project_id)
          }
        })
      }
      setPausedProjects(pausedSet)

      setAllRates((ratesResult.data as Rate[]) || [])

      if (!entriesResult.error && entriesResult.data) {
        const mapped: RecentEntry[] = (entriesResult.data as StoppedEntryRow[])
          .filter((entry) => entry.start_time >= todayStart.toISOString())
          .map((entry) => {
            const trail = entry.projects?.trails || { id: '', name: 'Unknown', color: '#3A7D44', is_billable: false }
            return {
              id: entry.id,
              start_time: entry.start_time,
              end_time: entry.end_time,
              duration_seconds: entry.duration_seconds ?? 0,
              notes: entry.notes,
              project_name: entry.projects?.name || 'Unknown',
              project_id: entry.project_id,
              trail_name: trail.name,
              trail_color: trail.color,
              trail_is_billable: trail.is_billable,
              trail_id: trail.id,
            }
          })
        setRecentEntries(mapped)

        // Check for recent completed entries with no notes (in the last 5 minutes)
        const now = new Date()
        const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000)
        const autoSuggestions = (entriesResult.data as StoppedEntryRow[])
          .filter((entry) => {
            const hasNoNotes = !entry.notes
            const isCompletedRecently = entry.end_time && new Date(entry.end_time) >= fiveMinsAgo
            return hasNoNotes && isCompletedRecently
          })
          .map((entry) => {
            const project = mappedProjects.find((p) => p.id === entry.project_id)
            return {
              id: entry.id,
              project_id: entry.project_id,
              start_time: entry.start_time,
              end_time: entry.end_time,
              duration_seconds: entry.duration_seconds ?? 0,
              projectName: project?.name || 'Unknown',
              trailId: project?.trail_id || '',
              trailName: project?.trail_name || 'Unknown',
              trailColor: project?.trail_color || '#3A7D44',
              trailIsBillable: project?.trail_is_billable ?? false,
              notes: entry.notes || '',
            }
          })

        setJustCompletedQueue((prev) => {
          const existingIds = new Set(prev.map(item => item.id))
          const newItems = autoSuggestions.filter(item => !existingIds.has(item.id))
          return [...prev, ...newItems]
        })
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
    loadBriefing()
  }, [loadData, loadBriefing])

  useEffect(() => {
    if (!loading) {
      setShowLoadingShell(false)
      return
    }

    const timer = setTimeout(() => setShowLoadingShell(true), 180)
    return () => clearTimeout(timer)
  }, [loading])

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
    
    // Seamless hot-swap: find active timer and stop it first to capture its details
    let stoppedItem: JustCompletedEntry | null = null
    const activeProjectIds = Array.from(runningTimers.keys())
    const currentProjectById = new Map(projects.map((p) => [p.id, p]))

    if (activeProjectIds.length > 0) {
      const oldProjId = activeProjectIds[0]
      const oldTimer = runningTimers.get(oldProjId)
      if (oldTimer) {
        const stopResult = await stopTimer(oldTimer.timeEntryId)
        if (stopResult.success && stopResult.timeEntry) {
          const oldProject = currentProjectById.get(oldProjId)
          if (oldProject) {
            stoppedItem = {
              id: stopResult.timeEntry.id,
              project_id: oldProjId,
              start_time: stopResult.timeEntry.start_time,
              end_time: stopResult.timeEntry.end_time ?? new Date().toISOString(),
              duration_seconds: stopResult.timeEntry.duration_seconds ?? 0,
              projectName: oldProject.name,
              trailId: oldProject.trail_id,
              trailName: oldProject.trail_name,
              trailColor: oldProject.trail_color,
              trailIsBillable: oldProject.trail_is_billable,
              notes: stopResult.timeEntry.notes || '',
              logObservation: false,
              observationText: '',
              selectedLoopId: '',
            }
          }
        }
      }
    }

    const result = await startTimer(projectId)
    if (result.success) {
      if (stoppedItem) {
        setJustCompletedQueue((prev) => {
          const filtered = prev.filter(item => item.id !== stoppedItem.id)
          return [...filtered, stoppedItem]
        })
      }
      await loadData()
    }
    setActionLoading(null)
  }

  async function handleStop(projectId: string) {
    const timer = runningTimers.get(projectId)
    if (!timer) return
    setActionLoading(projectId)
    const result = await stopTimer(timer.timeEntryId)
    const currentProjectById = new Map(projects.map((p) => [p.id, p]))

    if (result.success && result.timeEntry) {
      const project = currentProjectById.get(projectId)
      if (project) {
        const stoppedItem = {
          id: result.timeEntry.id,
          project_id: projectId,
          start_time: result.timeEntry.start_time,
          end_time: result.timeEntry.end_time ?? new Date().toISOString(),
          duration_seconds: result.timeEntry.duration_seconds ?? 0,
          projectName: project.name,
          trailId: project.trail_id,
          trailName: project.trail_name,
          trailColor: project.trail_color,
          trailIsBillable: project.trail_is_billable,
          notes: result.timeEntry.notes || '',
          logObservation: false,
          observationText: '',
          selectedLoopId: '',
        }
        setJustCompletedQueue((prev) => {
          const filtered = prev.filter(item => item.id !== stoppedItem.id)
          return [...filtered, stoppedItem]
        })
      }
      await loadData()
    }
    setActionLoading(null)
  }

  async function handlePause(projectId: string) {
    setActionLoading(projectId)
    const result = await pauseTimer(projectId)
    const currentProjectById = new Map(projects.map((p) => [p.id, p]))

    if (result.success && result.timeEntry) {
      const project = currentProjectById.get(projectId)
      if (project) {
        const stoppedItem = {
          id: result.timeEntry.id,
          project_id: projectId,
          start_time: result.timeEntry.start_time,
          end_time: result.timeEntry.end_time ?? new Date().toISOString(),
          duration_seconds: result.timeEntry.duration_seconds ?? 0,
          projectName: project.name,
          trailId: project.trail_id,
          trailName: project.trail_name,
          trailColor: project.trail_color,
          trailIsBillable: project.trail_is_billable,
          notes: result.timeEntry.notes || '',
          logObservation: false,
          observationText: '',
          selectedLoopId: '',
        }
        setJustCompletedQueue((prev) => {
          const filtered = prev.filter(item => item.id !== stoppedItem.id)
          return [...filtered, stoppedItem]
        })
      }
      await loadData()
    }
    setActionLoading(null)
  }

  async function handleResume(projectId: string) {
    setActionLoading(projectId)
    
    // Seamless hot-swap: find active timer and stop it first to capture its details
    let stoppedItem: JustCompletedEntry | null = null
    const activeProjectIds = Array.from(runningTimers.keys())
    const currentProjectById = new Map(projects.map((p) => [p.id, p]))

    if (activeProjectIds.length > 0) {
      const oldProjId = activeProjectIds[0]
      const oldTimer = runningTimers.get(oldProjId)
      if (oldTimer) {
        const stopResult = await stopTimer(oldTimer.timeEntryId)
        if (stopResult.success && stopResult.timeEntry) {
          const oldProject = currentProjectById.get(oldProjId)
          if (oldProject) {
            stoppedItem = {
              id: stopResult.timeEntry.id,
              project_id: oldProjId,
              start_time: stopResult.timeEntry.start_time,
              end_time: stopResult.timeEntry.end_time ?? new Date().toISOString(),
              duration_seconds: stopResult.timeEntry.duration_seconds ?? 0,
              projectName: oldProject.name,
              trailId: oldProject.trail_id,
              trailName: oldProject.trail_name,
              trailColor: oldProject.trail_color,
              trailIsBillable: oldProject.trail_is_billable,
              notes: stopResult.timeEntry.notes || '',
              logObservation: false,
              observationText: '',
              selectedLoopId: '',
            }
          }
        }
      }
    }

    const result = await resumeTimer(projectId)
    if (result.success) {
      if (stoppedItem) {
        setJustCompletedQueue((prev) => {
          const filtered = prev.filter(item => item.id !== stoppedItem.id)
          return [...filtered, stoppedItem]
        })
      }
      await loadData()
    }
    setActionLoading(null)
  }

  // Helper functions for Just Completed Queue
  function handleUpdateJustCompletedNotes(id: string, notes: string) {
    setJustCompletedQueue((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)))
  }

  function handleToggleLogObservation(id: string, logObservation: boolean) {
    setJustCompletedQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, logObservation, observationText: item.observationText || item.notes } : item
      )
    )
  }

  function handleUpdateJustCompletedObservation(id: string, observationText: string) {
    setJustCompletedQueue((prev) => prev.map((item) => (item.id === id ? { ...item, observationText } : item)))
  }

  function handleSelectJustCompletedLoop(id: string, selectedLoopId: string) {
    setJustCompletedQueue((prev) => prev.map((item) => (item.id === id ? { ...item, selectedLoopId } : item)))
  }

  function handleDismissJustCompleted(id: string) {
    setJustCompletedQueue((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleSaveJustCompleted(item: JustCompletedEntry) {
    const supabase = getSupabase()

    // 1. Update time entry notes
    await updateTimeEntry(item.id, { notes: item.notes || null })

    let observationId: string | null = null
    // 2. Create Observation if checked
    if (item.logObservation && item.observationText?.trim()) {
      const { data: obsData, error: obsError } = await supabase
        .from('observations')
        .insert({
          source: 'manual',
          content: item.observationText.trim(),
          related_trail_id: item.trailId || null,
          related_project_id: item.project_id || null,
          metadata: {},
        })
        .select()
        .single()

      if (!obsError && obsData) {
        observationId = obsData.id
        // Link the time entry to the observation
        await updateTimeEntry(item.id, { source_observation_id: observationId })
      } else if (obsError) {
        console.error('Error logging observation:', obsError)
      }
    }

    // 3. Resolve Open Loop if selected
    if (item.selectedLoopId) {
      const { error: loopError } = await supabase
        .from('open_loops')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', item.selectedLoopId)
      if (loopError) {
        console.error('Error completing open loop:', loopError)
      }
    }

    // Remove from queue
    setJustCompletedQueue((prev) => prev.filter((q) => q.id !== item.id))

    // Reload all data
    await loadData()
    await loadBriefing()
  }

  if (loading && briefingLoading && !showLoadingShell && !briefing) {
    return <div className="min-h-[42vh]" aria-busy="true" />
  }

  if (loading && briefingLoading && !briefing) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="glass-card p-4 skeleton-card sm:p-6">
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

  const projectById = new Map(projects.map((project) => [project.id, project]))
  const completedSeconds = recentEntries.reduce((sum, entry) => sum + entry.duration_seconds, 0)
  const completedBillableEarnings = recentEntries
    .filter((entry) => entry.trail_is_billable)
    .reduce((sum, entry) => {
      const rate = getEffectiveRateFromCache(entry.trail_id, entry.project_id, allRates)
      return sum + (rate ? calculateRunningCost(entry.duration_seconds, rate) : 0)
    }, 0)

  let runningSeconds = 0
  let runningBillableEarnings = 0
  runningTimers.forEach((timer, projectId) => {
    runningSeconds += timer.elapsedSeconds
    const project = projectById.get(projectId)
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

  const activeProjects = Array.from(runningTimers.keys())
    .map((projectId) => projectById.get(projectId))
    .filter((project): project is ProjectWithTrail => Boolean(project))
    .sort((a, b) => {
      const aTimer = runningTimers.get(a.id)
      const bTimer = runningTimers.get(b.id)
      return (aTimer?.startTime ?? '').localeCompare(bTimer?.startTime ?? '')
    })

  const pausedProjectList = projects
    .filter((project) => pausedProjects.has(project.id) && !runningTimers.has(project.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const recentProjectRank = new Map<string, number>()
  recentEntries.forEach((entry, index) => {
    if (!recentProjectRank.has(entry.project_id)) recentProjectRank.set(entry.project_id, index)
  })

  const quickStartProjects = projects
    .filter((project) => !runningTimers.has(project.id) && !pausedProjects.has(project.id))
    .sort((a, b) => {
      const aRecent = recentProjectRank.get(a.id) ?? Number.POSITIVE_INFINITY
      const bRecent = recentProjectRank.get(b.id) ?? Number.POSITIVE_INFINITY
      if (aRecent !== bRecent) return aRecent - bRecent
      if (a.trail_is_billable !== b.trail_is_billable) return a.trail_is_billable ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .slice(0, 6)

  const primaryProject = activeProjects[0] ?? null
  const secondaryProjects = activeProjects.slice(1)

  function renderStats() {
    return (
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-surface/35 text-center text-sm text-text-muted dark:bg-white/5">
        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider">Today</p>
          <p className="mt-1 font-semibold text-text dark:text-white">{hours}h {mins}m</p>
        </div>
        <div className="border-x border-border px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider">Billable</p>
          <p className="mt-1 font-semibold text-accent">{formatCurrency(totalEarnings)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider">Entries</p>
          <p className="mt-1 font-semibold text-text dark:text-white">{recentEntries.length}</p>
        </div>
      </div>
    )
  }

  function renderFocusHero() {
    if (!primaryProject) {
      // Idle state: Welcome + Today's stats
      return (
        <div className="glass-card p-6 shadow-card lg:p-8 flex flex-col justify-between min-h-[22rem]">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text dark:text-white">Ready to start</h2>
                <p className="text-sm text-text-muted">Pick a project from suggestions or search to begin tracking focus.</p>
              </div>
            </div>
            <div className="mt-8 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Current Session</p>
              <div className="flex items-center gap-4">
                <p className="font-mono text-5xl font-bold tracking-tight text-text/65 dark:text-white/25">00:00:00</p>
                <span className="text-xs bg-surface-foreground/5 dark:bg-white/5 text-text-muted px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">Idle</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Today&apos;s Summary</p>
            {renderStats()}
          </div>
        </div>
      )
    }

    const timer = runningTimers.get(primaryProject.id)
    const isRunning = !!timer
    const isPaused = pausedProjects.has(primaryProject.id)
    const isDisabled = actionLoading === primaryProject.id
    const effectiveRate = primaryProject.trail_is_billable
      ? getEffectiveRateFromCache(primaryProject.trail_id, primaryProject.id, allRates)
      : null
    const currentCost =
      isRunning && timer && effectiveRate !== null
        ? calculateRunningCost(timer.elapsedSeconds, effectiveRate)
        : null

    return (
      <div className={`glass-card p-6 shadow-card lg:p-8 relative overflow-hidden transition-all duration-300 ${isRunning ? 'bg-accent/5 ring-1 ring-accent' : ''}`}>
        <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="min-w-0 flex-1 text-center md:text-left">
            <div className="mb-3 flex items-center justify-center md:justify-start gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: primaryProject.trail_color }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">{primaryProject.trail_name}</span>
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  Active
                </span>
              )}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-text dark:text-white truncate">{primaryProject.name}</h2>
            <p className="mt-2 text-sm text-text-muted">
              {isRunning ? 'Currently tracking your attention here.' : 'Recently paused focus. Resume to continue.'}
            </p>
            
            <div className="mt-6 flex flex-col items-center md:items-start gap-2">
              {currentCost !== null && (
                <p className="text-lg font-bold text-accent">{formatCurrency(currentCost)} earned this session</p>
              )}
              {effectiveRate !== null && (
                <p className="text-xs text-text-muted font-medium">{formatCurrency(effectiveRate)}/hr billable rate</p>
              )}
            </div>

            <div className="mt-8 flex justify-center md:justify-start gap-3">
              {isRunning ? (
                <>
                  <button
                    onClick={() => handlePause(primaryProject.id)}
                    disabled={isDisabled}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/60 text-white transition hover:bg-slate-700 disabled:opacity-50 shadow-md cursor-pointer"
                    title="Pause Session"
                  >
                    <Pause className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleStop(primaryProject.id)}
                    disabled={isDisabled}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/20 text-red-200 transition hover:bg-red-500/40 disabled:opacity-50 shadow-md cursor-pointer"
                    title="Stop & Log Session"
                  >
                    <Square className="h-5 w-5 fill-current" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleResume(primaryProject.id)}
                  disabled={isDisabled}
                  className="flex h-12 min-w-36 items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-black shadow-lg shadow-accent/25 transition hover:bg-accent-light disabled:opacity-50 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Resume Focus
                </button>
              )}
            </div>
          </div>

          {/* Animated Circular Progress Ring */}
          <div className="relative flex items-center justify-center w-48 h-48 sm:w-52 sm:h-52 shrink-0">
            {isRunning && timer ? (
              <>
                <svg className="w-full h-full transform -rotate-90 animate-pulse-slow" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="43"
                    className="stroke-border fill-none opacity-40"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="43"
                    style={{
                      stroke: primaryProject.trail_color,
                      strokeDasharray: '270.2',
                      strokeDashoffset: 270.2 - (270.2 * (timer.elapsedSeconds % 3600)) / 3600,
                      filter: `drop-shadow(0 0 4px ${primaryProject.trail_color}80)`
                    }}
                    className="fill-none transition-all duration-1000 ease-in-out"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <p className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-text dark:text-white">
                    {formatDuration(timer.elapsedSeconds)}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-text-muted mt-1 font-bold">Elapsed</span>
                </div>
              </>
            ) : (
              <>
                <svg className="w-full h-full transform -rotate-90 opacity-20" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="43" className="stroke-border fill-none" strokeWidth="3.5" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center opacity-60">
                  <p className="font-mono text-3xl font-extrabold tracking-tight text-text/70 dark:text-white/45">
                    00:00:00
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-text-muted mt-1 font-bold">Paused</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderJustCompletedQueue() {
    if (justCompletedQueue.length === 0) return null

    return (
      <div className="space-y-4">
        <h3 className="text-base font-bold text-text dark:text-white border-l-4 border-accent pl-2">
          Finalize Work Logs ({justCompletedQueue.length})
        </h3>
        <div className="space-y-4">
          {justCompletedQueue.map((item) => {
            const projectLoops = rawOpenLoops.filter(l => l.project_id === item.project_id)
            return (
              <div
                key={item.id}
                className="glass-card p-5 border-2 shadow-card relative overflow-hidden transition-all duration-300"
                style={{ borderColor: item.trailColor }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.trailColor }} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Just Completed: {item.trailName}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDismissJustCompleted(item.id)}
                    className="text-text-muted hover:text-text dark:hover:text-white transition-colors cursor-pointer"
                    title="Dismiss without saving"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <h4 className="text-lg font-bold text-text dark:text-white leading-tight mb-1">
                  {item.projectName}
                </h4>
                <p className="text-xs text-text-muted mb-4 font-mono">
                  Tracked {formatDuration(item.duration_seconds)} ({new Date(item.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(item.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})
                </p>

                <div className="space-y-4">
                  {/* Invoice Description Input */}
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                      Invoice Description (Notes)
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-border bg-surface/35 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50"
                      placeholder="What was accomplished? (e.g., Debugged RLS triggers)"
                      value={item.notes}
                      onChange={(e) => handleUpdateJustCompletedNotes(item.id, e.target.value)}
                    />
                  </div>

                  {/* Observation Toggle */}
                  <div className="border-t border-border/40 pt-3">
                    <label className="flex items-center gap-2.5 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent h-4 w-4"
                        checked={!!item.logObservation}
                        onChange={(e) => handleToggleLogObservation(item.id, e.target.checked)}
                      />
                      <span>Cross-log as formal Observation</span>
                    </label>
                    {item.logObservation && (
                      <div className="mt-2.5">
                        <textarea
                          className="w-full rounded-xl border border-border bg-surface/35 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50"
                          rows={2}
                          placeholder="Log realizations, blockers, or learnings..."
                          value={item.observationText}
                          onChange={(e) => handleUpdateJustCompletedObservation(item.id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Resolve Open Loop */}
                  {projectLoops.length > 0 && (
                    <div className="border-t border-border/40 pt-3">
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        Resolve Open Loop
                      </label>
                      <select
                        className="w-full rounded-xl border border-border bg-surface/35 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:bg-slate-900"
                        value={item.selectedLoopId || ''}
                        onChange={(e) => handleSelectJustCompletedLoop(item.id, e.target.value)}
                      >
                        <option value="">-- No open loops selected --</option>
                        {projectLoops.map(loop => (
                          <option key={loop.id} value={loop.id}>
                            {loop.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex justify-end gap-2.5 border-t border-border/40 pt-4">
                  <button
                    onClick={() => handleDismissJustCompleted(item.id)}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-muted hover:text-text dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleSaveJustCompleted(item)}
                    className="rounded-full bg-accent px-5 py-2 text-xs font-extrabold text-black hover:bg-accent-light shadow-md shadow-accent/25 transition-colors cursor-pointer"
                  >
                    Save & Log
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderCompactStart(project: ProjectWithTrail) {
    const isDisabled = actionLoading === project.id
    const effectiveRate = project.trail_is_billable
      ? getEffectiveRateFromCache(project.trail_id, project.id, allRates)
      : null

    return (
      <button
        key={project.id}
        onClick={() => handleStart(project.id)}
        disabled={isDisabled}
        className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-border bg-surface/35 p-4 text-left transition hover:border-accent hover:bg-accent/10 disabled:opacity-50 dark:bg-white/5 cursor-pointer"
      >
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.trail_color }} />
            <span className="truncate text-xs font-medium uppercase tracking-wider text-text-muted">{project.trail_name}</span>
          </div>
          <div className="truncate text-sm font-bold text-text dark:text-white">{project.name}</div>
          {effectiveRate !== null && <div className="mt-1 text-xs text-text-muted">{formatCurrency(effectiveRate)}/hr</div>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-foreground/5 text-text transition-colors dark:bg-white/10 dark:text-white">
          <PlayIcon className="h-4 w-4" />
        </span>
      </button>
    )
  }

  function renderSearchAndSuggestions() {
    // Searchable Combobox logic
    const filteredProjects = searchQuery.trim() === ''
      ? []
      : projects.filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.trail_name.toLowerCase().includes(searchQuery.toLowerCase())
        )

    const suggestedList = projects
      .filter((project) => !runningTimers.has(project.id))
      .sort((a, b) => {
        // 1. Is paused?
        const aPaused = pausedProjects.has(a.id)
        const bPaused = pausedProjects.has(b.id)
        if (aPaused && !bPaused) return -1
        if (!aPaused && bPaused) return 1

        // 2. Recency in today's entries
        const aRecent = recentProjectRank.get(a.id) ?? Number.POSITIVE_INFINITY
        const bRecent = recentProjectRank.get(b.id) ?? Number.POSITIVE_INFINITY
        if (aRecent !== bRecent) return aRecent - bRecent

        // 3. Billable first
        if (a.trail_is_billable !== b.trail_is_billable) return a.trail_is_billable ? -1 : 1

        // 4. Alphabetical
        return a.name.localeCompare(b.name)
      })
      .slice(0, 6)

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (filteredProjects.length === 0) return
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(prev => (prev + 1) % filteredProjects.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(prev => (prev - 1 + filteredProjects.length) % filteredProjects.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < filteredProjects.length) {
          handleStart(filteredProjects[focusedIndex].id)
          setSearchQuery('')
          setIsDropdownOpen(false)
        }
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }

    return (
      <div className="glass-card p-5 shadow-card relative">
        <h3 className="text-base font-bold text-text dark:text-white mb-1">Start Focus Session</h3>
        <p className="text-xs text-text-muted mb-4">Search any project across trails or pick suggestions below.</p>
        
        {/* Search Input Box */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-text-muted" />
          </div>
          <input
            type="text"
            className="w-full rounded-2xl border border-border bg-surface/35 pl-9 pr-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/60 dark:bg-slate-900/10"
            placeholder="Type project or trail name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsDropdownOpen(true)
              setFocusedIndex(-1)
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setIsDropdownOpen(false)
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search Dropdown Results */}
          {isDropdownOpen && filteredProjects.length > 0 && (
            <>
              {/* Overlay background to detect click outside */}
              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-border bg-surface/95 backdrop-blur-md p-1 shadow-lg dark:bg-slate-900/95">
                {filteredProjects.map((project, idx) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      handleStart(project.id)
                      setSearchQuery('')
                      setIsDropdownOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                      idx === focusedIndex
                        ? 'bg-accent/10 text-accent font-semibold'
                        : 'text-text hover:bg-surface-foreground/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.trail_color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          {project.trail_name}
                        </span>
                      </div>
                      <p className="font-medium truncate">{project.name}</p>
                    </div>
                    <Play className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </div>
            </>
          )}

          {isDropdownOpen && searchQuery.trim() !== '' && filteredProjects.length === 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
              <div className="absolute left-0 right-0 z-50 mt-1 rounded-2xl border border-border bg-surface/95 backdrop-blur-md p-4 text-center text-sm text-text-muted dark:bg-slate-900/95">
                No matching projects found.
              </div>
            </>
          )}
        </div>

        {/* Suggestions Row */}
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">Suggested Projects</p>
          {suggestedList.length > 0 ? (
            <div className="grid gap-3 grid-cols-2">
              {suggestedList.map(renderCompactStart)}
            </div>
          ) : (
            <p className="text-center py-4 rounded-2xl border border-dashed border-border text-xs text-text-muted bg-surface/20">
              No suggested projects available.
            </p>
          )}
        </div>
      </div>
    )
  }

  function renderOpenLoopsWidget() {
    const activeLoops = rawOpenLoops.filter(l => l.status === 'open')

    async function handleCheckLoop(loopId: string) {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('open_loops')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', loopId)

      if (!error) {
        // Refresh briefing data
        await loadBriefing()
      }
    }

    return (
      <div className="glass-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-accent" />
            <h3 className="text-base font-bold text-text dark:text-white">Active Open Loops</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface-foreground/5 dark:bg-white/5 px-2 py-0.5 rounded">
            {activeLoops.length} loops
          </span>
        </div>

        {activeLoops.length > 0 ? (
          <div className="space-y-2 mt-4 max-h-64 overflow-y-auto pr-1">
            {activeLoops.map(loop => (
              <div
                key={loop.id}
                className="flex items-start gap-3 p-3 rounded-2xl border border-border bg-surface/35 hover:bg-surface/50 dark:bg-white/5 transition-colors group"
              >
                <button
                  onClick={() => handleCheckLoop(loop.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border flex items-center justify-center text-accent hover:border-accent transition-colors cursor-pointer"
                >
                  <Check className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text dark:text-white leading-snug break-words">
                    {loop.title}
                  </p>
                  {loop.project && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: loop.project.trail?.color || '#3A7D44' }} />
                      <span className="text-[10px] font-bold text-text-muted truncate">
                        {loop.project.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-text-muted">
            All clear! No open loops active.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="content-enter space-y-6 sm:space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text dark:text-white">Now</h1>
            <p className="mt-1 text-sm text-text-muted">Start, resume, and close the work in front of you.</p>
          </div>
        </div>
        <Link href="/time-log" className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-text-muted transition hover:border-accent hover:text-text dark:hover:text-white">
          Review time log
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="glass-card p-4 skeleton-card sm:p-6">
              <div className="mb-4 space-y-3">
                <div className="skeleton h-3 w-20 rounded" />
                <div className="skeleton h-6 w-32 rounded" />
              </div>
              <div className="skeleton mb-4 h-4 w-16 rounded" />
              <div className="skeleton h-12 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card border-red-500/30 bg-red-900/10 p-6">
          <p className="text-red-400">Failed to load timers: {error}</p>
          <button onClick={loadData} className="mt-3 rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10">
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title="No active projects">
          Add a trail and project from the{' '}
          <Link href="/trails" className="font-medium text-accent hover:text-accent-light">
            Trails
          </Link>{' '}
          page to get started.
        </EmptyState>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <div className="space-y-6">
            {renderFocusHero()}
            {renderJustCompletedQueue()}
          </div>

          <div className="space-y-6">
            {renderSearchAndSuggestions()}
            {renderOpenLoopsWidget()}
          </div>
        </section>
      )}

      <section className="glass-card p-5 shadow-card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text dark:text-white">Orientation</h2>
            <p className="mt-1 text-sm text-text-muted">A compact read on the day. Full briefing has the longer scan.</p>
          </div>
          <Link href="/briefing" className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-text-muted transition hover:border-accent hover:text-text dark:hover:text-white">
            Open briefing
          </Link>
        </div>

        {briefingError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            Orientation could not load: {briefingError}
          </div>
        )}

        {briefingLoading && !briefing ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-surface-foreground/5 dark:bg-white/5" />)}
          </div>
        ) : briefing && (
          <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]">
            <div className="rounded-2xl border border-border bg-surface/35 p-4 dark:bg-white/5">
              <div className="text-2xl font-bold text-text dark:text-white">{briefing.openLoopCount}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">open loops</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/35 p-4 dark:bg-white/5">
              <div className="text-2xl font-bold text-text dark:text-white">{briefing.observationCount}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">recent observations</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/35 p-4 dark:bg-white/5">
              <div className="text-2xl font-bold text-text dark:text-white">{runningCount}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">active timers</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/35 p-4 dark:bg-white/5">
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Latest reflection</div>
              {briefing.latestReflection ? (
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-text dark:text-white">{briefing.latestReflection.content}</p>
              ) : (
                <p className="mt-2 text-sm text-text-muted">No journal entries yet.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {recentEntries.length > 0 && (
        <div className="mt-4">
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
                const timeRange = `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`

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
                        <p className="text-sm text-text-muted">-</p>
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

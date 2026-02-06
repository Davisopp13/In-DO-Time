'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getAllRunningTimersWithProjects,
  calculateElapsedSeconds,
  type RunningTimerWithProject,
} from '@/lib/timer'

export interface RunningTimerDisplay extends RunningTimerWithProject {
  elapsedSeconds: number
}

export function useRunningTimers() {
  const [timers, setTimers] = useState<RunningTimerDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadRunningTimers = useCallback(async () => {
    try {
      const running = await getAllRunningTimersWithProjects()
      const withElapsed = running.map((timer) => ({
        ...timer,
        elapsedSeconds: calculateElapsedSeconds(timer.timeEntry.start_time),
      }))
      setTimers(withElapsed)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load running timers')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load running timers on mount
  useEffect(() => {
    loadRunningTimers()
  }, [loadRunningTimers])

  // Tick elapsed seconds every second for all running timers
  useEffect(() => {
    if (timers.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimers((prev) =>
        prev.map((timer) => ({
          ...timer,
          elapsedSeconds: calculateElapsedSeconds(timer.timeEntry.start_time),
        }))
      )
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timers.length])

  return {
    timers,
    loading,
    error,
    refresh: loadRunningTimers,
    hasRunningTimers: timers.length > 0,
    count: timers.length,
  }
}

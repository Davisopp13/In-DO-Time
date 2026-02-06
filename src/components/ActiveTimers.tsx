'use client'

import { useRunningTimers } from '@/hooks/useRunningTimers'
import {
  formatDuration,
  calculateRunningCost,
  formatCurrency,
  stopTimer,
  pauseTimer,
} from '@/lib/timer'

export default function ActiveTimers() {
  const { timers, loading, error, refresh, hasRunningTimers } = useRunningTimers()

  async function handleStop(timeEntryId: string) {
    const result = await stopTimer(timeEntryId)
    if (result.success) {
      refresh()
    }
  }

  async function handlePause(projectId: string) {
    const result = await pauseTimer(projectId)
    if (result.success) {
      refresh()
    }
  }

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-background p-6 shadow-card">
        <div className="animate-pulse text-text-muted">Checking for running timers...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 p-6">
        <p className="text-red-600">Failed to load timers: {error}</p>
        <button
          onClick={refresh}
          className="mt-2 text-sm font-medium text-primary hover:text-primary-dark"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!hasRunningTimers) {
    return null
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-text">
        Running Timers ({timers.length})
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {timers.map((timer) => {
          const cost = calculateRunningCost(timer.elapsedSeconds, timer.effectiveRate)
          return (
            <div
              key={timer.timeEntry.id}
              className="relative overflow-hidden rounded-card border-2 bg-background p-5 shadow-card"
              style={{ borderColor: timer.client.color }}
            >
              {/* Pulsing green indicator */}
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
                <span className="text-xs font-medium text-primary">Running</span>
              </div>

              {/* Client + Project */}
              <div className="mb-3">
                <p className="text-sm font-medium text-text-muted">{timer.client.name}</p>
                <p className="text-lg font-semibold text-text">{timer.project.name}</p>
              </div>

              {/* Elapsed Time */}
              <p className="mb-1 font-mono text-2xl font-bold text-accent">
                {formatDuration(timer.elapsedSeconds)}
              </p>

              {/* Running Cost */}
              <p className="mb-4 text-sm text-text-muted">
                {formatCurrency(cost)} @ {formatCurrency(timer.effectiveRate)}/hr
              </p>

              {/* Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => handlePause(timer.timeEntry.project_id)}
                  className="flex-1 rounded-button bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
                >
                  Pause
                </button>
                <button
                  onClick={() => handleStop(timer.timeEntry.id)}
                  className="flex-1 rounded-button bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                >
                  Stop
                </button>
              </div>

              {/* Notes */}
              {timer.timeEntry.notes && (
                <p className="mt-3 truncate text-xs text-text-muted">
                  {timer.timeEntry.notes}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

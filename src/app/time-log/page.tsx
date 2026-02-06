'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { formatDuration, calculateRunningCost, formatCurrency } from '@/lib/timer'

interface TimeLogEntry {
  id: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  notes: string | null
  is_running: boolean
  is_manual: boolean
  project_name: string
  client_name: string
  client_color: string
  effectiveRate: number
}

export default function TimeLogPage() {
  const [entries, setEntries] = useState<TimeLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    try {
      const supabase = getSupabase()

      const { data, error: fetchError } = await supabase
        .from('time_entries')
        .select(`
          id, start_time, end_time, duration_seconds, notes, is_running, is_manual,
          projects!inner(
            name,
            hourly_rate_override,
            clients!inner(name, hourly_rate, color)
          )
        `)
        .order('start_time', { ascending: false })

      if (fetchError) throw fetchError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: TimeLogEntry[] = (data || []).map((e: any) => ({
        id: e.id,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_seconds: e.duration_seconds,
        notes: e.notes,
        is_running: e.is_running,
        is_manual: e.is_manual,
        project_name: e.projects.name,
        client_name: e.projects.clients.name,
        client_color: e.projects.clients.color,
        effectiveRate: e.projects.hourly_rate_override ?? e.projects.clients.hourly_rate,
      }))

      setEntries(mapped)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Group entries by date
  const groupedEntries = entries.reduce<Record<string, TimeLogEntry[]>>((groups, entry) => {
    const date = new Date(entry.start_time).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(entry)
    return groups
  }, {})

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-background p-6 shadow-card">
        <div className="animate-pulse text-text-muted">Loading time entries...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 p-6">
        <p className="text-red-600">Failed to load time entries: {error}</p>
        <button
          onClick={loadEntries}
          className="mt-2 text-sm font-medium text-primary hover:text-primary-dark"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Time Log</h1>
          <p className="text-sm text-text-muted">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} total
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-border bg-background py-16 shadow-card">
          <p className="mb-2 text-lg font-semibold text-text">No time entries yet</p>
          <p className="text-text-muted">
            Start a timer from the{' '}
            <a href="/" className="font-medium text-primary hover:text-primary-dark">
              Dashboard
            </a>{' '}
            to begin tracking time.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEntries).map(([date, dayEntries]) => {
            const dayTotal = dayEntries.reduce(
              (sum, e) => sum + (e.duration_seconds ?? 0),
              0
            )
            const dayEarnings = dayEntries.reduce(
              (sum, e) =>
                sum + calculateRunningCost(e.duration_seconds ?? 0, e.effectiveRate),
              0
            )

            return (
              <div key={date}>
                {/* Date header */}
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                    {date}
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-text-muted">
                    <span className="font-mono">{formatDuration(dayTotal)}</span>
                    <span>{formatCurrency(dayEarnings)}</span>
                  </div>
                </div>

                {/* Entries for this date */}
                <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-background shadow-card">
                  {dayEntries.map((entry) => {
                    const duration = entry.duration_seconds ?? 0
                    const cost = calculateRunningCost(duration, entry.effectiveRate)
                    const startDate = new Date(entry.start_time)
                    const endDate = entry.end_time ? new Date(entry.end_time) : null
                    const startTimeStr = startDate.toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                    const endTimeStr = endDate
                      ? endDate.toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'Running'

                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        {/* Client color indicator */}
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: entry.client_color }}
                        />

                        {/* Main info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-text">
                              {entry.project_name}
                            </p>
                            {entry.is_running && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                                </span>
                                Running
                              </span>
                            )}
                            {entry.is_manual && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-muted">
                                Manual
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted">
                            {entry.client_name} · {startTimeStr} – {endTimeStr}
                            {entry.notes && (
                              <span className="ml-1">· {entry.notes}</span>
                            )}
                          </p>
                        </div>

                        {/* Duration + Cost */}
                        <div className="flex-shrink-0 text-right">
                          <p className="font-mono text-sm font-medium text-text">
                            {entry.is_running ? '—' : formatDuration(duration)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {entry.is_running ? '—' : formatCurrency(cost)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

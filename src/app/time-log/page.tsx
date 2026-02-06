'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { formatDuration, calculateRunningCost, formatCurrency, updateTimeEntry, deleteTimeEntry, createManualEntry } from '@/lib/timer'
import EmptyState from '@/components/EmptyState'

interface TimeLogEntry {
  id: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  notes: string | null
  is_running: boolean
  is_manual: boolean
  project_name: string
  project_id: string
  client_name: string
  client_id: string
  client_color: string
  effectiveRate: number
}

interface FilterOption {
  id: string
  name: string
}

export default function TimeLogPage() {
  const [entries, setEntries] = useState<TimeLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [clients, setClients] = useState<FilterOption[]>([])
  const [projects, setProjects] = useState<FilterOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Edit state
  const [editingEntry, setEditingEntry] = useState<TimeLogEntry | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete state
  const [deletingEntry, setDeletingEntry] = useState<TimeLogEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Manual entry state
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualProject, setManualProject] = useState('')
  const [manualStartTime, setManualStartTime] = useState('')
  const [manualEndTime, setManualEndTime] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  // Load clients and projects for filter dropdowns
  useEffect(() => {
    async function loadFilterOptions() {
      const supabase = getSupabase()
      const [clientsRes, projectsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('projects').select('id, name, client_id').order('name'),
      ])
      if (clientsRes.data) setClients(clientsRes.data)
      if (projectsRes.data) setProjects(projectsRes.data)
    }
    loadFilterOptions()
  }, [])

  // Filtered projects based on selected client
  const filteredProjects = selectedClient
    ? projects.filter((p) => (p as FilterOption & { client_id: string }).client_id === selectedClient)
    : projects

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()

      let query = supabase
        .from('time_entries')
        .select(`
          id, start_time, end_time, duration_seconds, notes, is_running, is_manual,
          project_id,
          projects!inner(
            id,
            name,
            hourly_rate_override,
            client_id,
            clients!inner(id, name, hourly_rate, color)
          )
        `)
        .order('start_time', { ascending: false })

      // Apply date filters
      if (startDate) {
        query = query.gte('start_time', new Date(startDate).toISOString())
      }
      if (endDate) {
        // End of the selected end date
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('start_time', end.toISOString())
      }

      // Apply project filter via project_id
      if (selectedProject) {
        query = query.eq('project_id', selectedProject)
      }

      // Apply client filter via the projects relation
      if (selectedClient && !selectedProject) {
        query = query.eq('projects.client_id', selectedClient)
      }

      const { data, error: fetchError } = await query

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
        project_id: e.project_id,
        project_name: e.projects.name,
        client_id: e.projects.client_id,
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
  }, [selectedClient, selectedProject, startDate, endDate])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const clearFilters = () => {
    setSelectedClient('')
    setSelectedProject('')
    setStartDate('')
    setEndDate('')
  }

  // Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:MM)
  const toDatetimeLocal = (isoString: string) => {
    const d = new Date(isoString)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const openEditModal = (entry: TimeLogEntry) => {
    setEditingEntry(entry)
    setEditStartTime(toDatetimeLocal(entry.start_time))
    setEditEndTime(entry.end_time ? toDatetimeLocal(entry.end_time) : '')
    setEditNotes(entry.notes || '')
    setEditError(null)
  }

  const closeEditModal = () => {
    setEditingEntry(null)
    setEditError(null)
  }

  const handleEditSave = async () => {
    if (!editingEntry) return

    const startDt = new Date(editStartTime)
    const endDt = editEndTime ? new Date(editEndTime) : null

    if (endDt && endDt <= startDt) {
      setEditError('End time must be after start time')
      return
    }

    setEditSaving(true)
    setEditError(null)

    const result = await updateTimeEntry(editingEntry.id, {
      start_time: startDt.toISOString(),
      end_time: endDt ? endDt.toISOString() : undefined,
      notes: editNotes || null,
    })

    setEditSaving(false)

    if (!result.success) {
      setEditError(result.error || 'Failed to save')
      return
    }

    closeEditModal()
    loadEntries()
  }

  const handleDelete = async () => {
    if (!deletingEntry) return
    setDeleteLoading(true)
    const result = await deleteTimeEntry(deletingEntry.id)
    setDeleteLoading(false)
    if (result.success) {
      setDeletingEntry(null)
      loadEntries()
    }
  }

  const openManualModal = () => {
    setShowManualModal(true)
    setManualProject('')
    setManualStartTime('')
    setManualEndTime('')
    setManualNotes('')
    setManualError(null)
  }

  const handleManualSave = async () => {
    if (!manualProject) {
      setManualError('Please select a project')
      return
    }
    if (!manualStartTime || !manualEndTime) {
      setManualError('Please set both start and end times')
      return
    }

    const startDt = new Date(manualStartTime)
    const endDt = new Date(manualEndTime)
    if (endDt <= startDt) {
      setManualError('End time must be after start time')
      return
    }

    setManualSaving(true)
    setManualError(null)

    const result = await createManualEntry(
      manualProject,
      startDt.toISOString(),
      endDt.toISOString(),
      manualNotes || undefined
    )

    setManualSaving(false)

    if (!result.success) {
      setManualError(result.error || 'Failed to create entry')
      return
    }

    setShowManualModal(false)
    loadEntries()
  }

  const hasFilters = selectedClient || selectedProject || startDate || endDate

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Time Log</h1>
          <p className="text-sm text-text-muted">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            {hasFilters ? ' (filtered)' : ' total'}
          </p>
        </div>
        <button
          onClick={openManualModal}
          className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark self-start sm:self-auto"
        >
          + Manual Entry
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-card border border-border bg-background p-4 shadow-card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {/* Client filter */}
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value)
                setSelectedProject('')
              }}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Project filter */}
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Projects</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* End date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <div className="col-span-2 flex items-end sm:col-span-4 lg:col-span-1">
              <button
                onClick={clearFilters}
                className="rounded-button px-3 py-2 text-sm font-medium text-text-muted hover:text-text"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState title={hasFilters ? 'No matching entries' : 'No time entries yet'}>
          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="font-medium text-primary hover:text-primary-dark"
            >
              Clear filters
            </button>
          ) : (
            <>
              Start a timer from the{' '}
              <Link href="/" className="font-medium text-primary hover:text-primary-dark">
                Dashboard
              </Link>{' '}
              to begin tracking time.
            </>
          )}
        </EmptyState>
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
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
                      <div key={entry.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {/* Client color indicator */}
                          <span
                            className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: entry.client_color }}
                          />

                          {/* Main info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
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
                                <span className="hidden sm:inline ml-1">· {entry.notes}</span>
                              )}
                            </p>
                            {entry.notes && (
                              <p className="sm:hidden text-xs text-text-muted truncate mt-0.5">{entry.notes}</p>
                            )}
                          </div>

                          {/* Edit + Delete buttons + Duration/Cost */}
                          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
                            {!entry.is_running && (
                              <div className="hidden sm:flex gap-1">
                                <button
                                  onClick={() => openEditModal(entry)}
                                  className="rounded-button p-1.5 text-text-muted hover:bg-primary-light hover:text-primary"
                                  title="Edit entry"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setDeletingEntry(entry)}
                                  className="rounded-button p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600"
                                  title="Delete entry"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            )}

                            {/* Duration + Cost */}
                            <div className="text-right">
                              <p className="font-mono text-sm font-medium text-text">
                                {entry.is_running ? '—' : formatDuration(duration)}
                              </p>
                              <p className="text-xs text-text-muted">
                                {entry.is_running ? '—' : formatCurrency(cost)}
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Mobile action buttons */}
                        {!entry.is_running && (
                          <div className="sm:hidden mt-2 ml-6 flex gap-2">
                            <button
                              onClick={() => openEditModal(entry)}
                              className="rounded-button px-3 py-1 text-xs font-medium text-primary hover:bg-primary-light"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingEntry(entry)}
                              className="rounded-button px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-card border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold text-text">Delete Entry?</h2>
            <p className="mb-1 text-sm text-text-muted">
              This will permanently delete the time entry for:
            </p>
            <p className="mb-4 text-sm font-medium text-text">
              {deletingEntry.project_name} — {deletingEntry.client_name}
              <br />
              <span className="font-normal text-text-muted">
                {new Date(deletingEntry.start_time).toLocaleDateString()} · {formatDuration(deletingEntry.duration_seconds ?? 0)} · {formatCurrency(calculateRunningCost(deletingEntry.duration_seconds ?? 0, deletingEntry.effectiveRate))}
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingEntry(null)}
                className="rounded-button px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-button bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-card border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-text">Add Manual Time Entry</h2>

            {manualError && (
              <div className="mb-4 rounded-button bg-red-50 p-3 text-sm text-red-600">
                {manualError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Project</label>
                <select
                  value={manualProject}
                  onChange={(e) => setManualProject(e.target.value)}
                  className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text">Start Time</label>
                <input
                  type="datetime-local"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text">End Time</label>
                <input
                  type="datetime-local"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text">Notes</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowManualModal(false)}
                className="rounded-button px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSave}
                disabled={manualSaving}
                className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {manualSaving ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-card border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-text">Edit Time Entry</h2>
            <p className="mb-4 text-sm text-text-muted">
              {editingEntry.project_name} — {editingEntry.client_name}
            </p>

            {editError && (
              <div className="mb-4 rounded-button bg-red-50 p-3 text-sm text-red-600">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Start Time</label>
                <input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {editingEntry.end_time && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">End Time</label>
                  <input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-text">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="rounded-button px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

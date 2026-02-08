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
            clients(id, name, hourly_rate, color)
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
      const mapped: TimeLogEntry[] = (data || []).map((e: any) => {
        const client = e.projects.clients || { name: 'Unknown', hourly_rate: 0, color: '#000000' }
        return {
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
          client_name: client.name,
          client_color: client.color,
          effectiveRate: e.projects.hourly_rate_override ?? client.hourly_rate,
        }
      })

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
    const d = new Date(entry.start_time)
    const formattedDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    if (!groups[formattedDate]) groups[formattedDate] = []
    groups[formattedDate].push(entry)
    return groups
  }, {})

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse text-text-muted">Loading time entries...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card border-red-500/30 bg-red-900/10 p-6">
        <p className="text-red-400">Failed to load time entries: {error}</p>
        <button
          onClick={loadEntries}
          className="mt-2 text-sm font-medium text-white hover:text-accent"
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
          <h1 className="text-2xl font-bold text-text dark:text-white">Time Log</h1>
          <p className="text-sm text-text-muted">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            {hasFilters ? ' (filtered)' : ' total'}
          </p>
        </div>
        <button
          onClick={openManualModal}
          className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-black hover:bg-accent-light transition-colors self-start sm:self-auto shadow-lg shadow-accent/20"
        >
          + Manual Entry
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 glass-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {/* Client filter */}
          <div className="col-span-1 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value)
                setSelectedProject('')
              }}
              className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="" className="bg-surface dark:bg-slate-900">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-surface dark:bg-slate-900">{c.name}</option>
              ))}
            </select>
          </div>

          {/* Project filter */}
          <div className="col-span-1 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="" className="bg-surface dark:bg-slate-900">All Projects</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface dark:bg-slate-900">{p.name}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-text-muted">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* End date */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-text-muted">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <div className="col-span-1 flex items-end sm:col-span-2 lg:col-span-1">
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

      {entries.length === 0 ? (
        <EmptyState title={hasFilters ? 'No matching entries' : 'No time entries yet'}>
          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="font-medium text-accent hover:text-accent-light"
            >
              Clear filters
            </button>
          ) : (
            <>
              Start a timer from the{' '}
              <Link href="/" className="font-medium text-accent hover:text-accent-light">
                Dashboard
              </Link>{' '}
              to begin tracking time.
            </>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-8">
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
                {/* Date header - Trail Marker Style */}
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-2 pl-4 border-l-4 border-slate-600">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
                    {date}
                  </h2>
                  <div className="flex items-center gap-4 text-sm font-medium text-text-muted">
                    <span className="font-mono text-text/50 dark:text-white/50">{formatDuration(dayTotal)}</span>
                    <span className="text-accent">{formatCurrency(dayEarnings)}</span>
                  </div>
                </div>

                {/* Entries for this date */}
                <div className="glass-panel overflow-hidden">
                  {dayEntries.map((entry, index) => {
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
                      <div
                        key={entry.id}
                        className={`px-4 sm:px-6 py-4 border-b border-border last:border-0 transition-colors hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${index % 2 === 0 ? 'bg-transparent' : 'bg-surface-foreground/[0.02] dark:bg-white/[0.02]' /* Zebra Striping */
                          }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          {/* Client color indicator */}
                          <span
                            className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: entry.client_color }}
                          />

                          {/* Main info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-base font-medium text-text dark:text-white">
                                {entry.project_name}
                              </p>
                              {entry.is_running && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                                  </span>
                                  Running
                                </span>
                              )}
                              {entry.is_manual && (
                                <span className="rounded-full bg-surface-foreground/10 dark:bg-white/10 px-2 py-0.5 text-[10px] uppercase font-bold text-text-muted">
                                  Manual
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-text-muted mt-0.5">
                              {entry.client_name} <span className="mx-1 text-text-muted/20 dark:text-white/20">|</span> {startTimeStr} – {endTimeStr}
                            </p>
                            {entry.notes && (
                              <p className="text-sm text-text/60 dark:text-white/60 mt-1 italic">
                                "{entry.notes}"
                              </p>
                            )}
                          </div>

                          {/* Edit + Delete buttons + Duration/Cost */}
                          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
                            {!entry.is_running && (
                              <div className="hidden sm:flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditModal(entry)}
                                  className="rounded-full p-2 text-text-muted hover:bg-surface-foreground/10 dark:hover:bg-white/10 hover:text-text dark:hover:text-white transition-colors"
                                  title="Edit entry"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setDeletingEntry(entry)}
                                  className="rounded-full p-2 text-text-muted hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                  title="Delete entry"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            )}

                            {/* Duration + Cost */}
                            <div className="text-right min-w-[70px] sm:min-w-[80px]">
                              <p className="font-mono text-sm font-medium text-text dark:text-white">
                                {entry.is_running ? '—' : formatDuration(duration)}
                              </p>
                              <p className="text-xs text-accent">
                                {entry.is_running ? '—' : formatCurrency(cost)}
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Mobile action buttons */}
                        {!entry.is_running && (
                          <div className="sm:hidden mt-3 ml-6 flex gap-3">
                            <button
                              onClick={() => openEditModal(entry)}
                              className="px-3 py-1.5 rounded-full bg-surface-foreground/5 dark:bg-white/5 border border-border text-xs font-medium text-text-muted hover:text-text dark:hover:text-white transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingEntry(entry)}
                              className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm glass-card p-6 shadow-2xl bg-surface dark:bg-[#0F172A]">
            <h2 className="mb-2 text-lg font-semibold text-text dark:text-white">Delete Entry?</h2>
            <p className="mb-1 text-sm text-text-muted">
              This will permanently delete the time entry for:
            </p>
            <p className="mb-6 text-sm font-medium text-text dark:text-white">
              {deletingEntry.project_name} — {deletingEntry.client_name}
              <br />
              <span className="font-normal text-text-muted opactiy-80">
                {new Date(deletingEntry.start_time).toLocaleDateString()}
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingEntry(null)}
                className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-card p-6 shadow-2xl bg-surface dark:bg-[#0F172A]">
            <h2 className="mb-4 text-lg font-semibold text-text dark:text-white">Add Manual Time Entry</h2>

            {manualError && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {manualError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-muted">Project</label>
                <select
                  value={manualProject}
                  onChange={(e) => setManualProject(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="" className="bg-surface dark:bg-slate-900">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-surface dark:bg-slate-900">{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-muted">Start Time</label>
                <input
                  type="datetime-local"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-muted">End Time</label>
                <input
                  type="datetime-local"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-muted">Notes</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowManualModal(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSave}
                disabled={manualSaving}
                className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-black hover:bg-accent-light disabled:opacity-50"
              >
                {manualSaving ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-card p-6 shadow-2xl bg-surface dark:bg-[#0F172A]">
            <h2 className="mb-4 text-lg font-semibold text-text dark:text-white">Edit Time Entry</h2>
            <p className="mb-4 text-sm text-text-muted">
              {editingEntry.project_name} — {editingEntry.client_name}
            </p>

            {editError && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-muted">Start Time</label>
                <input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              {editingEntry.end_time && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-muted">End Time</label>
                  <input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-text-muted">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-black hover:bg-accent-light disabled:opacity-50"
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

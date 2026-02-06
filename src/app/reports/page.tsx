'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'
import { formatDuration, calculateRunningCost, formatCurrency } from '@/lib/timer'
import { generateCSV, downloadCSV, generateCSVFilename } from '@/lib/csv'
import EmptyState from '@/components/EmptyState'

interface ReportEntry {
  id: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  is_running: boolean
  is_manual: boolean
  notes: string | null
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  client_color: string
  effectiveRate: number
}

interface ProjectSummary {
  id: string
  name: string
  totalSeconds: number
  totalCost: number
  entryCount: number
}

interface ClientSummary {
  id: string
  name: string
  color: string
  totalSeconds: number
  totalCost: number
  entryCount: number
  projects: ProjectSummary[]
}

export default function ReportsPage() {
  const [clientSummaries, setClientSummaries] = useState<ClientSummary[]>([])
  const [reportEntries, setReportEntries] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Collapse state for client sections
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Load filter options
  useEffect(() => {
    async function loadClients() {
      const supabase = getSupabase()
      const { data } = await supabase.from('clients').select('id, name').order('name')
      if (data) setClients(data)
    }
    loadClients()
  }, [])

  const loadReport = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()

      let query = supabase
        .from('time_entries')
        .select(`
          id, start_time, end_time, duration_seconds, is_running, is_manual, notes,
          project_id,
          projects!inner(
            id,
            name,
            hourly_rate_override,
            client_id,
            clients!inner(id, name, hourly_rate, color)
          )
        `)
        .eq('is_running', false)
        .order('start_time', { ascending: false })

      // Apply filters
      if (startDate) {
        query = query.gte('start_time', new Date(startDate).toISOString())
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('start_time', end.toISOString())
      }
      if (selectedClient) {
        query = query.eq('projects.client_id', selectedClient)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: ReportEntry[] = (data || []).map((e: any) => ({
        id: e.id,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_seconds: e.duration_seconds,
        is_running: e.is_running,
        is_manual: e.is_manual,
        notes: e.notes,
        project_id: e.project_id,
        project_name: e.projects.name,
        client_id: e.projects.client_id,
        client_name: e.projects.clients.name,
        client_color: e.projects.clients.color,
        effectiveRate: e.projects.hourly_rate_override ?? e.projects.clients.hourly_rate,
      }))

      // Store entries for CSV export
      setReportEntries(entries)

      // Group by client → project
      const clientMap = new Map<string, ClientSummary>()

      for (const entry of entries) {
        const seconds = entry.duration_seconds ?? 0
        const cost = calculateRunningCost(seconds, entry.effectiveRate)

        if (!clientMap.has(entry.client_id)) {
          clientMap.set(entry.client_id, {
            id: entry.client_id,
            name: entry.client_name,
            color: entry.client_color,
            totalSeconds: 0,
            totalCost: 0,
            entryCount: 0,
            projects: [],
          })
        }

        const client = clientMap.get(entry.client_id)!
        client.totalSeconds += seconds
        client.totalCost += cost
        client.entryCount += 1

        let project = client.projects.find((p) => p.id === entry.project_id)
        if (!project) {
          project = {
            id: entry.project_id,
            name: entry.project_name,
            totalSeconds: 0,
            totalCost: 0,
            entryCount: 0,
          }
          client.projects.push(project)
        }
        project.totalSeconds += seconds
        project.totalCost += cost
        project.entryCount += 1
      }

      // Sort clients by total cost descending, projects within each client by cost descending
      const summaries = Array.from(clientMap.values())
        .sort((a, b) => b.totalCost - a.totalCost)
        .map((client) => ({
          ...client,
          projects: client.projects.sort((a, b) => b.totalCost - a.totalCost),
        }))

      setClientSummaries(summaries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [selectedClient, startDate, endDate])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const clearFilters = () => {
    setSelectedClient('')
    setStartDate('')
    setEndDate('')
  }

  const toggleCollapse = (clientId: string) => {
    setCollapsed((prev) => ({ ...prev, [clientId]: !prev[clientId] }))
  }

  const hasFilters = selectedClient || startDate || endDate

  const handleExportCSV = () => {
    if (reportEntries.length === 0) return

    const csvEntries = reportEntries.map((e) => ({
      client_name: e.client_name,
      project_name: e.project_name,
      start_time: e.start_time,
      end_time: e.end_time,
      duration_seconds: e.duration_seconds,
      notes: e.notes,
      is_manual: e.is_manual,
      effectiveRate: e.effectiveRate,
    }))

    const csv = generateCSV(csvEntries)
    const clientName = selectedClient
      ? clients.find((c) => c.id === selectedClient)?.name
      : undefined
    const filename = generateCSVFilename(clientName, startDate, endDate)
    downloadCSV(csv, filename)
  }

  // Grand totals
  const grandTotalSeconds = clientSummaries.reduce((sum, c) => sum + c.totalSeconds, 0)
  const grandTotalCost = clientSummaries.reduce((sum, c) => sum + c.totalCost, 0)
  const grandTotalEntries = clientSummaries.reduce((sum, c) => sum + c.entryCount, 0)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded bg-gray-200" />
          <div className="space-y-2">
            <div className="h-6 w-24 rounded bg-gray-200" />
            <div className="h-3 w-40 rounded bg-gray-200" />
          </div>
        </div>
        <div className="rounded-card border border-border bg-background p-4 shadow-card">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="h-10 rounded bg-gray-200 col-span-2 sm:col-span-1" />
            <div className="h-10 rounded bg-gray-200" />
            <div className="h-10 rounded bg-gray-200" />
          </div>
        </div>
        <div className="rounded-card border border-primary bg-primary-light p-4 shadow-card">
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="flex gap-6">
              <div className="h-6 w-20 rounded bg-gray-200" />
              <div className="h-6 w-20 rounded bg-gray-200" />
            </div>
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-card border border-border bg-background p-5 shadow-card">
            <div className="flex justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-gray-200" />
                <div className="space-y-1">
                  <div className="h-4 w-28 rounded bg-gray-200" />
                  <div className="h-3 w-20 rounded bg-gray-200" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-16 rounded bg-gray-200" />
                <div className="h-4 w-16 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 p-6">
        <p className="text-red-600">Failed to load report: {error}</p>
        <button
          onClick={loadReport}
          className="mt-2 text-sm font-medium text-primary hover:text-primary-dark"
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
            src="/DO_CODE_LAB_LOGO_NO_TEXT.png"
            alt="DO Code Lab"
            width={48}
            height={48}
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-text">Reports</h1>
            <p className="text-sm text-text-muted">
              Summary by client and project
              {hasFilters ? ' (filtered)' : ''}
            </p>
          </div>
        </div>
        {reportEntries.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-button bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors self-start"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-card border border-border bg-background p-4 shadow-card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {hasFilters && (
            <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-1">
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

      {/* Grand Totals */}
      {clientSummaries.length > 0 && (
        <div className="mb-6 rounded-card border border-primary bg-primary-light p-4 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary-dark">Total</p>
              <p className="text-xs text-text-muted">
                {grandTotalEntries} {grandTotalEntries === 1 ? 'entry' : 'entries'} across {clientSummaries.length} {clientSummaries.length === 1 ? 'client' : 'clients'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="sm:text-right">
                <p className="font-mono text-lg font-semibold text-primary-dark">
                  {formatDuration(grandTotalSeconds)}
                </p>
                <p className="text-xs text-text-muted">Total Time</p>
              </div>
              <div className="sm:text-right">
                <p className="font-mono text-lg font-semibold text-primary-dark">
                  {formatCurrency(grandTotalCost)}
                </p>
                <p className="text-xs text-text-muted">Total Earned</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Summaries */}
      {clientSummaries.length === 0 ? (
        <EmptyState title={hasFilters ? 'No matching entries' : 'No completed time entries yet'}>
          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="font-medium text-primary hover:text-primary-dark"
            >
              Clear filters
            </button>
          ) : (
            'Complete some timer sessions to see your report.'
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {clientSummaries.map((client) => (
            <div
              key={client.id}
              className="overflow-hidden rounded-card border border-border bg-background shadow-card"
            >
              {/* Client Header */}
              <button
                onClick={() => toggleCollapse(client.id)}
                className="flex w-full items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-4 text-left hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span
                    className="h-4 w-4 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-text truncate">{client.name}</p>
                    <p className="text-xs text-text-muted">
                      {client.entryCount} {client.entryCount === 1 ? 'entry' : 'entries'} · {client.projects.length} {client.projects.length === 1 ? 'project' : 'projects'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-mono text-xs sm:text-sm font-semibold text-text">
                      {formatDuration(client.totalSeconds)}
                    </p>
                    <p className="hidden sm:block text-xs text-text-muted">Time</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs sm:text-sm font-semibold text-text">
                      {formatCurrency(client.totalCost)}
                    </p>
                    <p className="hidden sm:block text-xs text-text-muted">Earned</p>
                  </div>
                  {/* Collapse chevron */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-text-muted transition-transform ${collapsed[client.id] ? '' : 'rotate-180'}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>

              {/* Project Breakdown */}
              {!collapsed[client.id] && (
                <div className="border-t border-border">
                  <div className="divide-y divide-border">
                    {client.projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 pl-8 sm:pl-12"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text truncate">{project.name}</p>
                          <p className="text-xs text-text-muted">
                            {project.entryCount} {project.entryCount === 1 ? 'entry' : 'entries'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="font-mono text-xs sm:text-sm text-text">
                              {formatDuration(project.totalSeconds)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-xs sm:text-sm text-text">
                              {formatCurrency(project.totalCost)}
                            </p>
                          </div>
                          {/* Spacer to align with chevron column */}
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

import { getSupabase } from './supabase'
import type { TimeEntry, TimeEntryInsert, TimeEntryUpdate } from '@/types/database'

/**
 * Timer Engine - Core functions for managing time entries
 *
 * Start timer → creates time_entry with is_running=true
 * Uses Supabase for persistence (survives browser close/refresh)
 */

export interface TimerResult {
  success: boolean
  timeEntry?: TimeEntry
  error?: string
}

/**
 * Start a new timer for a project
 * Creates a time_entry with is_running=true, start_time=now
 * Prevents multiple running timers for the same project (one per project max)
 */
export async function startTimer(projectId: string, notes?: string): Promise<TimerResult> {
  const supabase = getSupabase()

  // Prevent multiple running timers on the same project
  const existingTimer = await getRunningTimerForProject(projectId)
  if (existingTimer) {
    return {
      success: false,
      error: 'A timer is already running for this project',
    }
  }

  const newEntry: TimeEntryInsert = {
    project_id: projectId,
    start_time: new Date().toISOString(),
    is_running: true,
    is_manual: false,
    notes: notes || null,
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert(newEntry)
    .select()
    .single()

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
    timeEntry: data,
  }
}

/**
 * Get all currently running timers
 * Returns time entries where is_running=true
 */
export async function getRunningTimers(): Promise<TimeEntry[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('is_running', true)
    .order('start_time', { ascending: false })

  if (error) {
    console.error('Error fetching running timers:', error)
    return []
  }

  return data || []
}

/**
 * Get running timer for a specific project
 * Returns the running time entry for that project, or null if none
 */
export async function getRunningTimerForProject(projectId: string): Promise<TimeEntry | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_running', true)
    .single()

  if (error) {
    // PGRST116 means no rows found, which is expected
    if (error.code !== 'PGRST116') {
      console.error('Error fetching running timer for project:', error)
    }
    return null
  }

  return data
}

/**
 * Check if a project has a running timer
 */
export async function hasRunningTimer(projectId: string): Promise<boolean> {
  const timer = await getRunningTimerForProject(projectId)
  return timer !== null
}

/**
 * Stop a running timer
 * Sets end_time to now, calculates duration_seconds, sets is_running=false
 */
export async function stopTimer(timeEntryId: string): Promise<TimerResult> {
  const supabase = getSupabase()

  // First, get the current time entry to access start_time
  const { data: currentEntry, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', timeEntryId)
    .single()

  if (fetchError || !currentEntry) {
    return {
      success: false,
      error: fetchError?.message || 'Time entry not found',
    }
  }

  if (!currentEntry.is_running) {
    return {
      success: false,
      error: 'Timer is not running',
    }
  }

  // Calculate duration and set end time
  const endTime = new Date()
  const durationSeconds = calculateElapsedSeconds(currentEntry.start_time)

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      end_time: endTime.toISOString(),
      duration_seconds: durationSeconds,
      is_running: false,
    })
    .eq('id', timeEntryId)
    .select()
    .single()

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
    timeEntry: data,
  }
}

/**
 * Stop timer by project ID
 * Convenience function that finds and stops the running timer for a project
 */
export async function stopTimerForProject(projectId: string): Promise<TimerResult> {
  const runningTimer = await getRunningTimerForProject(projectId)

  if (!runningTimer) {
    return {
      success: false,
      error: 'No running timer found for this project',
    }
  }

  return stopTimer(runningTimer.id)
}

/**
 * Pause timer for a project
 * Stops the current running entry - on resume, a new entry will be created
 * This is essentially the same as stopTimerForProject, but semantically indicates
 * the intent to resume later (vs. completing work for the day)
 */
export async function pauseTimer(projectId: string): Promise<TimerResult> {
  return stopTimerForProject(projectId)
}

/**
 * Resume timer for a project
 * Starts a new time entry, optionally copying notes from the last entry
 */
export async function resumeTimer(projectId: string, copyNotes: boolean = true): Promise<TimerResult> {
  // Check if there's already a running timer for this project
  const existingTimer = await getRunningTimerForProject(projectId)
  if (existingTimer) {
    return {
      success: false,
      error: 'Timer is already running for this project',
    }
  }

  // Optionally get the last entry's notes to continue where we left off
  let notes: string | undefined
  if (copyNotes) {
    const lastEntry = await getLastEntryForProject(projectId)
    if (lastEntry?.notes) {
      notes = lastEntry.notes
    }
  }

  return startTimer(projectId, notes)
}

/**
 * Get the most recent time entry for a project (running or stopped)
 * Useful for resuming with the same notes
 */
export async function getLastEntryForProject(projectId: string): Promise<TimeEntry | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('start_time', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    // PGRST116 means no rows found
    if (error.code !== 'PGRST116') {
      console.error('Error fetching last entry for project:', error)
    }
    return null
  }

  return data
}

/**
 * Check if a project has a paused timer (has recent entries but none running)
 * Returns the last stopped entry if paused, null otherwise
 */
export async function getPausedTimerForProject(projectId: string): Promise<TimeEntry | null> {
  // First check if there's a running timer - if so, it's not paused
  const runningTimer = await getRunningTimerForProject(projectId)
  if (runningTimer) {
    return null
  }

  // Get the last entry - if it exists and was stopped today, consider it "paused"
  const lastEntry = await getLastEntryForProject(projectId)
  if (!lastEntry || !lastEntry.end_time) {
    return null
  }

  // Consider it "paused" if the last entry was stopped within the last 24 hours
  const endTime = new Date(lastEntry.end_time)
  const now = new Date()
  const hoursSinceStopped = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60)

  if (hoursSinceStopped <= 24) {
    return lastEntry
  }

  return null
}

/**
 * Get timer state for a project (running, paused, or stopped)
 */
export type TimerState = 'running' | 'paused' | 'stopped'

export async function getTimerStateForProject(projectId: string): Promise<{
  state: TimerState
  entry: TimeEntry | null
}> {
  const runningTimer = await getRunningTimerForProject(projectId)
  if (runningTimer) {
    return { state: 'running', entry: runningTimer }
  }

  const pausedTimer = await getPausedTimerForProject(projectId)
  if (pausedTimer) {
    return { state: 'paused', entry: pausedTimer }
  }

  return { state: 'stopped', entry: null }
}

/**
 * Calculate elapsed seconds for a running timer
 */
export function calculateElapsedSeconds(startTime: string): number {
  const start = new Date(startTime)
  const now = new Date()
  return Math.floor((now.getTime() - start.getTime()) / 1000)
}

/**
 * Format seconds to HH:MM:SS display
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  return [hours, minutes, secs]
    .map(n => n.toString().padStart(2, '0'))
    .join(':')
}

/**
 * Calculate running cost based on elapsed time and hourly rate
 */
export function calculateRunningCost(seconds: number, hourlyRate: number): number {
  const hours = seconds / 3600
  return hours * hourlyRate
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Running timer with full project and client info
 * Used for dashboard display of all simultaneous timers
 */
export interface RunningTimerWithProject {
  timeEntry: TimeEntry
  project: {
    id: string
    name: string
    hourly_rate_override: number | null
  }
  client: {
    id: string
    name: string
    hourly_rate: number
    color: string
  }
  effectiveRate: number
}

/**
 * Get all running timers with their project and client information
 * Supports multiple simultaneous timers (one per project)
 * Returns data needed for dashboard display: timer, project, client, and effective rate
 */
export async function getAllRunningTimersWithProjects(): Promise<RunningTimerWithProject[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      *,
      projects!inner(
        id,
        name,
        hourly_rate_override,
        clients!inner(
          id,
          name,
          hourly_rate,
          color
        )
      )
    `)
    .eq('is_running', true)
    .order('start_time', { ascending: false })

  if (error) {
    console.error('Error fetching running timers with projects:', error)
    return []
  }

  if (!data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((entry: any) => {
    const project = entry.projects
    const client = project.clients
    const effectiveRate = project.hourly_rate_override ?? client.hourly_rate

    return {
      timeEntry: {
        id: entry.id,
        project_id: entry.project_id,
        start_time: entry.start_time,
        end_time: entry.end_time,
        duration_seconds: entry.duration_seconds,
        notes: entry.notes,
        is_manual: entry.is_manual,
        is_running: entry.is_running,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      },
      project: {
        id: project.id,
        name: project.name,
        hourly_rate_override: project.hourly_rate_override,
      },
      client: {
        id: client.id,
        name: client.name,
        hourly_rate: client.hourly_rate,
        color: client.color,
      },
      effectiveRate,
    }
  })
}

/**
 * Update a time entry (for editing start/end times, notes)
 * Recalculates duration_seconds if start_time or end_time changes
 */
export async function updateTimeEntry(
  timeEntryId: string,
  updates: TimeEntryUpdate
): Promise<TimerResult> {
  const supabase = getSupabase()

  // If both start and end times are present, recalculate duration
  if (updates.start_time && updates.end_time) {
    const start = new Date(updates.start_time)
    const end = new Date(updates.end_time)
    updates.duration_seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
  } else if (updates.start_time || updates.end_time) {
    // Need to fetch existing entry to calculate with the other time
    const { data: existing, error: fetchError } = await supabase
      .from('time_entries')
      .select('start_time, end_time')
      .eq('id', timeEntryId)
      .single()

    if (fetchError || !existing) {
      return { success: false, error: fetchError?.message || 'Entry not found' }
    }

    const start = new Date(updates.start_time || existing.start_time)
    const end = updates.end_time
      ? new Date(updates.end_time)
      : existing.end_time
        ? new Date(existing.end_time)
        : null

    if (end) {
      updates.duration_seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
    }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', timeEntryId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, timeEntry: data }
}

/**
 * Delete a time entry
 * Prevents deleting running timers (stop them first)
 */
export async function deleteTimeEntry(timeEntryId: string): Promise<TimerResult> {
  const supabase = getSupabase()

  // Fetch entry to check if it's running
  const { data: entry, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', timeEntryId)
    .single()

  if (fetchError || !entry) {
    return { success: false, error: fetchError?.message || 'Entry not found' }
  }

  if (entry.is_running) {
    return { success: false, error: 'Cannot delete a running timer. Stop it first.' }
  }

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', timeEntryId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Create a manual time entry (add time after the fact)
 * Requires project_id, start_time, end_time; calculates duration automatically
 */
export async function createManualEntry(
  projectId: string,
  startTime: string,
  endTime: string,
  notes?: string
): Promise<TimerResult> {
  const supabase = getSupabase()

  const start = new Date(startTime)
  const end = new Date(endTime)
  const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000)

  if (durationSeconds <= 0) {
    return { success: false, error: 'End time must be after start time' }
  }

  const newEntry: TimeEntryInsert = {
    project_id: projectId,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    duration_seconds: durationSeconds,
    is_running: false,
    is_manual: true,
    notes: notes || null,
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert(newEntry)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, timeEntry: data }
}

/**
 * Count of currently running timers
 * Quick check for dashboard indicators
 */
export async function getRunningTimerCount(): Promise<number> {
  const supabase = getSupabase()

  const { count, error } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact', head: true })
    .eq('is_running', true)

  if (error) {
    console.error('Error counting running timers:', error)
    return 0
  }

  return count ?? 0
}

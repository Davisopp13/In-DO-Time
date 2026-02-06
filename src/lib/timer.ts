import { getSupabase } from './supabase'
import type { TimeEntry, TimeEntryInsert } from '@/types/database'

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
 */
export async function startTimer(projectId: string, notes?: string): Promise<TimerResult> {
  const supabase = getSupabase()

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

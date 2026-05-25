import { getSupabase } from '@/lib/supabase'
import type { JournalEntry, Observation, OpenLoop, Project, Trail } from '@/types/database'
import type { BriefingInputs, ProjectWithTrail } from './types'

function startOfDay(offsetDays: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return date
}

export async function gatherBriefingInputs(): Promise<BriefingInputs> {
  const supabase = getSupabase()
  const since = startOfDay(-1).toISOString()

  const [obsResult, journalResult, loopsResult, projectsResult, trailsResult] = await Promise.all([
    supabase.from('observations').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(30),
    supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(3),
    supabase.from('open_loops').select('*').eq('status', 'open').order('order', { ascending: true }).limit(30),
    supabase.from('projects').select('*'),
    supabase.from('trails').select('id, name, color'),
  ])

  if (obsResult.error || journalResult.error || loopsResult.error) {
    throw new Error('Failed to load briefing inputs')
  }

  const trails = new Map(
    ((trailsResult.data as Pick<Trail, 'id' | 'name' | 'color'>[]) || []).map((trail) => [trail.id, trail])
  )
  const projects = new Map(
    ((projectsResult.data as Project[]) || []).map((project) => [
      project.id,
      { ...project, trail: trails.get(project.trail_id) } as ProjectWithTrail,
    ])
  )

  return {
    observations: (obsResult.data as Observation[]) || [],
    journalEntries: (journalResult.data as JournalEntry[]) || [],
    openLoops: ((loopsResult.data as OpenLoop[]) || []).map((loop) => ({
      ...loop,
      project: projects.get(loop.project_id),
    })),
  }
}

import { getSupabase } from '@/lib/supabase'
import type { JournalEntry, Observation, Project, ReleaseDocument, Trail } from '@/types/database'
import type { ReleaseInputs, ReleaseMode, ReleaseProject, ReleaseTrail } from './types'

type SupabaseLike = ReturnType<typeof getSupabase>

export interface GatherReleaseParams {
  mode: ReleaseMode
  trailId: string
  startDate: string
  endDate: string
}

function assertDateString(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a YYYY-MM-DD date`)
  }
}

function startDateTime(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString()
}

function endDateTime(date: string): string {
  return new Date(`${date}T23:59:59.999Z`).toISOString()
}

function toReleaseTrail(trail: Trail): ReleaseTrail {
  return {
    id: trail.id,
    name: trail.name,
    slug: trail.slug,
    kind: trail.kind,
    description: trail.description,
    color: trail.color,
  }
}

function toReleaseProject(project: Project): ReleaseProject {
  return {
    id: project.id,
    trail_id: project.trail_id,
    name: project.name,
    description: project.description,
    status: project.status,
  }
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase()
}

function contentMentionsScope(observation: Observation, trail: Trail, projects: ReleaseProject[]): boolean {
  return textMentionsScope(observation.content, trail, projects)
}

function textMentionsScope(text: string, trail: Trail, projects: ReleaseProject[]): boolean {
  const content = normalizeSearchText(text)
  const candidates = [
    trail.name,
    trail.slug,
    ...projects.map((project) => project.name),
  ]
    .map(normalizeSearchText)
    .filter((value) => value.length >= 3)

  return candidates.some((candidate) => content.includes(candidate))
}

export async function gatherReleaseInputs(
  params: GatherReleaseParams,
  supabase: SupabaseLike = getSupabase()
): Promise<ReleaseInputs> {
  assertDateString(params.startDate, 'startDate')
  assertDateString(params.endDate, 'endDate')

  if (params.endDate < params.startDate) {
    throw new Error('endDate must be on or after startDate')
  }

  const { data: trailData, error: trailError } = await supabase
    .from('trails')
    .select('*')
    .eq('id', params.trailId)
    .single()

  if (trailError || !trailData) {
    throw new Error('Trail not found')
  }

  const trail = trailData as Trail
  if (params.mode === 'client' && trail.kind !== 'client') {
    throw new Error('Client release documents can only be generated for client trails')
  }

  const [projectsResult, observationsResult, journalResult] = await Promise.all([
    supabase.from('projects').select('*').eq('trail_id', params.trailId).order('name'),
    supabase
      .from('observations')
      .select('*')
      .gte('created_at', startDateTime(params.startDate))
      .lte('created_at', endDateTime(params.endDate))
      .order('created_at', { ascending: true })
      .limit(500),
    supabase
      .from('journal_entries')
      .select('*')
      .gte('entry_date', params.startDate)
      .lte('entry_date', params.endDate)
      .order('entry_date', { ascending: true }),
  ])

  if (projectsResult.error || observationsResult.error || journalResult.error) {
    throw new Error('Failed to load release inputs')
  }

  const projects = ((projectsResult.data as Project[]) || []).map(toReleaseProject)
  const projectIds = new Set(projects.map((project) => project.id))
  const observations = ((observationsResult.data as Observation[]) || []).filter((observation) => {
    if (observation.related_trail_id === params.trailId) return true
    if (observation.related_project_id && projectIds.has(observation.related_project_id)) return true
    if (
      params.mode === 'internal' &&
      observation.related_trail_id === null &&
      observation.related_project_id === null &&
      contentMentionsScope(observation, trail, projects)
    ) {
      return true
    }
    return false
  })
  const journalEntries = ((journalResult.data as JournalEntry[]) || []).filter((entry) => textMentionsScope(entry.content, trail, projects))

  return {
    mode: params.mode,
    trail: toReleaseTrail(trail),
    projects,
    observations,
    journalEntries,
    startDate: params.startDate,
    endDate: params.endDate,
  }
}

export async function getLatestReleaseDocument(
  mode: ReleaseMode,
  trailId: string,
  supabase: SupabaseLike = getSupabase()
): Promise<ReleaseDocument | null> {
  const { data, error } = await supabase
    .from('release_documents')
    .select('*')
    .eq('mode', mode)
    .eq('trail_id', trailId)
    .order('end_date', { ascending: false })
    .limit(1)

  if (error) return null
  return ((data as ReleaseDocument[]) || [])[0] ?? null
}

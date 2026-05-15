// Dev-only: seeds default trails and rates for a fresh install.
// Called by Dashboard on first load when no projects exist.
import { getSupabase } from './supabase'

interface SeedTrail {
  name: string
  slug: string
  kind: 'client' | 'employer' | 'personal' | 'project'
  is_billable: boolean
  color: string
  display_order: number
  projects: string[]
  initial_rate?: number
}

const DEFAULT_TRAILS: SeedTrail[] = [
  {
    name: 'B.B.',
    slug: 'bb',
    kind: 'client',
    is_billable: true,
    color: '#3A7D44',
    display_order: 1,
    projects: ['GA Gymnastics State Meets'],
    initial_rate: 50.00,
  },
  {
    name: 'Evermore Equine',
    slug: 'evermore-equine',
    kind: 'client',
    is_billable: true,
    color: '#8B4513',
    display_order: 2,
    projects: ['Client Portal'],
    initial_rate: 50.00,
  },
  {
    name: 'Hapag-Lloyd',
    slug: 'hapag-lloyd',
    kind: 'employer',
    is_billable: false,
    color: '#003D6B',
    display_order: 3,
    projects: ['Logistics Dashboard'],
  },
  {
    name: 'DObot',
    slug: 'dobot',
    kind: 'project',
    is_billable: false,
    color: '#6B46C1',
    display_order: 4,
    projects: ['Core Development'],
  },
  {
    name: 'In DO Time',
    slug: 'in-do-time',
    kind: 'project',
    is_billable: false,
    color: '#1B5E20',
    display_order: 5,
    projects: ['Foundation Rebuild'],
  },
  {
    name: 'Personal',
    slug: 'personal',
    kind: 'personal',
    is_billable: false,
    color: '#6B7280',
    display_order: 6,
    projects: [],
  },
]

export async function seedDefaultTrails(): Promise<{ seeded: boolean; message: string }> {
  const supabase = getSupabase()

  const { data: existingTrails, error: fetchError } = await supabase
    .from('trails')
    .select('slug')

  if (fetchError) {
    return { seeded: false, message: `Failed to check existing trails: ${fetchError.message}` }
  }

  const existingSlugs = new Set((existingTrails || []).map((t: { slug: string }) => t.slug))
  let seededCount = 0

  for (const trailDef of DEFAULT_TRAILS) {
    if (existingSlugs.has(trailDef.slug)) {
      continue
    }

    const { data: trail, error: trailError } = await supabase
      .from('trails')
      .insert({
        name: trailDef.name,
        slug: trailDef.slug,
        kind: trailDef.kind,
        is_billable: trailDef.is_billable,
        color: trailDef.color,
        display_order: trailDef.display_order,
        status: 'active',
      })
      .select('id')
      .single()

    if (trailError || !trail) {
      return { seeded: false, message: `Failed to create trail ${trailDef.name}: ${trailError?.message}` }
    }

    for (const projectName of trailDef.projects) {
      const { error: projectError } = await supabase
        .from('projects')
        .insert({ trail_id: trail.id, name: projectName })

      if (projectError) {
        return { seeded: false, message: `Failed to create project ${projectName}: ${projectError.message}` }
      }
    }

    if (trailDef.initial_rate != null) {
      const today = new Date().toISOString().split('T')[0]
      const { error: rateError } = await supabase
        .from('rates')
        .insert({
          trail_id: trail.id,
          project_id: null,
          hourly_rate: trailDef.initial_rate,
          effective_from: today,
          effective_until: null,
        })

      if (rateError) {
        return { seeded: false, message: `Failed to create rate for ${trailDef.name}: ${rateError.message}` }
      }
    }

    seededCount++
  }

  if (seededCount === 0) {
    return { seeded: false, message: 'Default trails already exist' }
  }

  return { seeded: true, message: `Seeded ${seededCount} default trail(s) with projects` }
}

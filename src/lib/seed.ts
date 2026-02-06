import { getSupabase } from './supabase'

interface SeedClient {
  name: string
  hourly_rate: number
  color: string
  projects: string[]
}

const DEFAULT_CLIENTS: SeedClient[] = [
  {
    name: 'B.B.',
    hourly_rate: 30.00,
    color: '#2563EB',
    projects: ['GA Gymnastics State Meets'],
  },
  {
    name: 'Mariah',
    hourly_rate: 45.00,
    color: '#7C3AED',
    projects: ['Evermore Equine'],
  },
]

export async function seedDefaultClients(): Promise<{ seeded: boolean; message: string }> {
  const supabase = getSupabase()

  // Check if clients already exist
  const { data: existingClients, error: fetchError } = await supabase
    .from('clients')
    .select('name')

  if (fetchError) {
    return { seeded: false, message: `Failed to check existing clients: ${fetchError.message}` }
  }

  const existingNames = new Set((existingClients || []).map(c => c.name))
  let seededCount = 0

  for (const clientDef of DEFAULT_CLIENTS) {
    if (existingNames.has(clientDef.name)) {
      continue
    }

    // Insert client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: clientDef.name,
        hourly_rate: clientDef.hourly_rate,
        color: clientDef.color,
      })
      .select('id')
      .single()

    if (clientError || !client) {
      return { seeded: false, message: `Failed to create client ${clientDef.name}: ${clientError?.message}` }
    }

    // Insert projects
    for (const projectName of clientDef.projects) {
      const { error: projectError } = await supabase
        .from('projects')
        .insert({
          client_id: client.id,
          name: projectName,
        })

      if (projectError) {
        return { seeded: false, message: `Failed to create project ${projectName}: ${projectError.message}` }
      }
    }

    seededCount++
  }

  if (seededCount === 0) {
    return { seeded: false, message: 'Default clients already exist' }
  }

  return { seeded: true, message: `Seeded ${seededCount} default client(s) with projects` }
}

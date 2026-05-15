/**
 * Mock Data for Demo Mode
 * Provides realistic sample data for demonstrating In DO Time without a database
 */

import type { Database } from '@/types/database'

type Trail = Database['public']['Tables']['trails']['Row']
type Rate = Database['public']['Tables']['rates']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type TimeEntry = Database['public']['Tables']['time_entries']['Row']

// Generate consistent UUIDs for demo data
const generateId = (seed: string): string => {
  const hash = seed.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-a${hex.slice(0, 3)}-${hex.slice(0, 12)}`.slice(0, 36)
}

// Demo Trails (matching seed data)
export const mockTrails: Trail[] = [
  {
    id: generateId('trail-bb'),
    name: 'B.B.',
    slug: 'bb',
    description: null,
    kind: 'client',
    is_billable: true,
    color: '#3A7D44',
    status: 'active',
    display_order: 1,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: generateId('trail-evermore-equine'),
    name: 'Evermore Equine',
    slug: 'evermore-equine',
    description: null,
    kind: 'client',
    is_billable: true,
    color: '#8B4513',
    status: 'active',
    display_order: 2,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: generateId('trail-hapag-lloyd'),
    name: 'Hapag-Lloyd',
    slug: 'hapag-lloyd',
    description: null,
    kind: 'employer',
    is_billable: false,
    color: '#003D6B',
    status: 'active',
    display_order: 3,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: generateId('trail-dobot'),
    name: 'DObot',
    slug: 'dobot',
    description: null,
    kind: 'project',
    is_billable: false,
    color: '#6B46C1',
    status: 'active',
    display_order: 4,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: generateId('trail-in-do-time'),
    name: 'In DO Time',
    slug: 'in-do-time',
    description: null,
    kind: 'project',
    is_billable: false,
    color: '#1B5E20',
    status: 'active',
    display_order: 5,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: generateId('trail-personal'),
    name: 'Personal',
    slug: 'personal',
    description: null,
    kind: 'personal',
    is_billable: false,
    color: '#6B7280',
    status: 'active',
    display_order: 6,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
]

// Demo Rates (one per client trail at $50/hr effective 2026-01-01)
export const mockRates: Rate[] = [
  {
    id: generateId('rate-bb'),
    trail_id: generateId('trail-bb'),
    project_id: null,
    hourly_rate: 50.00,
    effective_from: '2026-01-01',
    effective_until: null,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: generateId('rate-evermore-equine'),
    trail_id: generateId('trail-evermore-equine'),
    project_id: null,
    hourly_rate: 50.00,
    effective_from: '2026-01-01',
    effective_until: null,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
]

// Demo Projects
export const mockProjects: Project[] = [
  {
    id: generateId('project-bb-website'),
    trail_id: generateId('trail-bb'),
    name: 'Website Redesign',
    description: null,
    status: 'active',
    created_at: new Date('2026-01-15T10:30:00Z').toISOString(),
    updated_at: new Date('2026-01-15T10:30:00Z').toISOString(),
  },
  {
    id: generateId('project-bb-mobile'),
    trail_id: generateId('trail-bb'),
    name: 'Mobile App Development',
    description: null,
    status: 'active',
    created_at: new Date('2026-01-16T13:00:00Z').toISOString(),
    updated_at: new Date('2026-01-16T13:00:00Z').toISOString(),
  },
  {
    id: generateId('project-evermore-portal'),
    trail_id: generateId('trail-evermore-equine'),
    name: 'Client Portal',
    description: null,
    status: 'active',
    created_at: new Date('2026-01-20T15:00:00Z').toISOString(),
    updated_at: new Date('2026-01-20T15:00:00Z').toISOString(),
  },
  {
    id: generateId('project-hapag-dashboard'),
    trail_id: generateId('trail-hapag-lloyd'),
    name: 'Logistics Dashboard',
    description: null,
    status: 'active',
    created_at: new Date('2026-02-01T10:00:00Z').toISOString(),
    updated_at: new Date('2026-02-01T10:00:00Z').toISOString(),
  },
  {
    id: generateId('project-dobot-core'),
    trail_id: generateId('trail-dobot'),
    name: 'Core Development',
    description: null,
    status: 'active',
    created_at: new Date('2026-02-05T12:00:00Z').toISOString(),
    updated_at: new Date('2026-02-05T12:00:00Z').toISOString(),
  },
  {
    id: generateId('project-idt-foundation'),
    trail_id: generateId('trail-in-do-time'),
    name: 'Foundation Rebuild',
    description: null,
    status: 'active',
    created_at: new Date('2026-02-10T09:00:00Z').toISOString(),
    updated_at: new Date('2026-02-10T09:00:00Z').toISOString(),
  },
]

// Helper to generate time entries for today and yesterday
const generateTimeEntries = (): TimeEntry[] => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  return [
    {
      id: generateId('entry-today-1'),
      project_id: generateId('project-bb-website'),
      start_time: new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(today.getTime() + 11 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 2 * 60 * 60,
      notes: 'Completed homepage mockups and design system setup',
      is_manual: false,
      is_running: false,
      source: 'manual',
      source_observation_id: null,
      created_at: new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(today.getTime() + 11 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-today-2'),
      project_id: generateId('project-evermore-portal'),
      start_time: new Date(today.getTime() + 11.5 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(today.getTime() + 13 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 1.5 * 60 * 60,
      notes: 'Implemented booking calendar functionality',
      is_manual: false,
      is_running: false,
      source: 'manual',
      source_observation_id: null,
      created_at: new Date(today.getTime() + 11.5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(today.getTime() + 13 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-today-3'),
      project_id: generateId('project-hapag-dashboard'),
      start_time: new Date(today.getTime() + 14 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(today.getTime() + 15.25 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 1.25 * 60 * 60,
      notes: 'REST API endpoints for vessel tracking',
      is_manual: false,
      is_running: false,
      source: 'manual',
      source_observation_id: null,
      created_at: new Date(today.getTime() + 14 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(today.getTime() + 15.25 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-yesterday-1'),
      project_id: generateId('project-bb-mobile'),
      start_time: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 3 * 60 * 60,
      notes: 'User authentication flow and state management',
      is_manual: false,
      is_running: false,
      source: 'manual',
      source_observation_id: null,
      created_at: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-yesterday-2'),
      project_id: generateId('project-idt-foundation'),
      start_time: new Date(yesterday.getTime() + 13 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(yesterday.getTime() + 16.5 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 3.5 * 60 * 60,
      notes: 'Schema reset and type definitions',
      is_manual: false,
      is_running: false,
      source: 'manual',
      source_observation_id: null,
      created_at: new Date(yesterday.getTime() + 13 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(yesterday.getTime() + 16.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-yesterday-3'),
      project_id: generateId('project-dobot-core'),
      start_time: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 2 * 60 * 60,
      notes: 'Prompt engineering for observation parsing',
      is_manual: false,
      is_running: false,
      source: 'manual',
      source_observation_id: null,
      created_at: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

export const mockTimeEntries: TimeEntry[] = generateTimeEntries()

// In-memory store for demo mode (allows CRUD operations to persist during session)
export class MockDataStore {
  private trails: Map<string, Trail>
  private rates: Map<string, Rate>
  private projects: Map<string, Project>
  private timeEntries: Map<string, TimeEntry>

  constructor() {
    this.trails = new Map(mockTrails.map(t => [t.id, { ...t }]))
    this.rates = new Map(mockRates.map(r => [r.id, { ...r }]))
    this.projects = new Map(mockProjects.map(p => [p.id, { ...p }]))
    this.timeEntries = new Map(mockTimeEntries.map(e => [e.id, { ...e }]))
  }

  // Trails
  getTrails(): Trail[] {
    return Array.from(this.trails.values())
  }

  getTrail(id: string): Trail | undefined {
    return this.trails.get(id)
  }

  addTrail(trail: Trail): Trail {
    this.trails.set(trail.id, trail)
    return trail
  }

  updateTrail(id: string, updates: Partial<Trail>): Trail | undefined {
    const trail = this.trails.get(id)
    if (!trail) return undefined
    const updated = { ...trail, ...updates, updated_at: new Date().toISOString() }
    this.trails.set(id, updated)
    return updated
  }

  deleteTrail(id: string): boolean {
    return this.trails.delete(id)
  }

  // Rates
  getRates(): Rate[] {
    return Array.from(this.rates.values())
  }

  getRate(id: string): Rate | undefined {
    return this.rates.get(id)
  }

  addRate(rate: Rate): Rate {
    this.rates.set(rate.id, rate)
    return rate
  }

  updateRate(id: string, updates: Partial<Rate>): Rate | undefined {
    const rate = this.rates.get(id)
    if (!rate) return undefined
    const updated = { ...rate, ...updates }
    this.rates.set(id, updated)
    return updated
  }

  deleteRate(id: string): boolean {
    return this.rates.delete(id)
  }

  // Projects
  getProjects(): Project[] {
    return Array.from(this.projects.values())
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id)
  }

  addProject(project: Project): Project {
    this.projects.set(project.id, project)
    return project
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const project = this.projects.get(id)
    if (!project) return undefined
    const updated = { ...project, ...updates, updated_at: new Date().toISOString() }
    this.projects.set(id, updated)
    return updated
  }

  deleteProject(id: string): boolean {
    return this.projects.delete(id)
  }

  // Time Entries
  getTimeEntries(): TimeEntry[] {
    return Array.from(this.timeEntries.values())
  }

  getTimeEntry(id: string): TimeEntry | undefined {
    return this.timeEntries.get(id)
  }

  addTimeEntry(entry: TimeEntry): TimeEntry {
    this.timeEntries.set(entry.id, entry)
    return entry
  }

  updateTimeEntry(id: string, updates: Partial<TimeEntry>): TimeEntry | undefined {
    const entry = this.timeEntries.get(id)
    if (!entry) return undefined
    const updated = { ...entry, ...updates, updated_at: new Date().toISOString() }
    this.timeEntries.set(id, updated)
    return updated
  }

  deleteTimeEntry(id: string): boolean {
    return this.timeEntries.delete(id)
  }

  // Helper: Generate new ID
  generateNewId(prefix: string): string {
    return generateId(`${prefix}-${Date.now()}-${Math.random()}`)
  }
}

// Singleton instance for demo mode
let storeInstance: MockDataStore | null = null

export function getMockDataStore(): MockDataStore {
  if (!storeInstance) {
    storeInstance = new MockDataStore()
  }
  return storeInstance
}

// Reset store (useful for testing or resetting demo)
export function resetMockDataStore(): void {
  storeInstance = new MockDataStore()
}

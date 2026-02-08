/**
 * Mock Data for Demo Mode
 * Provides realistic sample data for demonstrating In DO Time without a database
 */

import type { Database } from '@/types/database'

type Client = Database['public']['Tables']['clients']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type TimeEntry = Database['public']['Tables']['time_entries']['Row']

// Generate consistent UUIDs for demo data
const generateId = (seed: string): string => {
  // Simple deterministic UUID generation for demo
  const hash = seed.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-a${hex.slice(0, 3)}-${hex.slice(0, 12)}`.slice(0, 36)
}

// Demo Clients
export const mockClients: Client[] = [
  {
    id: generateId('client-do-code-lab'),
    name: 'DO Code Lab',
    hourly_rate: 85.00,
    color: '#3B82F6', // Blue
    status: 'active',
    created_at: new Date('2024-01-15T10:00:00Z').toISOString(),
    updated_at: new Date('2024-01-15T10:00:00Z').toISOString(),
  },
  {
    id: generateId('client-acme-corp'),
    name: 'Acme Corp',
    hourly_rate: 100.00,
    color: '#10B981', // Green
    status: 'active',
    created_at: new Date('2024-01-20T14:30:00Z').toISOString(),
    updated_at: new Date('2024-01-20T14:30:00Z').toISOString(),
  },
  {
    id: generateId('client-techstart'),
    name: 'TechStart Inc',
    hourly_rate: 75.00,
    color: '#8B5CF6', // Purple
    status: 'active',
    created_at: new Date('2024-02-01T09:15:00Z').toISOString(),
    updated_at: new Date('2024-02-01T09:15:00Z').toISOString(),
  },
  {
    id: generateId('client-creative-studio'),
    name: 'Creative Studio',
    hourly_rate: 90.00,
    color: '#F59E0B', // Amber
    status: 'active',
    created_at: new Date('2024-02-05T11:00:00Z').toISOString(),
    updated_at: new Date('2024-02-05T11:00:00Z').toISOString(),
  },
]

// Demo Projects
export const mockProjects: Project[] = [
  {
    id: generateId('project-website-redesign'),
    client_id: generateId('client-do-code-lab'),
    name: 'Website Redesign',
    hourly_rate_override: null,
    status: 'active',
    created_at: new Date('2024-01-15T10:30:00Z').toISOString(),
    updated_at: new Date('2024-01-15T10:30:00Z').toISOString(),
  },
  {
    id: generateId('project-mobile-app'),
    client_id: generateId('client-do-code-lab'),
    name: 'Mobile App Development',
    hourly_rate_override: 95.00,
    status: 'active',
    created_at: new Date('2024-01-16T13:00:00Z').toISOString(),
    updated_at: new Date('2024-01-16T13:00:00Z').toISOString(),
  },
  {
    id: generateId('project-ecommerce'),
    client_id: generateId('client-acme-corp'),
    name: 'E-commerce Platform',
    hourly_rate_override: null,
    status: 'active',
    created_at: new Date('2024-01-20T15:00:00Z').toISOString(),
    updated_at: new Date('2024-01-20T15:00:00Z').toISOString(),
  },
  {
    id: generateId('project-api-integration'),
    client_id: generateId('client-techstart'),
    name: 'API Integration',
    hourly_rate_override: null,
    status: 'active',
    created_at: new Date('2024-02-01T10:00:00Z').toISOString(),
    updated_at: new Date('2024-02-01T10:00:00Z').toISOString(),
  },
  {
    id: generateId('project-branding'),
    client_id: generateId('client-creative-studio'),
    name: 'Brand Identity',
    hourly_rate_override: null,
    status: 'active',
    created_at: new Date('2024-02-05T12:00:00Z').toISOString(),
    updated_at: new Date('2024-02-05T12:00:00Z').toISOString(),
  },
  {
    id: generateId('project-ui-library'),
    client_id: generateId('client-techstart'),
    name: 'UI Component Library',
    hourly_rate_override: 80.00,
    status: 'active',
    created_at: new Date('2024-02-03T14:00:00Z').toISOString(),
    updated_at: new Date('2024-02-03T14:00:00Z').toISOString(),
  },
]

// Helper to generate time entries for today and yesterday
const generateTimeEntries = (): TimeEntry[] => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  return [
    // Today's completed entries
    {
      id: generateId('entry-today-1'),
      project_id: generateId('project-website-redesign'),
      start_time: new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString(), // 9 AM
      end_time: new Date(today.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
      duration_seconds: 2 * 60 * 60, // 2 hours
      notes: 'Completed homepage mockups and design system setup',
      is_manual: false,
      is_running: false,
      created_at: new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(today.getTime() + 11 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-today-2'),
      project_id: generateId('project-ecommerce'),
      start_time: new Date(today.getTime() + 11.5 * 60 * 60 * 1000).toISOString(), // 11:30 AM
      end_time: new Date(today.getTime() + 13 * 60 * 60 * 1000).toISOString(), // 1 PM
      duration_seconds: 1.5 * 60 * 60, // 1.5 hours
      notes: 'Implemented shopping cart functionality',
      is_manual: false,
      is_running: false,
      created_at: new Date(today.getTime() + 11.5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(today.getTime() + 13 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-today-3'),
      project_id: generateId('project-api-integration'),
      start_time: new Date(today.getTime() + 14 * 60 * 60 * 1000).toISOString(), // 2 PM
      end_time: new Date(today.getTime() + 15.25 * 60 * 60 * 1000).toISOString(), // 3:15 PM
      duration_seconds: 1.25 * 60 * 60, // 1.25 hours
      notes: 'REST API endpoints and authentication',
      is_manual: false,
      is_running: false,
      created_at: new Date(today.getTime() + 14 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(today.getTime() + 15.25 * 60 * 60 * 1000).toISOString(),
    },

    // Yesterday's entries
    {
      id: generateId('entry-yesterday-1'),
      project_id: generateId('project-mobile-app'),
      start_time: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 3 * 60 * 60, // 3 hours
      notes: 'User authentication flow and state management',
      is_manual: false,
      is_running: false,
      created_at: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-yesterday-2'),
      project_id: generateId('project-website-redesign'),
      start_time: new Date(yesterday.getTime() + 13 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(yesterday.getTime() + 16.5 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 3.5 * 60 * 60, // 3.5 hours
      notes: 'Responsive layouts for tablet and mobile',
      is_manual: false,
      is_running: false,
      created_at: new Date(yesterday.getTime() + 13 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(yesterday.getTime() + 16.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('entry-yesterday-3'),
      project_id: generateId('project-branding'),
      start_time: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 2 * 60 * 60, // 2 hours
      notes: 'Logo concepts and color palette exploration',
      is_manual: false,
      is_running: false,
      created_at: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

export const mockTimeEntries: TimeEntry[] = generateTimeEntries()

// In-memory store for demo mode (allows CRUD operations to persist during session)
export class MockDataStore {
  private clients: Map<string, Client>
  private projects: Map<string, Project>
  private timeEntries: Map<string, TimeEntry>

  constructor() {
    this.clients = new Map(mockClients.map(c => [c.id, { ...c }]))
    this.projects = new Map(mockProjects.map(p => [p.id, { ...p }]))
    this.timeEntries = new Map(mockTimeEntries.map(e => [e.id, { ...e }]))
  }

  // Clients
  getClients(): Client[] {
    return Array.from(this.clients.values())
  }

  getClient(id: string): Client | undefined {
    return this.clients.get(id)
  }

  addClient(client: Client): Client {
    this.clients.set(client.id, client)
    return client
  }

  updateClient(id: string, updates: Partial<Client>): Client | undefined {
    const client = this.clients.get(id)
    if (!client) return undefined
    const updated = { ...client, ...updates, updated_at: new Date().toISOString() }
    this.clients.set(id, updated)
    return updated
  }

  deleteClient(id: string): boolean {
    return this.clients.delete(id)
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

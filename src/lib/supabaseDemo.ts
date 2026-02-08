/**
 * Demo Supabase Client
 * Mimics the Supabase client API but uses in-memory mock data
 * Provides a realistic demo experience without requiring a database
 */

import { getMockDataStore } from './mockData'
import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type TableName = keyof Tables
type Row<T extends TableName> = Tables[T]['Row']
type Insert<T extends TableName> = Tables[T]['Insert']
type Update<T extends TableName> = Tables[T]['Update']

// Mock PostgrestError
interface MockPostgrestError {
  message: string
  details: string
  hint: string
  code: string
}

// Mock response types matching Supabase
interface MockResponse<T> {
  data: T | null
  error: MockPostgrestError | null
  count?: number | null
  status: number
  statusText: string
}

// Query builder interface
interface QueryBuilder<T> {
  select(columns?: string): QueryBuilder<T>
  insert(values: Partial<T> | Partial<T>[]): QueryBuilder<T>
  update(values: Partial<T>): QueryBuilder<T>
  delete(): QueryBuilder<T>
  eq(column: string, value: unknown): QueryBuilder<T>
  neq(column: string, value: unknown): QueryBuilder<T>
  gte(column: string, value: unknown): QueryBuilder<T>
  lte(column: string, value: unknown): QueryBuilder<T>
  gt(column: string, value: unknown): QueryBuilder<T>
  lt(column: string, value: unknown): QueryBuilder<T>
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>
  limit(count: number): QueryBuilder<T>
  single(): Promise<{ data: T | null; error: MockPostgrestError | null }>
  then(onfulfilled?: (value: { data: T[] | null; error: MockPostgrestError | null; count?: number | null }) => unknown): Promise<unknown>
}

class MockQueryBuilder<T extends Row<TableName>> implements QueryBuilder<T> {
  private tableName: TableName
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private selectColumns: string = '*'
  private filters: Array<(item: T) => boolean> = []
  private orderBy: { column: string; ascending: boolean } | null = null
  private limitCount: number | null = null
  private insertValues: Partial<T> | Partial<T>[] | null = null
  private updateValues: Partial<T> | null = null
  private singleResult: boolean = false

  constructor(tableName: TableName) {
    this.tableName = tableName
  }

  select(columns: string = '*'): QueryBuilder<T> {
    this.operation = 'select'
    this.selectColumns = columns
    return this
  }

  insert(values: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    this.operation = 'insert'
    this.insertValues = values
    return this
  }

  update(values: Partial<T>): QueryBuilder<T> {
    this.operation = 'update'
    this.updateValues = values
    return this
  }

  delete(): QueryBuilder<T> {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: unknown): QueryBuilder<T> {
    this.filters.push((item: T) => (item as Record<string, unknown>)[column] === value)
    return this
  }

  neq(column: string, value: unknown): QueryBuilder<T> {
    this.filters.push((item: T) => (item as Record<string, unknown>)[column] !== value)
    return this
  }

  gte(column: string, value: unknown): QueryBuilder<T> {
    this.filters.push((item: T) => {
      const itemValue = (item as Record<string, unknown>)[column]
      return itemValue !== undefined && itemValue !== null && itemValue >= (value as any)
    })
    return this
  }

  lte(column: string, value: unknown): QueryBuilder<T> {
    this.filters.push((item: T) => {
      const itemValue = (item as Record<string, unknown>)[column]
      return itemValue !== undefined && itemValue !== null && itemValue <= (value as any)
    })
    return this
  }

  gt(column: string, value: unknown): QueryBuilder<T> {
    this.filters.push((item: T) => {
      const itemValue = (item as Record<string, unknown>)[column]
      return itemValue !== undefined && itemValue !== null && itemValue > (value as any)
    })
    return this
  }

  lt(column: string, value: unknown): QueryBuilder<T> {
    this.filters.push((item: T) => {
      const itemValue = (item as Record<string, unknown>)[column]
      return itemValue !== undefined && itemValue !== null && itemValue < (value as any)
    })
    return this
  }

  order(column: string, options: { ascending?: boolean } = {}): QueryBuilder<T> {
    this.orderBy = { column, ascending: options.ascending ?? true }
    return this
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count
    return this
  }

  single(): Promise<{ data: T | null; error: MockPostgrestError | null }> {
    this.singleResult = true
    return this.execute().then(result => {
      if (result.error) {
        return { data: null, error: result.error }
      }
      if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
        return {
          data: null,
          error: {
            message: 'No rows found',
            details: '',
            hint: '',
            code: 'PGRST116',
          },
        }
      }
      const data = Array.isArray(result.data) ? result.data[0] : result.data
      return { data: data as T, error: null }
    })
  }

  then(
    onfulfilled?: (value: { data: T[] | null; error: MockPostgrestError | null; count?: number | null }) => unknown
  ): Promise<unknown> {
    return this.execute().then((result) => {
      // Normalize result to always return arrays for the then handler
      const normalizedResult = {
        ...result,
        data: Array.isArray(result.data) ? result.data : (result.data ? [result.data] : null),
      }
      return onfulfilled ? onfulfilled(normalizedResult as any) : normalizedResult
    })
  }

  private async execute(): Promise<{ data: T[] | T | null; error: MockPostgrestError | null; count?: number | null }> {
    const store = getMockDataStore()

    try {
      // Handle INSERT
      if (this.operation === 'insert') {
        const values = Array.isArray(this.insertValues) ? this.insertValues : [this.insertValues]
        const inserted: T[] = []

        for (const value of values) {
          if (!value) continue

          const id = store.generateNewId(this.tableName)
          const timestamp = new Date().toISOString()
          const newItem = {
            id,
            ...value,
            created_at: timestamp,
            updated_at: timestamp,
          } as T

          if (this.tableName === 'clients') {
            store.addClient(newItem as Tables['clients']['Row'])
          } else if (this.tableName === 'projects') {
            store.addProject(newItem as Tables['projects']['Row'])
          } else if (this.tableName === 'time_entries') {
            store.addTimeEntry(newItem as Tables['time_entries']['Row'])
          }

          inserted.push(newItem)
        }

        return { data: this.singleResult ? inserted[0] : inserted, error: null }
      }

      // Get base data
      let data: T[] = []
      if (this.tableName === 'clients') {
        data = store.getClients() as T[]
      } else if (this.tableName === 'projects') {
        data = store.getProjects() as T[]
      } else if (this.tableName === 'time_entries') {
        data = store.getTimeEntries() as T[]
      }

      // Apply filters
      let filtered = data.filter(item => this.filters.every(filter => filter(item)))

      // Handle UPDATE
      if (this.operation === 'update' && this.updateValues) {
        const updated: T[] = []
        for (const item of filtered) {
          const id = (item as Record<string, unknown>).id as string
          let updatedItem: T | undefined

          if (this.tableName === 'clients') {
            updatedItem = store.updateClient(id, this.updateValues as Partial<Tables['clients']['Row']>) as T | undefined
          } else if (this.tableName === 'projects') {
            updatedItem = store.updateProject(id, this.updateValues as Partial<Tables['projects']['Row']>) as T | undefined
          } else if (this.tableName === 'time_entries') {
            updatedItem = store.updateTimeEntry(id, this.updateValues as Partial<Tables['time_entries']['Row']>) as T | undefined
          }

          if (updatedItem) updated.push(updatedItem)
        }
        return { data: this.singleResult ? updated[0] : updated, error: null }
      }

      // Handle DELETE
      if (this.operation === 'delete') {
        for (const item of filtered) {
          const id = (item as Record<string, unknown>).id as string
          if (this.tableName === 'clients') {
            store.deleteClient(id)
          } else if (this.tableName === 'projects') {
            store.deleteProject(id)
          } else if (this.tableName === 'time_entries') {
            store.deleteTimeEntry(id)
          }
        }
        return { data: null, error: null }
      }

      // Handle SELECT with joins (simplified - just handle the patterns we use)
      if (this.selectColumns.includes('projects') && this.tableName === 'time_entries') {
        // Join time_entries with projects and clients
        const entries = filtered as Tables['time_entries']['Row'][]
        const enriched = entries.map(entry => {
          const project = store.getProject(entry.project_id)
          if (!project) return null
          const client = store.getClient(project.client_id)
          return {
            ...entry,
            projects: {
              ...project,
              clients: client || null,
            },
          }
        }).filter(Boolean)
        filtered = enriched as unknown as T[]
      } else if (this.selectColumns.includes('clients') && this.tableName === 'projects') {
        // Join projects with clients
        const projects = filtered as Tables['projects']['Row'][]
        const enriched = projects.map(project => {
          const client = store.getClient(project.client_id)
          return {
            ...project,
            clients: client || null,
          }
        })
        filtered = enriched as unknown as T[]
      }

      // Apply ordering
      if (this.orderBy) {
        const { column, ascending } = this.orderBy
        filtered.sort((a, b) => {
          const aVal = (a as Record<string, any>)[column]
          const bVal = (b as Record<string, any>)[column]
          if (aVal < bVal) return ascending ? -1 : 1
          if (aVal > bVal) return ascending ? 1 : -1
          return 0
        })
      }

      // Apply limit
      if (this.limitCount !== null) {
        filtered = filtered.slice(0, this.limitCount)
      }

      const count = filtered.length

      return { data: filtered, error: null, count }
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : 'Unknown error',
          details: '',
          hint: '',
          code: 'DEMO_ERROR',
        },
      }
    }
  }
}

// Demo Supabase Client
export class DemoSupabaseClient {
  from<T extends TableName>(table: T): QueryBuilder<Row<T>> {
    return new MockQueryBuilder<Row<T>>(table)
  }
}

// Export singleton instance
let demoClientInstance: DemoSupabaseClient | null = null

export function getDemoSupabaseClient(): DemoSupabaseClient {
  if (!demoClientInstance) {
    demoClientInstance = new DemoSupabaseClient()
  }
  return demoClientInstance
}

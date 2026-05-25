export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          name: string
          hourly_rate: number
          color: string | null
          status: 'active' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          hourly_rate?: number
          color?: string | null
          status?: 'active' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          hourly_rate?: number
          color?: string | null
          status?: 'active' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trails: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          kind: 'client' | 'employer' | 'personal' | 'project'
          is_billable: boolean
          color: string | null
          status: 'active' | 'archived'
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          kind: 'client' | 'employer' | 'personal' | 'project'
          is_billable?: boolean
          color?: string | null
          status?: 'active' | 'archived'
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          kind?: 'client' | 'employer' | 'personal' | 'project'
          is_billable?: boolean
          color?: string | null
          status?: 'active' | 'archived'
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          trail_id: string
          name: string
          description: string | null
          status: 'active' | 'completed' | 'archived'
          phases: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trail_id: string
          name: string
          description?: string | null
          status?: 'active' | 'completed' | 'archived'
          phases?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trail_id?: string
          name?: string
          description?: string | null
          status?: 'active' | 'completed' | 'archived'
          phases?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_trail_id_fkey'
            columns: ['trail_id']
            referencedRelation: 'trails'
            referencedColumns: ['id']
          }
        ]
      }
      rates: {
        Row: {
          id: string
          trail_id: string
          project_id: string | null
          hourly_rate: number
          effective_from: string
          effective_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trail_id: string
          project_id?: string | null
          hourly_rate: number
          effective_from: string
          effective_until?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          trail_id?: string
          project_id?: string | null
          hourly_rate?: number
          effective_from?: string
          effective_until?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rates_trail_id_fkey'
            columns: ['trail_id']
            referencedRelation: 'trails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rates_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      observations: {
        Row: {
          id: string
          created_at: string
          source: string
          content: string
          related_trail_id: string | null
          related_project_id: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          created_at?: string
          source: string
          content: string
          related_trail_id?: string | null
          related_project_id?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          created_at?: string
          source?: string
          content?: string
          related_trail_id?: string | null
          related_project_id?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'observations_related_trail_id_fkey'
            columns: ['related_trail_id']
            referencedRelation: 'trails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'observations_related_project_id_fkey'
            columns: ['related_project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      open_loops: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          project_id: string
          title: string
          notes: string | null
          status: 'open' | 'completed' | 'abandoned'
          order: number
          parsed_tags: Json
          completed_at: string | null
          abandoned_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          title: string
          notes?: string | null
          status?: 'open' | 'completed' | 'abandoned'
          order?: number
          parsed_tags?: Json
          completed_at?: string | null
          abandoned_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          project_id?: string
          title?: string
          notes?: string | null
          status?: 'open' | 'completed' | 'abandoned'
          order?: number
          parsed_tags?: Json
          completed_at?: string | null
          abandoned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'open_loops_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      journal_entries: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          entry_date: string
          content: string
          parsed_tags: Json
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          entry_date: string
          content: string
          parsed_tags?: Json
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          entry_date?: string
          content?: string
          parsed_tags?: Json
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          id: string
          project_id: string
          start_time: string
          end_time: string | null
          duration_seconds: number | null
          notes: string | null
          is_manual: boolean
          is_running: boolean
          source: string
          source_observation_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          start_time: string
          end_time?: string | null
          duration_seconds?: number | null
          notes?: string | null
          is_manual?: boolean
          is_running?: boolean
          source?: string
          source_observation_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          start_time?: string
          end_time?: string | null
          duration_seconds?: number | null
          notes?: string | null
          is_manual?: boolean
          is_running?: boolean
          source?: string
          source_observation_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'time_entries_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Trail = Database['public']['Tables']['trails']['Row']
export type TrailInsert = Database['public']['Tables']['trails']['Insert']
export type TrailUpdate = Database['public']['Tables']['trails']['Update']

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export type Observation = Database['public']['Tables']['observations']['Row']
export type ObservationInsert = Database['public']['Tables']['observations']['Insert']
export type ObservationUpdate = Database['public']['Tables']['observations']['Update']

export type OpenLoop = Database['public']['Tables']['open_loops']['Row']
export type OpenLoopInsert = Database['public']['Tables']['open_loops']['Insert']
export type OpenLoopUpdate = Database['public']['Tables']['open_loops']['Update']

export type JournalEntry = Database['public']['Tables']['journal_entries']['Row']
export type JournalEntryInsert = Database['public']['Tables']['journal_entries']['Insert']
export type JournalEntryUpdate = Database['public']['Tables']['journal_entries']['Update']

export type Rate = Database['public']['Tables']['rates']['Row']
export type RateInsert = Database['public']['Tables']['rates']['Insert']
export type RateUpdate = Database['public']['Tables']['rates']['Update']

export type TimeEntry = Database['public']['Tables']['time_entries']['Row']
export type TimeEntryInsert = Database['public']['Tables']['time_entries']['Insert']
export type TimeEntryUpdate = Database['public']['Tables']['time_entries']['Update']

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']

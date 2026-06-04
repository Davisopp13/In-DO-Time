import type { JournalEntry, Observation, Project, ReleaseDocument, Trail } from '@/types/database'

export type ReleaseMode = 'internal' | 'client'

export type ReleaseProject = Pick<Project, 'id' | 'trail_id' | 'name' | 'description' | 'status'>
export type ReleaseTrail = Pick<Trail, 'id' | 'name' | 'slug' | 'kind' | 'description' | 'color'>

export interface ReleaseInputs {
  mode: ReleaseMode
  trail: ReleaseTrail
  projects: ReleaseProject[]
  observations: Observation[]
  journalEntries: JournalEntry[]
  startDate: string
  endDate: string
}

export interface ReleaseSection {
  heading: string
  bullets: string[]
}

export interface ReleaseStructuredOutput {
  sections: ReleaseSection[]
}

export interface SynthesizedRelease {
  title: string
  markdown: string
  structuredOutput: ReleaseStructuredOutput & {
    fallback?: boolean
    fallbackReason?: string
    model?: string
  }
  fallback: boolean
  fallbackReason?: string
}

export type ReleaseDocumentWithTrail = ReleaseDocument & {
  trail?: Pick<Trail, 'name' | 'color' | 'kind'> | null
}

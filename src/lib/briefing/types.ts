import type { JournalEntry, Observation, OpenLoop, Project, Trail } from '@/types/database'

export type ProjectWithTrail = Project & { trail?: Pick<Trail, 'name' | 'color'> }
export type LoopWithProject = OpenLoop & { project?: ProjectWithTrail }

export interface BriefingInputs {
  observations: Observation[]
  journalEntries: JournalEntry[]
  openLoops: LoopWithProject[]
}

export interface TopProject {
  name: string
  count: number
  color?: string | null
}

export interface ObservationItem {
  id: string
  created_at: string
  source: string
  content: string
}

export interface OpenLoopItem {
  id: string
  title: string
  projectName: string
}

export interface LatestReflection {
  entry_date: string
  content: string
}

export interface BriefingData {
  observationCount: number
  openLoopCount: number
  journalEntryCount: number
  topProjects: TopProject[]
  latestReflection: LatestReflection | null
  recentObservations: ObservationItem[]
  openLoopItems: OpenLoopItem[]
}

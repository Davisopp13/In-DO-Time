import type { BriefingData, BriefingInputs } from './types'

export function synthesizeBriefing(inputs: BriefingInputs): BriefingData {
  const { observations, journalEntries, openLoops } = inputs

  const counts = new Map<string, { name: string; count: number; color?: string | null }>()
  for (const loop of openLoops) {
    const key = loop.project_id
    const current = counts.get(key) ?? {
      name: loop.project?.name ?? 'Unknown project',
      count: 0,
      color: loop.project?.trail?.color,
    }
    current.count += 1
    counts.set(key, current)
  }
  const topProjects = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  const latestJournal = journalEntries[0]
  const latestReflection = latestJournal
    ? { entry_date: latestJournal.entry_date, content: latestJournal.content }
    : null

  const recentObservations = observations.slice(0, 6).map((obs) => ({
    id: obs.id,
    created_at: obs.created_at,
    source: obs.source,
    content: obs.content,
  }))

  const openLoopItems = openLoops.slice(0, 8).map((loop) => ({
    id: loop.id,
    title: loop.title,
    projectName: loop.project?.name ?? 'Unknown project',
  }))

  return {
    observationCount: observations.length,
    openLoopCount: openLoops.length,
    journalEntryCount: journalEntries.length,
    topProjects,
    latestReflection,
    recentObservations,
    openLoopItems,
  }
}

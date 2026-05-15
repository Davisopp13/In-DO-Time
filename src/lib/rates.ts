import { getSupabase } from './supabase'
import type { Rate, TimeEntry } from '@/types/database'

export async function getEffectiveRate(
  trailId: string,
  projectId: string | null,
  atDate: Date
): Promise<number | null> {
  const supabase = getSupabase()
  const dateStr = atDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('rates')
    .select('*')
    .eq('trail_id', trailId)
    .lte('effective_from', dateStr)

  if (error || !data || data.length === 0) return null

  const activeRates = (data as Rate[]).filter(
    (r) => r.effective_until === null || r.effective_until >= dateStr
  )

  if (activeRates.length === 0) return null

  if (projectId) {
    const projectRates = activeRates
      .filter((r) => r.project_id === projectId)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
    if (projectRates.length > 0) return Number(projectRates[0].hourly_rate)
  }

  const trailRates = activeRates
    .filter((r) => r.project_id === null)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))

  if (trailRates.length > 0) return Number(trailRates[0].hourly_rate)

  return null
}

export async function computeEntryCost(entry: TimeEntry, trailId: string): Promise<number> {
  const rate = await getEffectiveRate(trailId, entry.project_id, new Date(entry.start_time))
  if (!rate || !entry.duration_seconds) return 0
  return (entry.duration_seconds / 3600) * rate
}

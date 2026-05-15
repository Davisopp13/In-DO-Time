import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Rate, TimeEntry } from '../types/database'

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(),
}))

import { getEffectiveRate, computeEntryCost } from '../lib/rates'
import { getSupabase } from '../lib/supabase'

const mockGetSupabase = vi.mocked(getSupabase)

function makeSupabaseMock(rateData: Partial<Rate>[]) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    then(resolve: (result: { data: Partial<Rate>[]; error: null }) => unknown) {
      return Promise.resolve({ data: rateData, error: null }).then(resolve)
    },
  }
  return { from: vi.fn().mockReturnValue(builder) }
}

function makeErrorMock() {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    then(resolve: (result: { data: null; error: Error }) => unknown) {
      return Promise.resolve({ data: null, error: new Error('db error') }).then(resolve)
    },
  }
  return { from: vi.fn().mockReturnValue(builder) }
}

const TRAIL_ID = 'trail-001'
const PROJECT_ID = 'project-001'

function makeRate(overrides: Partial<Rate>): Rate {
  return {
    id: 'rate-001',
    trail_id: TRAIL_ID,
    project_id: null,
    hourly_rate: 50,
    effective_from: '2026-01-01',
    effective_until: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: 'entry-001',
    project_id: PROJECT_ID,
    start_time: '2026-03-01T09:00:00.000Z',
    end_time: '2026-03-01T10:00:00.000Z',
    duration_seconds: 3600,
    notes: null,
    is_manual: false,
    is_running: false,
    source: 'manual',
    source_observation_id: null,
    created_at: '2026-03-01T09:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEffectiveRate', () => {
  it('returns project-level rate when both project and trail rates exist', async () => {
    const trailRate = makeRate({ id: 'rate-trail', hourly_rate: 50, project_id: null })
    const projectRate = makeRate({ id: 'rate-proj', hourly_rate: 75, project_id: PROJECT_ID })

    mockGetSupabase.mockReturnValue(makeSupabaseMock([trailRate, projectRate]))

    const result = await getEffectiveRate(TRAIL_ID, PROJECT_ID, new Date('2026-03-01'))
    expect(result).toBe(75)
  })

  it('falls back to trail-level rate when no project rate exists', async () => {
    const trailRate = makeRate({ id: 'rate-trail', hourly_rate: 50, project_id: null })

    mockGetSupabase.mockReturnValue(makeSupabaseMock([trailRate]))

    const result = await getEffectiveRate(TRAIL_ID, PROJECT_ID, new Date('2026-03-01'))
    expect(result).toBe(50)
  })

  it('returns null when no rates exist for the trail', async () => {
    mockGetSupabase.mockReturnValue(makeSupabaseMock([]))

    const result = await getEffectiveRate(TRAIL_ID, PROJECT_ID, new Date('2026-03-01'))
    expect(result).toBeNull()
  })

  it('returns null when a rate exists but effective_until has passed', async () => {
    const expiredRate = makeRate({
      hourly_rate: 50,
      effective_from: '2026-01-01',
      effective_until: '2026-01-31',
    })

    mockGetSupabase.mockReturnValue(makeSupabaseMock([expiredRate]))

    const result = await getEffectiveRate(TRAIL_ID, null, new Date('2026-03-01'))
    expect(result).toBeNull()
  })

  it('picks the most recent rate when multiple trail-level rates exist', async () => {
    const oldRate = makeRate({ id: 'rate-old', hourly_rate: 40, effective_from: '2026-01-01' })
    const newRate = makeRate({ id: 'rate-new', hourly_rate: 60, effective_from: '2026-02-01' })

    mockGetSupabase.mockReturnValue(makeSupabaseMock([oldRate, newRate]))

    const result = await getEffectiveRate(TRAIL_ID, null, new Date('2026-03-01'))
    expect(result).toBe(60)
  })

  it('respects effective_from — does not return a rate before its start date', async () => {
    // Rate effective from Feb 1; query date is Jan 15 — Supabase lte filter handles this,
    // but the mock returns whatever we give it so we simulate by returning empty
    mockGetSupabase.mockReturnValue(makeSupabaseMock([]))

    const result = await getEffectiveRate(TRAIL_ID, null, new Date('2026-01-15'))
    expect(result).toBeNull()
  })

  it('returns trail rate when projectId is null', async () => {
    const trailRate = makeRate({ hourly_rate: 55, project_id: null })

    mockGetSupabase.mockReturnValue(makeSupabaseMock([trailRate]))

    const result = await getEffectiveRate(TRAIL_ID, null, new Date('2026-03-01'))
    expect(result).toBe(55)
  })

  it('returns null on database error', async () => {
    mockGetSupabase.mockReturnValue(makeErrorMock())

    const result = await getEffectiveRate(TRAIL_ID, PROJECT_ID, new Date('2026-03-01'))
    expect(result).toBeNull()
  })

  it('rate change: returns old rate before change date, new rate after', async () => {
    const oldRate = makeRate({
      id: 'rate-old',
      hourly_rate: 40,
      effective_from: '2026-01-01',
      effective_until: '2026-01-31',
    })
    const newRate = makeRate({
      id: 'rate-new',
      hourly_rate: 60,
      effective_from: '2026-02-01',
      effective_until: null,
    })

    // Query on Jan 15 — lte filter means server only returns oldRate; simulate that
    mockGetSupabase.mockReturnValueOnce(makeSupabaseMock([oldRate]))
    const rateBefore = await getEffectiveRate(TRAIL_ID, null, new Date('2026-01-15'))
    expect(rateBefore).toBe(40)

    // Query on Mar 1 — server returns both, but oldRate is expired
    mockGetSupabase.mockReturnValueOnce(makeSupabaseMock([oldRate, newRate]))
    const rateAfter = await getEffectiveRate(TRAIL_ID, null, new Date('2026-03-01'))
    expect(rateAfter).toBe(60)
  })
})

describe('computeEntryCost', () => {
  it('computes cost for a 1-hour entry at $50/hr', async () => {
    const trailRate = makeRate({ hourly_rate: 50 })
    mockGetSupabase.mockReturnValue(makeSupabaseMock([trailRate]))

    const entry = makeEntry({ duration_seconds: 3600 })
    const cost = await computeEntryCost(entry, TRAIL_ID)
    expect(cost).toBe(50)
  })

  it('computes cost for a 1.5-hour entry at $60/hr', async () => {
    const trailRate = makeRate({ hourly_rate: 60 })
    mockGetSupabase.mockReturnValue(makeSupabaseMock([trailRate]))

    const entry = makeEntry({ duration_seconds: 5400 })
    const cost = await computeEntryCost(entry, TRAIL_ID)
    expect(cost).toBeCloseTo(90)
  })

  it('returns 0 when no rate is found', async () => {
    mockGetSupabase.mockReturnValue(makeSupabaseMock([]))

    const entry = makeEntry({ duration_seconds: 3600 })
    const cost = await computeEntryCost(entry, TRAIL_ID)
    expect(cost).toBe(0)
  })

  it('returns 0 when duration_seconds is null (running entry)', async () => {
    const trailRate = makeRate({ hourly_rate: 50 })
    mockGetSupabase.mockReturnValue(makeSupabaseMock([trailRate]))

    const entry = makeEntry({ duration_seconds: null })
    const cost = await computeEntryCost(entry, TRAIL_ID)
    expect(cost).toBe(0)
  })
})

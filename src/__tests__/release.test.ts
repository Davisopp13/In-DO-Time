import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JournalEntry, Observation, Project, Trail } from '@/types/database'

const mockMessagesCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return {
    messages: {
      create: mockMessagesCreate,
    },
    }
  }),
}))

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(),
}))

import { gatherReleaseInputs } from '../lib/release/gather'
import { buildDeterministicRelease, synthesizeRelease } from '../lib/release/synthesize'
import type { ReleaseInputs } from '../lib/release/types'

type TableData = {
  trails: Trail[]
  projects: Project[]
  observations: Observation[]
  journal_entries: JournalEntry[]
}

class MockQuery {
  private filters: Array<(item: Record<string, unknown>) => boolean> = []
  private orderBy: { column: string; ascending: boolean } | null = null
  private limitCount: number | null = null
  private singleResult = false

  constructor(private data: Record<string, unknown>[]) {}

  select() {
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value)
    return this
  }

  gte(column: string, value: unknown) {
    this.filters.push((item) => String(item[column]) >= String(value))
    return this
  }

  lte(column: string, value: unknown) {
    this.filters.push((item) => String(item[column]) <= String(value))
    return this
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending ?? true }
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.singleResult = true
    return Promise.resolve(this.executeSingle())
  }

  then(resolve: (value: { data: Record<string, unknown>[] | null; error: null }) => unknown) {
    return Promise.resolve(this.execute()).then(resolve)
  }

  private execute() {
    let data = this.data.filter((item) => this.filters.every((filter) => filter(item)))
    if (this.orderBy) {
      const { column, ascending } = this.orderBy
      data = [...data].sort((a, b) => {
        const aValue = String(a[column] ?? '')
        const bValue = String(b[column] ?? '')
        return ascending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      })
    }
    if (this.limitCount !== null) data = data.slice(0, this.limitCount)
    return { data, error: null }
  }

  private executeSingle() {
    const result = this.execute()
    return { data: result.data[0] ?? null, error: result.data[0] ? null : { message: 'not found' } }
  }
}

function makeSupabase(data: TableData) {
  return {
    from(table: keyof TableData) {
      return new MockQuery(data[table] as unknown as Record<string, unknown>[])
    },
  }
}

const TRAIL_ID = '11111111-1111-4111-a111-111111111111'
const CLIENT_TRAIL_ID = '22222222-2222-4222-a222-222222222222'
const PROJECT_ID = '33333333-3333-4333-a333-333333333333'

function makeTrail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: TRAIL_ID,
    name: 'In DO Time',
    slug: 'in-do-time',
    description: null,
    kind: 'project',
    is_billable: false,
    color: '#1B5E20',
    status: 'active',
    display_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    trail_id: TRAIL_ID,
    name: 'Foundation',
    description: null,
    status: 'active',
    phases: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeObservation(overrides: Partial<Observation>): Observation {
  return {
    id: '44444444-4444-4444-a444-444444444444',
    created_at: '2026-05-20T12:00:00.000Z',
    source: 'agent',
    content: 'Refactored release gathering around trails.',
    related_trail_id: TRAIL_ID,
    related_project_id: null,
    metadata: {},
    ...overrides,
  }
}

function makeJournalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: '55555555-5555-4555-a555-555555555555',
    created_at: '2026-05-20T12:00:00.000Z',
    updated_at: '2026-05-20T12:00:00.000Z',
    entry_date: '2026-05-20',
    content: 'Release docs started to feel useful.',
    parsed_tags: {},
    ...overrides,
  }
}

function makeReleaseInputs(overrides: Partial<ReleaseInputs> = {}): ReleaseInputs {
  return {
    mode: 'internal',
    trail: {
      id: TRAIL_ID,
      name: 'In DO Time',
      slug: 'in-do-time',
      kind: 'project',
      description: null,
      color: '#1B5E20',
    },
    projects: [makeProject()],
    observations: [makeObservation({})],
    journalEntries: [makeJournalEntry()],
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    ...overrides,
  }
}

beforeEach(() => {
  vi.unstubAllEnvs()
  mockMessagesCreate.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('gatherReleaseInputs', () => {
  it('filters observations by date and selected trail/project scope', async () => {
    const supabase = makeSupabase({
      trails: [makeTrail()],
      projects: [makeProject()],
      observations: [
        makeObservation({ id: 'trail-observation', related_trail_id: TRAIL_ID, related_project_id: null }),
        makeObservation({ id: 'project-observation', related_trail_id: null, related_project_id: PROJECT_ID }),
        makeObservation({ id: 'other-observation', related_trail_id: CLIENT_TRAIL_ID, related_project_id: null }),
        makeObservation({ id: 'old-observation', created_at: '2026-04-01T12:00:00.000Z' }),
      ],
      journal_entries: [makeJournalEntry(), makeJournalEntry({ id: 'old-journal', entry_date: '2026-04-01' })],
    })

    const inputs = await gatherReleaseInputs({
      mode: 'internal',
      trailId: TRAIL_ID,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }, supabase)

    expect(inputs.observations.map((observation) => observation.id)).toEqual(['trail-observation', 'project-observation'])
    expect(inputs.journalEntries).toHaveLength(0)
    expect(inputs.projects).toHaveLength(1)
  })

  it('uses relevant unscoped internal observations by text match', async () => {
    const supabase = makeSupabase({
      trails: [makeTrail()],
      projects: [],
      observations: [
        makeObservation({
          id: 'unscoped-match',
          related_trail_id: null,
          related_project_id: null,
          content: 'In DO Time release document generator now uses observations.',
        }),
        makeObservation({
          id: 'unscoped-other',
          related_trail_id: null,
          related_project_id: null,
          content: 'Meridian dashboard work shipped.',
        }),
      ],
      journal_entries: [
        makeJournalEntry({ id: 'journal-match', content: 'In DO Time release review.' }),
        makeJournalEntry({ id: 'journal-other', content: 'Meridian dashboard notes.' }),
      ],
    })

    const inputs = await gatherReleaseInputs({
      mode: 'internal',
      trailId: TRAIL_ID,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }, supabase)

    expect(inputs.observations.map((observation) => observation.id)).toEqual(['unscoped-match'])
    expect(inputs.journalEntries.map((entry) => entry.id)).toEqual(['journal-match'])
  })

  it('allows client mode only for client trails', async () => {
    const supabase = makeSupabase({
      trails: [makeTrail()],
      projects: [],
      observations: [],
      journal_entries: [],
    })

    await expect(gatherReleaseInputs({
      mode: 'client',
      trailId: TRAIL_ID,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }, supabase)).rejects.toThrow('Client release documents')
  })

  it('allows client mode for client trails', async () => {
    const supabase = makeSupabase({
      trails: [makeTrail({ id: CLIENT_TRAIL_ID, name: 'B.B.', slug: 'bb', kind: 'client', is_billable: true })],
      projects: [],
      observations: [],
      journal_entries: [],
    })

    const inputs = await gatherReleaseInputs({
      mode: 'client',
      trailId: CLIENT_TRAIL_ID,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }, supabase)

    expect(inputs.trail.kind).toBe('client')
  })
})

describe('release synthesis', () => {
  it('builds deterministic fallback markdown without inventing bullets', () => {
    const release = buildDeterministicRelease(makeReleaseInputs({
      observations: [],
      journalEntries: [],
    }))

    expect(release.fallback).toBe(true)
    expect(release.markdown).toContain('No release-worthy observations')
    expect(release.structuredOutput.sections).toEqual([])
  })

  it('falls back when Anthropic is not configured', async () => {
    const release = await synthesizeRelease(makeReleaseInputs())

    expect(release.fallback).toBe(true)
    expect(release.fallbackReason).toContain('ANTHROPIC_API_KEY')
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('renders structured Anthropic output when configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('ANTHROPIC_MODEL', 'test-model')
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sections: [
              {
                heading: 'Shipped',
                bullets: ['Improved release document synthesis.'],
              },
            ],
          }),
        },
      ],
    })

    const release = await synthesizeRelease(makeReleaseInputs())

    expect(release.fallback).toBe(false)
    expect(release.markdown).toContain('## Shipped')
    expect(release.markdown).toContain('- Improved release document synthesis.')
    expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'test-model',
      output_config: expect.any(Object),
    }))
  })

  it('falls back when Anthropic fails', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    mockMessagesCreate.mockRejectedValue(new Error('api down'))

    const release = await synthesizeRelease(makeReleaseInputs())

    expect(release.fallback).toBe(true)
    expect(release.fallbackReason).toBe('api down')
  })
})

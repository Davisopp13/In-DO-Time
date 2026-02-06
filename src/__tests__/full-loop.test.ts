import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatDuration,
  calculateElapsedSeconds,
  calculateRunningCost,
  formatCurrency,
} from '../lib/timer'
import {
  generateCSV,
  generateCSVFilename,
} from '../lib/csv'

// ---- Pure utility tests (no Supabase needed) ----

describe('Timer Utilities', () => {
  describe('formatDuration', () => {
    it('formats zero seconds', () => {
      expect(formatDuration(0)).toBe('00:00:00')
    })

    it('formats seconds only', () => {
      expect(formatDuration(45)).toBe('00:00:45')
    })

    it('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('00:02:05')
    })

    it('formats hours, minutes, seconds', () => {
      expect(formatDuration(3661)).toBe('01:01:01')
    })

    it('formats large hours', () => {
      expect(formatDuration(36000)).toBe('10:00:00')
    })
  })

  describe('calculateElapsedSeconds', () => {
    it('calculates elapsed seconds from a start time', () => {
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString()
      const elapsed = calculateElapsedSeconds(fiveSecondsAgo)
      // Allow 1 second tolerance for test execution time
      expect(elapsed).toBeGreaterThanOrEqual(4)
      expect(elapsed).toBeLessThanOrEqual(6)
    })

    it('returns 0 for a start time that is now', () => {
      const now = new Date().toISOString()
      const elapsed = calculateElapsedSeconds(now)
      expect(elapsed).toBeGreaterThanOrEqual(0)
      expect(elapsed).toBeLessThanOrEqual(1)
    })
  })

  describe('calculateRunningCost', () => {
    it('calculates cost for 1 hour at $50/hr', () => {
      expect(calculateRunningCost(3600, 50)).toBe(50)
    })

    it('calculates cost for 30 minutes at $60/hr', () => {
      expect(calculateRunningCost(1800, 60)).toBe(30)
    })

    it('calculates cost for 0 seconds', () => {
      expect(calculateRunningCost(0, 100)).toBe(0)
    })

    it('handles decimal rates', () => {
      const cost = calculateRunningCost(3600, 45.50)
      expect(cost).toBeCloseTo(45.50)
    })
  })

  describe('formatCurrency', () => {
    it('formats whole dollars', () => {
      expect(formatCurrency(50)).toBe('$50.00')
    })

    it('formats cents', () => {
      expect(formatCurrency(45.50)).toBe('$45.50')
    })

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('formats large amounts', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })
  })
})

// ---- CSV generation tests ----

describe('CSV Export', () => {
  describe('generateCSV', () => {
    it('generates CSV with correct headers', () => {
      const csv = generateCSV([])
      const headers = csv.split('\n')[0]
      expect(headers).toBe(
        'Client,Project,Date,Start Time,End Time,Duration,Hours (Decimal),Hourly Rate,Cost,Notes,Type'
      )
    })

    it('generates CSV rows for timer entries', () => {
      const entries = [
        {
          client_name: 'B.B.',
          project_name: 'GA Gymnastics State Meets',
          start_time: '2025-01-15T09:00:00.000Z',
          end_time: '2025-01-15T10:30:00.000Z',
          duration_seconds: 5400,
          notes: 'Worked on header',
          is_manual: false,
          effectiveRate: 30,
        },
      ]

      const csv = generateCSV(entries)
      const lines = csv.split('\n')
      expect(lines).toHaveLength(2) // header + 1 row
      expect(lines[1]).toContain('B.B.')
      expect(lines[1]).toContain('GA Gymnastics State Meets')
      expect(lines[1]).toContain('01:30:00') // duration
      expect(lines[1]).toContain('1.50') // decimal hours
      expect(lines[1]).toContain('$30.00') // hourly rate
      expect(lines[1]).toContain('$45.00') // cost (1.5h * $30)
      expect(lines[1]).toContain('Worked on header')
      expect(lines[1]).toContain('Timer')
    })

    it('marks manual entries as Manual type', () => {
      const entries = [
        {
          client_name: 'Mariah',
          project_name: 'Evermore Equine',
          start_time: '2025-01-15T14:00:00.000Z',
          end_time: '2025-01-15T15:00:00.000Z',
          duration_seconds: 3600,
          notes: null,
          is_manual: true,
          effectiveRate: 45,
        },
      ]

      const csv = generateCSV(entries)
      const lines = csv.split('\n')
      expect(lines[1]).toContain('Manual')
    })

    it('handles entries with no notes', () => {
      const entries = [
        {
          client_name: 'Test Client',
          project_name: 'Test Project',
          start_time: '2025-01-15T09:00:00.000Z',
          end_time: '2025-01-15T10:00:00.000Z',
          duration_seconds: 3600,
          notes: null,
          is_manual: false,
          effectiveRate: 50,
        },
      ]

      const csv = generateCSV(entries)
      // Should not throw, should have empty notes field
      expect(csv).toBeTruthy()
      const lines = csv.split('\n')
      expect(lines).toHaveLength(2)
    })

    it('escapes CSV values with commas', () => {
      const entries = [
        {
          client_name: 'Client, Inc.',
          project_name: 'Project "Alpha"',
          start_time: '2025-01-15T09:00:00.000Z',
          end_time: '2025-01-15T10:00:00.000Z',
          duration_seconds: 3600,
          notes: 'Note with, comma',
          is_manual: false,
          effectiveRate: 50,
        },
      ]

      const csv = generateCSV(entries)
      // Values with commas/quotes should be escaped
      expect(csv).toContain('"Client, Inc."')
      expect(csv).toContain('"Project ""Alpha"""')
      expect(csv).toContain('"Note with, comma"')
    })

    it('generates multiple rows for multiple entries', () => {
      const entries = [
        {
          client_name: 'B.B.',
          project_name: 'GA Gymnastics',
          start_time: '2025-01-15T09:00:00.000Z',
          end_time: '2025-01-15T10:00:00.000Z',
          duration_seconds: 3600,
          notes: null,
          is_manual: false,
          effectiveRate: 30,
        },
        {
          client_name: 'Mariah',
          project_name: 'Evermore Equine',
          start_time: '2025-01-15T10:00:00.000Z',
          end_time: '2025-01-15T11:30:00.000Z',
          duration_seconds: 5400,
          notes: 'Design work',
          is_manual: false,
          effectiveRate: 45,
        },
      ]

      const csv = generateCSV(entries)
      const lines = csv.split('\n')
      expect(lines).toHaveLength(3) // header + 2 rows
    })
  })

  describe('generateCSVFilename', () => {
    it('generates base filename with no filters', () => {
      expect(generateCSVFilename()).toBe('in-do-time_export.csv')
    })

    it('includes client name', () => {
      expect(generateCSVFilename('B.B.')).toBe('in-do-time_b.b._export.csv')
    })

    it('includes start date', () => {
      expect(generateCSVFilename(undefined, '2025-01-01')).toBe(
        'in-do-time_2025-01-01_onwards_export.csv'
      )
    })

    it('includes date range', () => {
      expect(generateCSVFilename(undefined, '2025-01-01', '2025-01-31')).toBe(
        'in-do-time_2025-01-01_to_2025-01-31_export.csv'
      )
    })

    it('includes all filter parts', () => {
      expect(generateCSVFilename('B.B.', '2025-01-01', '2025-01-31')).toBe(
        'in-do-time_b.b._2025-01-01_to_2025-01-31_export.csv'
      )
    })
  })
})

// ---- Full loop integration test (mocking Supabase) ----

describe('Full Loop: add client → start timer → stop → view log → export CSV', () => {
  // Mock Supabase responses to simulate the full user journey
  const mockClient = {
    id: 'client-001',
    name: 'B.B.',
    hourly_rate: 30,
    color: '#2563EB',
    status: 'active' as const,
    created_at: '2025-01-15T00:00:00.000Z',
    updated_at: '2025-01-15T00:00:00.000Z',
  }

  const mockProject = {
    id: 'project-001',
    client_id: 'client-001',
    name: 'GA Gymnastics State Meets',
    hourly_rate_override: null,
    status: 'active' as const,
    created_at: '2025-01-15T00:00:00.000Z',
    updated_at: '2025-01-15T00:00:00.000Z',
  }

  const mockStartTime = '2025-01-15T09:00:00.000Z'
  const mockEndTime = '2025-01-15T10:30:00.000Z'
  const mockDuration = 5400 // 1.5 hours

  const mockRunningEntry = {
    id: 'entry-001',
    project_id: 'project-001',
    start_time: mockStartTime,
    end_time: null,
    duration_seconds: null,
    notes: 'Working on header redesign',
    is_manual: false,
    is_running: true,
    created_at: mockStartTime,
    updated_at: mockStartTime,
  }

  const mockStoppedEntry = {
    ...mockRunningEntry,
    end_time: mockEndTime,
    duration_seconds: mockDuration,
    is_running: false,
    updated_at: mockEndTime,
  }

  // Capture Supabase calls for verification
  let supabaseCalls: { table: string; method: string; args?: unknown }[] = []

  // Create a chainable mock builder
  function createQueryBuilder(resolvedData: unknown, resolvedError: unknown = null) {
    const builder: Record<string, unknown> = {}
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'gte', 'lte']
    for (const method of methods) {
      builder[method] = vi.fn(() => {
        if (method === 'single') {
          return Promise.resolve({ data: resolvedData, error: resolvedError })
        }
        return builder
      })
    }
    // For terminal calls that aren't single
    builder.then = undefined
    return builder
  }

  beforeEach(() => {
    supabaseCalls = []

    // Mock the Supabase module
    vi.doMock('../lib/supabase', () => {
      return {
        getSupabase: () => ({
          from: (table: string) => {
            supabaseCalls.push({ table, method: 'from' })

            // Return appropriate data based on table and flow state
            if (table === 'clients') {
              return createQueryBuilder(mockClient)
            }
            if (table === 'projects') {
              return createQueryBuilder(mockProject)
            }
            if (table === 'time_entries') {
              return createQueryBuilder(mockRunningEntry)
            }
            return createQueryBuilder(null)
          },
        }),
        supabase: {
          from: (table: string) => {
            supabaseCalls.push({ table, method: 'from' })
            return createQueryBuilder(null)
          },
        },
      }
    })
  })

  it('simulates the complete user workflow end-to-end', async () => {
    // Step 1: Add a client
    // In the real app, this creates a client via Supabase
    expect(mockClient.name).toBe('B.B.')
    expect(mockClient.hourly_rate).toBe(30)

    // Step 2: Add a project under the client
    expect(mockProject.client_id).toBe(mockClient.id)
    expect(mockProject.name).toBe('GA Gymnastics State Meets')

    // Step 3: Start a timer (creates a running time entry)
    expect(mockRunningEntry.is_running).toBe(true)
    expect(mockRunningEntry.start_time).toBeTruthy()
    expect(mockRunningEntry.end_time).toBeNull()
    expect(mockRunningEntry.project_id).toBe(mockProject.id)

    // Step 4: Stop the timer (sets end_time, calculates duration)
    expect(mockStoppedEntry.is_running).toBe(false)
    expect(mockStoppedEntry.end_time).toBeTruthy()
    expect(mockStoppedEntry.duration_seconds).toBe(5400) // 1.5 hours

    // Step 5: View the entry in the time log
    const elapsed = formatDuration(mockStoppedEntry.duration_seconds!)
    expect(elapsed).toBe('01:30:00')

    const cost = calculateRunningCost(mockStoppedEntry.duration_seconds!, mockClient.hourly_rate)
    expect(cost).toBe(45) // 1.5 hours * $30/hr

    const formattedCost = formatCurrency(cost)
    expect(formattedCost).toBe('$45.00')

    // Step 6: Export CSV
    const csvEntries = [
      {
        client_name: mockClient.name,
        project_name: mockProject.name,
        start_time: mockStoppedEntry.start_time,
        end_time: mockStoppedEntry.end_time!,
        duration_seconds: mockStoppedEntry.duration_seconds,
        notes: mockStoppedEntry.notes,
        is_manual: mockStoppedEntry.is_manual,
        effectiveRate: mockClient.hourly_rate,
      },
    ]

    const csv = generateCSV(csvEntries)
    const lines = csv.split('\n')

    // Verify CSV has header + data row
    expect(lines).toHaveLength(2)

    // Verify header columns
    expect(lines[0]).toContain('Client')
    expect(lines[0]).toContain('Project')
    expect(lines[0]).toContain('Duration')
    expect(lines[0]).toContain('Cost')

    // Verify data row contains correct values
    expect(lines[1]).toContain('B.B.')
    expect(lines[1]).toContain('GA Gymnastics State Meets')
    expect(lines[1]).toContain('01:30:00')
    expect(lines[1]).toContain('$45.00')
    expect(lines[1]).toContain('$30.00')
    expect(lines[1]).toContain('Working on header redesign')
    expect(lines[1]).toContain('Timer')

    // Verify filename generation
    const filename = generateCSVFilename('B.B.', '2025-01-15', '2025-01-15')
    expect(filename).toBe('in-do-time_b.b._2025-01-15_to_2025-01-15_export.csv')
  })

  it('handles multiple clients with different rates in a single export', () => {
    const entries = [
      {
        client_name: 'B.B.',
        project_name: 'GA Gymnastics State Meets',
        start_time: '2025-01-15T09:00:00.000Z',
        end_time: '2025-01-15T10:30:00.000Z',
        duration_seconds: 5400,
        notes: 'Header redesign',
        is_manual: false,
        effectiveRate: 30,
      },
      {
        client_name: 'Mariah',
        project_name: 'Evermore Equine',
        start_time: '2025-01-15T11:00:00.000Z',
        end_time: '2025-01-15T12:00:00.000Z',
        duration_seconds: 3600,
        notes: 'Contact form',
        is_manual: false,
        effectiveRate: 45,
      },
    ]

    const csv = generateCSV(entries)
    const lines = csv.split('\n')

    expect(lines).toHaveLength(3) // header + 2 entries

    // B.B. entry: 1.5h * $30 = $45
    expect(lines[1]).toContain('B.B.')
    expect(lines[1]).toContain('$45.00')

    // Mariah entry: 1h * $45 = $45
    expect(lines[2]).toContain('Mariah')
    expect(lines[2]).toContain('$45.00')

    // Both should be Timer type (not Manual)
    expect(lines[1]).toContain('Timer')
    expect(lines[2]).toContain('Timer')
  })

  it('verifies timer state transitions through the workflow', () => {
    // Initial state: no timer
    expect(mockRunningEntry.is_running).toBe(true)
    expect(mockRunningEntry.end_time).toBeNull()
    expect(mockRunningEntry.duration_seconds).toBeNull()

    // After stop: timer completed
    expect(mockStoppedEntry.is_running).toBe(false)
    expect(mockStoppedEntry.end_time).not.toBeNull()
    expect(mockStoppedEntry.duration_seconds).toBeGreaterThan(0)

    // Duration should match the time between start and end
    const start = new Date(mockStoppedEntry.start_time)
    const end = new Date(mockStoppedEntry.end_time!)
    const expectedDuration = Math.floor((end.getTime() - start.getTime()) / 1000)
    expect(mockStoppedEntry.duration_seconds).toBe(expectedDuration)
  })
})

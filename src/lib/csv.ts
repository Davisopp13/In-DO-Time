import { formatDuration, formatCurrency, calculateRunningCost } from './timer'

interface CSVEntry {
  trail_name: string
  project_name: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  notes: string | null
  effectiveRate: number | null
}

/**
 * Generate CSV content from time entries
 * Columns: Date, Trail, Project, Start, End, Duration, Rate (effective), Cost, Notes
 */
export function generateCSV(entries: CSVEntry[]): string {
  const headers = [
    'Date',
    'Trail',
    'Project',
    'Start',
    'End',
    'Duration',
    'Rate (effective)',
    'Cost',
    'Notes',
  ]

  const rows = entries.map((entry) => {
    const startDate = new Date(entry.start_time)
    const endDate = entry.end_time ? new Date(entry.end_time) : null
    const seconds = entry.duration_seconds ?? 0
    const rate = entry.effectiveRate ?? 0
    const cost = calculateRunningCost(seconds, rate)

    return [
      startDate.toLocaleDateString(),
      escapeCSV(entry.trail_name),
      escapeCSV(entry.project_name),
      startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      endDate ? endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
      formatDuration(seconds),
      entry.effectiveRate != null ? formatCurrency(entry.effectiveRate) : '',
      entry.effectiveRate != null ? formatCurrency(cost) : '',
      escapeCSV(entry.notes || ''),
    ]
  })

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ]

  return csvLines.join('\n')
}

/**
 * Escape a value for CSV (wrap in quotes if it contains commas, quotes, or newlines)
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Trigger a CSV file download in the browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate a filename for the CSV export based on filters
 */
export function generateCSVFilename(
  trailName?: string,
  startDate?: string,
  endDate?: string
): string {
  const parts = ['in-do-time']

  if (trailName) {
    parts.push(trailName.toLowerCase().replace(/\s+/g, '-'))
  }

  if (startDate) {
    parts.push(startDate)
  }

  if (endDate) {
    parts.push('to')
    parts.push(endDate)
  } else if (startDate) {
    parts.push('onwards')
  }

  parts.push('export')

  return parts.join('_') + '.csv'
}

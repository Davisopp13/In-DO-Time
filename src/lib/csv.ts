import { formatDuration, formatCurrency, calculateRunningCost } from './timer'

interface CSVEntry {
  client_name: string
  project_name: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  notes: string | null
  is_manual: boolean
  effectiveRate: number
}

/**
 * Generate CSV content from time entries
 * Columns: Client, Project, Date, Start Time, End Time, Duration, Hourly Rate, Cost, Notes, Type
 */
export function generateCSV(entries: CSVEntry[]): string {
  const headers = [
    'Client',
    'Project',
    'Date',
    'Start Time',
    'End Time',
    'Duration',
    'Hours (Decimal)',
    'Hourly Rate',
    'Cost',
    'Notes',
    'Type',
  ]

  const rows = entries.map((entry) => {
    const startDate = new Date(entry.start_time)
    const endDate = entry.end_time ? new Date(entry.end_time) : null
    const seconds = entry.duration_seconds ?? 0
    const hours = seconds / 3600
    const cost = calculateRunningCost(seconds, entry.effectiveRate)

    return [
      escapeCSV(entry.client_name),
      escapeCSV(entry.project_name),
      startDate.toLocaleDateString(),
      startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      endDate ? endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
      formatDuration(seconds),
      hours.toFixed(2),
      formatCurrency(entry.effectiveRate),
      formatCurrency(cost),
      escapeCSV(entry.notes || ''),
      entry.is_manual ? 'Manual' : 'Timer',
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
  clientName?: string,
  startDate?: string,
  endDate?: string
): string {
  const parts = ['in-do-time']

  if (clientName) {
    parts.push(clientName.toLowerCase().replace(/\s+/g, '-'))
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

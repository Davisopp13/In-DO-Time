function localDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayLocal(): string {
  return localDateString(new Date());
}

/**
 * A date N days from today as YYYY-MM-DD in local timezone.
 * Positive offset = future, negative = past, 0 = today.
 */
export function localDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

/** Convert a Date object (or null/undefined) to YYYY-MM-DD in local timezone. */
export function toLocalDateString(date: Date | null | undefined): string | null {
  if (!date) return null;
  return localDateString(date);
}

/**
 * Format a YYYY-MM-DD string for display, e.g. "May 26".
 * Returns empty string for null/undefined/invalid input.
 */
export function formatLocalDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}

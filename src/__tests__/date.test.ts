import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayLocal, localDateOffset, toLocalDateString, formatLocalDate } from '../lib/date';

// Use new Date(year, month, day, ...) to construct dates in local time —
// this makes tests timezone-independent because getDate() returns the local day.

afterEach(() => {
  vi.useRealTimers();
});

describe('todayLocal', () => {
  it('returns today as YYYY-MM-DD using local time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 23, 30, 0)); // May 25 11:30pm local
    expect(todayLocal()).toBe('2026-05-25');
  });

  it('does not roll over to next UTC day at late local time', () => {
    vi.useFakeTimers();
    // May 25 11:59pm local — UTC could be May 26 depending on timezone,
    // but local date must still be May 25
    vi.setSystemTime(new Date(2026, 4, 25, 23, 59, 0));
    expect(todayLocal()).toBe('2026-05-25');
  });

  it('uses the correct local month padding', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5)); // Jan 5, 2026
    expect(todayLocal()).toBe('2026-01-05');
  });
});

describe('localDateOffset', () => {
  it('returns today with offset 0', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    expect(localDateOffset(0)).toBe('2026-05-25');
  });

  it('returns tomorrow with offset +1', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    expect(localDateOffset(1)).toBe('2026-05-26');
  });

  it('returns yesterday with offset -1', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    expect(localDateOffset(-1)).toBe('2026-05-24');
  });

  it('handles month rollover', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 31)); // May 31
    expect(localDateOffset(1)).toBe('2026-06-01');
  });
});

describe('toLocalDateString', () => {
  it('returns null for null', () => {
    expect(toLocalDateString(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toLocalDateString(undefined)).toBeNull();
  });

  it('converts a known Date to local YYYY-MM-DD', () => {
    // Noon local time — no risk of midnight edge case
    const d = new Date(2026, 4, 26, 12, 0, 0); // May 26, 2026 noon local
    expect(toLocalDateString(d)).toBe('2026-05-26');
  });

  it('uses local time, not UTC', () => {
    // A Date at local midnight on May 26 — getDate() returns 26 locally
    const d = new Date(2026, 4, 26, 0, 0, 0);
    expect(toLocalDateString(d)).toBe('2026-05-26');
  });
});

describe('formatLocalDate', () => {
  it('formats a known date string', () => {
    expect(formatLocalDate('2026-05-26')).toBe('May 26');
  });

  it('formats a single-digit day correctly', () => {
    expect(formatLocalDate('2026-01-05')).toBe('January 5');
  });

  it('returns empty string for null', () => {
    expect(formatLocalDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatLocalDate(undefined)).toBe('');
  });

  it('returns empty string for invalid input', () => {
    expect(formatLocalDate('not-a-date')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatLocalDate('')).toBe('');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseTaskInput } from '../lib/parseTaskInput';

afterEach(() => {
  vi.useRealTimers();
});

describe('parseTaskInput — due_date output', () => {
  it('returns null when no date phrase present', () => {
    const result = parseTaskInput('buy groceries #errands');
    expect(result.due_date).toBeNull();
  });

  it('returns a YYYY-MM-DD string, not a Date object', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25)); // May 25 local
    const result = parseTaskInput('do the thing tomorrow');
    expect(typeof result.due_date).toBe('string');
    expect(result.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('"today" returns the local calendar day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 23, 0, 0)); // May 25 11pm local
    const result = parseTaskInput('finish report today');
    expect(result.due_date).toBe('2026-05-25');
  });

  it('"tomorrow" returns the next local calendar day, not UTC+1', () => {
    vi.useFakeTimers();
    // 11pm local May 25 — UTC is already May 26 in many timezones.
    // The result must be local tomorrow (May 26), not UTC tomorrow (May 27).
    vi.setSystemTime(new Date(2026, 4, 25, 23, 0, 0));
    const result = parseTaskInput('call dentist tomorrow');
    expect(result.due_date).toBe('2026-05-26');
  });

  it('"in N days" returns the correct local date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25)); // May 25
    const result = parseTaskInput('review PR in 3 days');
    expect(result.due_date).toBe('2026-05-28');
  });

  it('"next week" resolves to the next Monday in local time', () => {
    vi.useFakeTimers();
    // May 25, 2026 is a Monday (day 1). Next Monday = June 1.
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('plan sprint next week');
    expect(result.due_date).toBe('2026-06-01');
  });

  it('weekday name resolves to the next occurrence of that day', () => {
    vi.useFakeTimers();
    // May 25, 2026 is Monday. Next Friday = May 29.
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('submit invoice friday');
    expect(result.due_date).toBe('2026-05-29');
  });

  it('MM/DD resolves to a local YYYY-MM-DD string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25)); // May 25, 2026
    const result = parseTaskInput('birthday party 6/15');
    expect(result.due_date).toBe('2026-06-15');
  });

  it('MM/DD in the past bumps to next year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25)); // May 25, 2026
    const result = parseTaskInput('anniversary 2/14');
    expect(result.due_date).toBe('2027-02-14');
  });
});

describe('parseTaskInput — other fields still work', () => {
  it('extracts project, tags, priority, assignee', () => {
    const result = parseTaskInput('fix bug @acme #backend !! +alice');
    expect(result.project).toBe('acme');
    expect(result.tags).toContain('backend');
    expect(result.priority).toBe('high');
    expect(result.assignee).toBe('alice');
  });

  it('title has date phrase stripped', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('send invoice tomorrow');
    expect(result.title).toBe('send invoice');
    expect(result.due_date).toBe('2026-05-26');
  });
});

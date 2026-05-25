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
    const result = parseTaskInput('do the thing due tomorrow');
    expect(typeof result.due_date).toBe('string');
    expect(result.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('"due today" returns the local calendar day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 23, 0, 0)); // May 25 11pm local
    const result = parseTaskInput('finish report due today');
    expect(result.due_date).toBe('2026-05-25');
  });

  it('"due tomorrow" returns the next local calendar day, not UTC+1', () => {
    vi.useFakeTimers();
    // 11pm local May 25 — UTC is already May 26 in many timezones.
    // The result must be local tomorrow (May 26), not UTC tomorrow (May 27).
    vi.setSystemTime(new Date(2026, 4, 25, 23, 0, 0));
    const result = parseTaskInput('call dentist due tomorrow');
    expect(result.due_date).toBe('2026-05-26');
  });

  it('"in N days" returns the correct local date (no prefix needed)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25)); // May 25
    const result = parseTaskInput('review PR in 3 days');
    expect(result.due_date).toBe('2026-05-28');
  });

  it('"due next week" resolves to the next Monday in local time', () => {
    vi.useFakeTimers();
    // May 25, 2026 is a Monday (day 1). Next Monday = June 1.
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('plan sprint due next week');
    expect(result.due_date).toBe('2026-06-01');
  });

  it('weekday with prefix resolves to the next occurrence of that day', () => {
    vi.useFakeTimers();
    // May 25, 2026 is Monday. Next Friday = May 29.
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('submit invoice by friday');
    expect(result.due_date).toBe('2026-05-29');
  });

  it('"due MM/DD" resolves to a local YYYY-MM-DD string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25)); // May 25, 2026
    const result = parseTaskInput('birthday party due 6/15');
    expect(result.due_date).toBe('2026-06-15');
  });

  it('"due MM/DD" in the past bumps to next year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25)); // May 25, 2026
    const result = parseTaskInput('anniversary due 2/14');
    expect(result.due_date).toBe('2027-02-14');
  });

  it('bare "today" without prefix is treated as prose — due_date is null', () => {
    const result = parseTaskInput('Shipped today @indotime');
    expect(result.due_date).toBeNull();
  });

  it('prose "today" is ignored; prefixed "due tomorrow" wins', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('Shipped today, due tomorrow');
    expect(result.due_date).toBe('2026-05-26');
  });

  it('"in N days" without prefix still sets due_date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('Working on this in 3 days');
    expect(result.due_date).toBe('2026-05-28');
  });

  it('"on Monday" prefix is accepted as date intent (design trade-off)', () => {
    vi.useFakeTimers();
    // May 25, 2026 is Monday. Next Monday = June 1.
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('Met Mary on Monday');
    expect(result.due_date).toBe('2026-06-01');
  });

  it('realistic prose: bare "today" ignored, "due tomorrow" at end wins', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput(
      'Shipped the briefing refactor today @indotime #milestone #release !! due tomorrow'
    );
    expect(result.due_date).toBe('2026-05-26');
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

  it('date phrase stripped from title', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25));
    const result = parseTaskInput('send invoice due tomorrow');
    expect(result.title).toBe('send invoice');
    expect(result.due_date).toBe('2026-05-26');
  });
});

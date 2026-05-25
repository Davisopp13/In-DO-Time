import { localDateOffset, toLocalDateString } from './date';

export interface ParsedTask {
  title: string;
  due_date: string | null;
  priority: "low" | "medium" | "high" | null;
  project: string | null;
  tags: string[];
  assignee: string | null;
}

export interface ParseContext {
  projectAliases?: Record<string, string>;
}

/**
 * Parse natural language task input into structured fields.
 *
 * Extraction order (each match is removed from the remaining title):
 *   1. Project:  @name or /tasks@name
 *   2. Tags:     #tagname (multiple allowed)
 *   3. Dates:    Require a "due/by/on" prefix before date keywords to avoid
 *                false positives in prose. Exception: "in N days" is self-
 *                describing and never needs a prefix.
 *   4. Priority: !!!|urgent|asap → high, !!|important → high, ! → medium, "low priority" → low
 *   5. Assignee: +username
 *   6. Cleanup:  collapse spaces, trim
 */
export function parseTaskInput(
  input: string,
  context?: ParseContext
): ParsedTask {
  let text = input;

  // 1. Project: @name or /tasks@name
  let project: string | null = null;
  text = text.replace(/(?:\/tasks)?@(\w+)/i, (_, name) => {
    const lower = name.toLowerCase();
    if (context?.projectAliases && lower in context.projectAliases) {
      project = context.projectAliases[lower];
    } else {
      project = name;
    }
    return "";
  });

  // 2. Tags: #tagname (collect all)
  const tags: string[] = [];
  text = text.replace(/#(\w+)/g, (_, tag) => {
    tags.push(tag.toLowerCase());
    return "";
  });

  // 3. Dates — all output as YYYY-MM-DD local-date strings
  // Date keywords require a "due/by/on" prefix to distinguish intent from prose.
  // Exception: "in N days" is inherently date-intent and needs no prefix.
  let due_date: string | null = null;
  // Kept for day-of-week arithmetic and MM/DD year/past-date logic
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  // "due/by/on today"
  text = text.replace(/\b(?:due|by|on)\s+today\b/i, () => {
    if (!due_date) due_date = localDateOffset(0);
    return "";
  });

  // "due/by/on tomorrow"
  text = text.replace(/\b(?:due|by|on)\s+tomorrow\b/i, () => {
    if (!due_date) due_date = localDateOffset(1);
    return "";
  });

  // "due/by/on next week" → next Monday
  text = text.replace(/\b(?:due|by|on)\s+next\s+week\b/i, () => {
    if (!due_date) {
      const dayOfWeek = todayDate.getDay(); // 0=Sun, local
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      due_date = localDateOffset(daysUntilMonday);
    }
    return "";
  });

  // "in N days" — no prefix required; phrasing is self-describing date intent
  text = text.replace(/\bin\s+(\d+)\s+days?\b/i, (_, n) => {
    if (!due_date) due_date = localDateOffset(parseInt(n, 10));
    return "";
  });

  // "due/by/on MM/DD" (e.g., due 2/14, by 12/25)
  text = text.replace(/\b(?:due|by|on)\s+(\d{1,2})\/(\d{1,2})\b/i, (_, m, d) => {
    if (!due_date) {
      const month = parseInt(m, 10);
      const day = parseInt(d, 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const candidate = new Date(todayDate.getFullYear(), month - 1, day);
        // If the date is in the past, assume next year
        if (candidate < todayDate) {
          candidate.setFullYear(candidate.getFullYear() + 1);
        }
        due_date = toLocalDateString(candidate);
      }
    }
    return "";
  });

  // "due/by/on <weekday>" (Monday, Tuesday, ..., Sunday — also abbreviations Mon, Tue, etc.)
  const weekdays: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };
  const weekdayPattern =
    /\b(?:due|by|on)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i;
  text = text.replace(weekdayPattern, (_, day) => {
    if (!due_date) {
      const target = weekdays[day.toLowerCase()];
      const current = todayDate.getDay();
      let diff = target - current;
      if (diff <= 0) diff += 7; // Always the NEXT occurrence
      due_date = localDateOffset(diff);
    }
    return "";
  });

  // 4. Priority (order matters: check longer patterns first)
  let priority: "low" | "medium" | "high" | null = null;

  // "low priority"
  text = text.replace(/\blow\s+priority\b/i, () => {
    if (!priority) priority = "low";
    return "";
  });

  // !!! or "urgent" or "asap"
  text = text.replace(/!!!|\burgent\b|\basap\b/i, () => {
    if (!priority) priority = "high";
    return "";
  });

  // !! or "important"
  text = text.replace(/!!|\bimportant\b/i, () => {
    if (!priority) priority = "high";
    return "";
  });

  // Single ! (only if not already consumed by !! or !!!)
  // Match a standalone ! that isn't preceded/followed by another !
  text = text.replace(/(?<![!])!(?![!])/g, () => {
    if (!priority) priority = "medium";
    return "";
  });

  // 5. Assignee: +username
  let assignee: string | null = null;
  text = text.replace(/\+(\w+)/, (_, name) => {
    assignee = name;
    return "";
  });

  // 6. Cleanup: collapse multiple spaces, trim
  const title = text.replace(/\s+/g, " ").trim();

  return {
    title,
    due_date,
    priority,
    project,
    tags,
    assignee,
  };
}

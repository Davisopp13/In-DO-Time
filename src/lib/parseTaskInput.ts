export interface ParsedTask {
  title: string;
  due_date: Date | null;
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
 *   3. Dates:    "tomorrow", "today", "next week", "in N days", "MM/DD", weekday names
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

  // 3. Dates
  let due_date: Date | null = null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // "today"
  text = text.replace(/\btoday\b/i, () => {
    if (!due_date) due_date = new Date(today);
    return "";
  });

  // "tomorrow"
  text = text.replace(/\btomorrow\b/i, () => {
    if (!due_date) {
      due_date = new Date(today);
      due_date.setDate(due_date.getDate() + 1);
    }
    return "";
  });

  // "next week" → next Monday
  text = text.replace(/\bnext\s+week\b/i, () => {
    if (!due_date) {
      due_date = new Date(today);
      const dayOfWeek = due_date.getDay(); // 0=Sun
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      due_date.setDate(due_date.getDate() + daysUntilMonday);
    }
    return "";
  });

  // "in N days"
  text = text.replace(/\bin\s+(\d+)\s+days?\b/i, (_, n) => {
    if (!due_date) {
      due_date = new Date(today);
      due_date.setDate(due_date.getDate() + parseInt(n, 10));
    }
    return "";
  });

  // MM/DD (e.g., 2/14, 12/25)
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\b/, (_, m, d) => {
    if (!due_date) {
      const month = parseInt(m, 10);
      const day = parseInt(d, 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        due_date = new Date(today.getFullYear(), month - 1, day);
        // If the date is in the past, assume next year
        if (due_date < today) {
          due_date.setFullYear(due_date.getFullYear() + 1);
        }
      }
    }
    return "";
  });

  // Weekday names (Monday, Tuesday, ..., Sunday — also abbreviations Mon, Tue, etc.)
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
    /\b(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i;
  text = text.replace(weekdayPattern, (match) => {
    if (!due_date) {
      const target = weekdays[match.toLowerCase()];
      const current = today.getDay();
      let diff = target - current;
      if (diff <= 0) diff += 7; // Always the NEXT occurrence
      due_date = new Date(today);
      due_date.setDate(due_date.getDate() + diff);
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { parseTaskInput } from '@/lib/parseTaskInput';
import type { JournalEntry, JournalEntryInsert, JournalEntryUpdate } from '@/types/database';
import EmptyState from '@/components/EmptyState';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function parsedTagsFor(content: string) {
  const parsed = parseTaskInput(content);
  return {
    tags: parsed.tags,
    project: parsed.project,
    priority: parsed.priority,
    assignee: parsed.assignee,
    due_date: parsed.due_date ? parsed.due_date.toISOString() : null,
  };
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const todayEntry = entries.find((entry) => entry.entry_date === today);
  const history = entries.filter((entry) => entry.entry_date !== today);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await getSupabase()
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false });

    if (loadError) {
      setError('Failed to load journal');
      setLoading(false);
      return;
    }

    const rows = (data as JournalEntry[]) || [];
    setEntries(rows);
    setContent(rows.find((entry) => entry.entry_date === today)?.content ?? '');
    setError(null);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const parsed_tags = parsedTagsFor(content);

      if (todayEntry) {
        const update: JournalEntryUpdate = { content, parsed_tags };
        const { error: updateError } = await supabase.from('journal_entries').update(update).eq('id', todayEntry.id);
        if (updateError) {
          setError('Failed to update journal entry');
          return;
        }
      } else {
        const insert: JournalEntryInsert = { entry_date: today, content, parsed_tags };
        const { error: insertError } = await supabase.from('journal_entries').insert(insert);
        if (insertError) {
          setError('Failed to save journal entry');
          return;
        }
      }

      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-white">Journal</h1>
        <p className="mt-1 text-sm text-text-muted">Nightly prose reflection with lightweight tag extraction.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">Today · {formatDate(today)}</h2>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={10}
          className="w-full resize-none rounded-lg border border-border bg-surface/50 px-4 py-3 text-sm leading-6 text-text outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-white/25"
          placeholder="What happened today? What is still open? Use #tags, @project, !, or due words when they help."
        />
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text dark:text-white">History</h2>
        {loading ? (
          <div className="glass-card h-24 animate-pulse" />
        ) : history.length === 0 ? (
          <EmptyState title="No previous entries">Saved entries will stack here chronologically.</EmptyState>
        ) : (
          history.map((entry) => (
            <article key={entry.id} className="glass-card p-4 shadow-card">
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted">{formatDate(entry.entry_date)}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text dark:text-white">{entry.content}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

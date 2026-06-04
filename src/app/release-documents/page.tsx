'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, Copy, FileText, Loader2, Printer, Save, Sparkles } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { localDateOffset, todayLocal } from '@/lib/date'
import type { ReleaseMode } from '@/lib/release/types'
import type { ReleaseDocument, Trail } from '@/types/database'
import EmptyState from '@/components/EmptyState'

type TrailOption = Pick<Trail, 'id' | 'name' | 'kind' | 'color' | 'status'>

type ReleaseDocumentRow = ReleaseDocument & {
  trailName?: string
  trailColor?: string | null
}

type GenerateResponse = {
  document?: ReleaseDocument
  fallback?: boolean
  fallbackReason?: string | null
  error?: string
}

function nextDay(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function minDate(first: string, second: string): string {
  return first <= second ? first : second
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-surface-foreground/10 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10">{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

function renderMarkdownPreview(markdown: string, options: { hideTitleHeading?: boolean } = {}): React.ReactNode {
  const lines = markdown.split('\n')
  const blocks: React.ReactNode[] = []
  let listItems: string[] = []
  let skippedTitleHeading = false

  function flushList(key: string) {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={key} className="my-4 list-disc space-y-2 pl-5 text-sm leading-6 text-text dark:text-white">
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) {
      flushList(`list-${index}`)
      return
    }

    if (line.startsWith('- ')) {
      listItems.push(line.slice(2).trim())
      return
    }

    flushList(`list-${index}`)

    if (line.startsWith('# ')) {
      if (options.hideTitleHeading && !skippedTitleHeading) {
        skippedTitleHeading = true
        return
      }
      blocks.push(<h1 key={index} className="mb-4 text-2xl font-bold leading-tight text-text dark:text-white">{renderInlineMarkdown(line.slice(2).trim())}</h1>)
      return
    }

    if (line.startsWith('## ')) {
      blocks.push(<h2 key={index} className="mb-3 mt-6 text-lg font-bold leading-snug text-text dark:text-white">{renderInlineMarkdown(line.slice(3).trim())}</h2>)
      return
    }

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={index} className="mb-2 mt-5 text-base font-bold leading-snug text-text dark:text-white">{renderInlineMarkdown(line.slice(4).trim())}</h3>)
      return
    }

    blocks.push(<p key={index} className="my-3 text-sm leading-6 text-text dark:text-white">{renderInlineMarkdown(line)}</p>)
  })

  flushList('list-end')

  return blocks.length > 0 ? blocks : <p className="text-sm text-text-muted">No markdown to preview.</p>
}

function ReleaseDocumentPreview({
  document,
  markdown,
}: {
  document: ReleaseDocumentRow
  markdown: string
}) {
  return (
    <div className="release-print-scope min-h-[18rem] rounded-lg border border-border bg-[#f8faf7] p-4 shadow-sm dark:bg-slate-950 xl:min-h-[32rem]">
      <article className="release-print-document mx-auto max-w-3xl overflow-hidden rounded-lg border border-[#d7dfd0] bg-white shadow-card dark:border-white/10 dark:bg-slate-900">
        <header className="border-b border-[#d7dfd0] bg-[#f3f7ef] px-5 py-4 dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/DO_CODE_LAB_LOGO.png"
                alt="DO Code Lab"
                width={144}
                height={44}
                className="h-10 w-auto object-contain"
              />
              <div className="h-9 w-px bg-[#c7d3bd] dark:bg-white/10" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Release Document</div>
                <div className="mt-0.5 text-xs text-text-muted">{document.mode === 'client' ? 'Client update' : 'Internal notes'}</div>
              </div>
            </div>
            <div className="text-left text-xs text-text-muted sm:text-right">
              <div>{formatDate(document.start_date)} - {formatDate(document.end_date)}</div>
              <div>{document.trailName || 'Unknown trail'}</div>
            </div>
          </div>
        </header>
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {renderMarkdownPreview(markdown, { hideTitleHeading: true })}
        </div>
      </article>
    </div>
  )
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

export default function ReleaseDocumentsPage() {
  const [trails, setTrails] = useState<TrailOption[]>([])
  const [documents, setDocuments] = useState<ReleaseDocumentRow[]>([])
  const [mode, setMode] = useState<ReleaseMode>('internal')
  const [selectedTrailId, setSelectedTrailId] = useState('')
  const [startDate, setStartDate] = useState(localDateOffset(-30))
  const [endDate, setEndDate] = useState(todayLocal())
  const [activeDocument, setActiveDocument] = useState<ReleaseDocumentRow | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [printNotice, setPrintNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)

  const availableTrails = useMemo(() => {
    const active = trails.filter((trail) => trail.status === 'active')
    return mode === 'client' ? active.filter((trail) => trail.kind === 'client') : active
  }, [mode, trails])

  const loadData = useCallback(async () => {
    const supabase = getSupabase()
    const [trailsResult, docsResult] = await Promise.all([
      supabase.from('trails').select('id, name, kind, color, status').order('display_order'),
      supabase.from('release_documents').select('*').order('created_at', { ascending: false }).limit(50),
    ])

    if (trailsResult.error || docsResult.error) {
      setError('Failed to load release documents')
      setLoading(false)
      return
    }

    const loadedTrails = (trailsResult.data as TrailOption[]) || []
    const trailMap = new Map(loadedTrails.map((trail) => [trail.id, trail]))
    const loadedDocuments = ((docsResult.data as ReleaseDocument[]) || []).map((document) => {
      const trail = trailMap.get(document.trail_id)
      return {
        ...document,
        trailName: trail?.name,
        trailColor: trail?.color,
      }
    })

    setTrails(loadedTrails)
    setDocuments(loadedDocuments)

    if (!selectedTrailId) {
      const initialTrail = loadedTrails.find((trail) => trail.status === 'active')
      if (initialTrail) setSelectedTrailId(initialTrail.id)
    }

    setError(null)
    setLoading(false)
  }, [selectedTrailId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (availableTrails.length === 0) {
      setSelectedTrailId('')
      return
    }

    if (!availableTrails.some((trail) => trail.id === selectedTrailId)) {
      setSelectedTrailId(availableTrails[0].id)
    }
  }, [availableTrails, selectedTrailId])

  useEffect(() => {
    if (!selectedTrailId) return
    const latest = documents
      .filter((document) => document.mode === mode && document.trail_id === selectedTrailId)
      .sort((a, b) => b.end_date.localeCompare(a.end_date))[0]

    const today = todayLocal()
    setStartDate(latest ? minDate(nextDay(latest.end_date), today) : localDateOffset(-30))
    setEndDate(today)
  }, [documents, mode, selectedTrailId])

  function openDocument(document: ReleaseDocumentRow) {
    setActiveDocument(document)
    setMarkdown(document.markdown)
    setFallbackNotice(document.status === 'fallback' ? 'Fallback draft generated without model synthesis.' : null)
  }

  async function generateDocument() {
    if (!selectedTrailId || generating) return

    setGenerating(true)
    setError(null)
    setFallbackNotice(null)

    try {
      const response = await fetch('/api/release-documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, trailId: selectedTrailId, startDate, endDate }),
      })
      const payload = (await response.json()) as GenerateResponse
      if (!response.ok || !payload.document) {
        throw new Error(payload.error || 'Failed to generate release document')
      }

      const trail = trails.find((item) => item.id === payload.document?.trail_id)
      const document = {
        ...payload.document,
        trailName: trail?.name,
        trailColor: trail?.color,
      }

      setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)])
      setActiveDocument(document)
      setMarkdown(document.markdown)
      if (payload.fallback) {
        setFallbackNotice(payload.fallbackReason || 'Fallback draft generated without model synthesis.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate release document')
    } finally {
      setGenerating(false)
    }
  }

  async function saveActiveDocument() {
    if (!activeDocument || saving) return
    setSaving(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const { error: updateError } = await supabase
        .from('release_documents')
        .update({ markdown })
        .eq('id', activeDocument.id)

      if (updateError) throw updateError

      const updated = {
        ...activeDocument,
        markdown,
        updated_at: new Date().toISOString(),
      }
      setActiveDocument(updated)
      setDocuments((current) => current.map((document) => document.id === updated.id ? updated : document))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save release document')
    } finally {
      setSaving(false)
    }
  }

  async function copyMarkdown() {
    if (!markdown) return
    const didCopy = await copyToClipboard(markdown)
    if (!didCopy) {
      setError('Could not copy markdown')
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function printDocument() {
    if (!activeDocument) return

    window.sessionStorage.setItem('releaseDocumentPrintPayload', JSON.stringify({
      document: activeDocument,
      markdown,
    }))
    setPrintNotice('Opening printable document.')
    window.location.assign('/release-documents/print')
  }

  const selectedTrail = trails.find((trail) => trail.id === selectedTrailId)
  const scopedDocuments = documents.filter((document) => document.mode === mode && (!selectedTrailId || document.trail_id === selectedTrailId))
  const dateRangeInvalid = endDate < startDate

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text dark:text-white">Release Documents</h1>
            <p className="mt-1 text-sm text-text-muted">Saved markdown drafts from observation history.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {fallbackNotice && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {fallbackNotice}
        </div>
      )}

      {printNotice && (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {printNotice}
        </div>
      )}

      <section className="glass-card p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[10rem_1fr_10rem_10rem_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-muted">Mode</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ReleaseMode)}
              className="h-10 w-full rounded-lg border border-border bg-surface/70 px-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 dark:bg-black/20 dark:text-white"
            >
              <option value="internal" className="bg-surface dark:bg-slate-900">Internal</option>
              <option value="client" className="bg-surface dark:bg-slate-900">Client</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-muted">Trail</span>
            <select
              value={selectedTrailId}
              onChange={(event) => setSelectedTrailId(event.target.value)}
              disabled={availableTrails.length === 0}
              className="h-10 w-full rounded-lg border border-border bg-surface/70 px-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-60 dark:bg-black/20 dark:text-white"
            >
              {availableTrails.map((trail) => (
                <option key={trail.id} value={trail.id} className="bg-surface dark:bg-slate-900">
                  {trail.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-muted">Start</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface/70 px-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 dark:bg-black/20 dark:text-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-muted">End</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface/70 px-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 dark:bg-black/20 dark:text-white"
            />
          </label>

          <button
            type="button"
            onClick={() => void generateDocument()}
            disabled={!selectedTrailId || generating || loading || dateRangeInvalid}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </button>
        </div>
        {mode === 'client' && availableTrails.length === 0 && (
          <p className="mt-3 text-sm text-text-muted">No active client trails found.</p>
        )}
        {dateRangeInvalid && (
          <p className="mt-3 text-sm text-red-500">End date must be on or after start date.</p>
        )}
        {selectedTrail && (
          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedTrail.color ?? '#3A7D44' }} />
            <span>{selectedTrail.name}</span>
            <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="glass-card p-4 shadow-card">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">Drafts</h2>
          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-surface-foreground/10 dark:bg-white/5" />)}
            </div>
          ) : scopedDocuments.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No drafts yet">Generated release documents will appear here.</EmptyState>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {scopedDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => openDocument(document)}
                  className={`w-full rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${activeDocument?.id === document.id ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: document.trailColor ?? '#3A7D44' }} />
                    <span className="min-w-0 truncate text-sm font-bold text-text dark:text-white">{document.title}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                    <span>{formatDate(document.start_date)} - {formatDate(document.end_date)}</span>
                    {document.status === 'fallback' && <span className="text-amber-700 dark:text-amber-300">fallback</span>}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">{formatTimestamp(document.updated_at)}</div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="glass-card p-4 shadow-card">
          {!activeDocument ? (
            <EmptyState title="No draft selected">Generate or open a draft to review markdown.</EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text dark:text-white">{activeDocument.title}</h2>
                  <p className="mt-1 text-xs text-text-muted">
                    {activeDocument.trailName || 'Unknown trail'} · {activeDocument.mode} · {formatDate(activeDocument.start_date)} - {formatDate(activeDocument.end_date)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={printDocument}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-muted transition hover:border-primary/40 hover:text-primary"
                  >
                    <Printer className="h-4 w-4" />
                    Print / PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyMarkdown()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-muted transition hover:border-primary/40 hover:text-primary"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveActiveDocument()}
                    disabled={saving}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Preview</div>
                  <ReleaseDocumentPreview document={activeDocument} markdown={markdown} />
                </div>

                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Markdown</div>
                  <textarea
                    value={markdown}
                    onChange={(event) => setMarkdown(event.target.value)}
                    className="min-h-[18rem] w-full resize-y rounded-lg border border-border bg-surface/70 p-4 font-mono text-sm leading-6 text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 dark:bg-black/20 dark:text-white xl:min-h-[32rem]"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  )
}

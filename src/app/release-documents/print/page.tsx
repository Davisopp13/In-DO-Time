'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, Printer } from 'lucide-react'
import type { ReleaseDocument } from '@/types/database'

type PrintableDocument = ReleaseDocument & {
  trailName?: string
}

type PrintPayload = {
  document: PrintableDocument
  markdown: string
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

function renderMarkdownPreview(markdown: string): React.ReactNode {
  const lines = markdown.split('\n')
  const blocks: React.ReactNode[] = []
  let listItems: string[] = []
  let skippedTitleHeading = false

  function flushList(key: string) {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={key} className="my-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-900">
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
      if (!skippedTitleHeading) {
        skippedTitleHeading = true
        return
      }
      blocks.push(<h1 key={index} className="mb-4 text-2xl font-bold leading-tight text-slate-950">{renderInlineMarkdown(line.slice(2).trim())}</h1>)
      return
    }

    if (line.startsWith('## ')) {
      blocks.push(<h2 key={index} className="mb-3 mt-6 text-lg font-bold leading-snug text-slate-950">{renderInlineMarkdown(line.slice(3).trim())}</h2>)
      return
    }

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={index} className="mb-2 mt-5 text-base font-bold leading-snug text-slate-950">{renderInlineMarkdown(line.slice(4).trim())}</h3>)
      return
    }

    blocks.push(<p key={index} className="my-3 text-sm leading-7 text-slate-900">{renderInlineMarkdown(line)}</p>)
  })

  flushList('list-end')

  return blocks.length > 0 ? blocks : <p className="text-sm text-slate-500">No markdown to preview.</p>
}

export default function ReleaseDocumentPrintPage() {
  const [payload] = useState<PrintPayload | null>(() => {
    if (typeof window === 'undefined') return null

    const raw = window.sessionStorage.getItem('releaseDocumentPrintPayload')
    if (!raw) return null

    try {
      return JSON.parse(raw) as PrintPayload
    } catch {
      return null
    }
  })

  if (!payload) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 rounded-lg border border-border bg-white p-6 text-slate-900 shadow-card">
        <h1 className="text-xl font-bold">No printable document found</h1>
        <p className="text-sm text-slate-600">Return to release documents, open a draft, and use Print / PDF again.</p>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    )
  }

  const { document, markdown } = payload

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="release-print-hide flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white/90 p-3 shadow-card">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      <div className="release-print-scope rounded-lg border border-border bg-[#f8faf7] p-4 shadow-sm">
        <article className="release-print-document mx-auto overflow-hidden rounded-lg border border-[#d7dfd0] bg-white shadow-card">
          <header className="border-b border-[#d7dfd0] bg-[#f3f7ef] px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Image
                  src="/DO_CODE_LAB_LOGO.png"
                  alt="DO Code Lab"
                  width={144}
                  height={44}
                  className="h-10 w-auto object-contain"
                />
                <div className="h-10 w-px bg-[#c7d3bd]" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">Release Document</div>
                  <div className="mt-0.5 text-sm text-slate-600">{document.mode === 'client' ? 'Client update' : 'Internal notes'}</div>
                </div>
              </div>
              <div className="text-left text-sm text-slate-600 sm:text-right">
                <div>{formatDate(document.start_date)} - {formatDate(document.end_date)}</div>
                <div>{document.trailName || 'Unknown trail'}</div>
              </div>
            </div>
          </header>
          <div className="px-6 py-7 sm:px-10 sm:py-9">
            {renderMarkdownPreview(markdown)}
          </div>
        </article>
      </div>
    </div>
  )
}

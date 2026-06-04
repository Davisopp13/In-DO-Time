import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { gatherReleaseInputs } from '@/lib/release/gather'
import { structuredOutputToJson, synthesizeRelease } from '@/lib/release/synthesize'
import { getSupabase, isDemoMode } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { ReleaseDocument, ReleaseDocumentInsert } from '@/types/database'
import type { ReleaseMode } from '@/lib/release/types'

type GenerateBody = {
  mode?: unknown
  trailId?: unknown
  startDate?: unknown
  endDate?: unknown
}

function isReleaseMode(value: unknown): value is ReleaseMode {
  return value === 'internal' || value === 'client'
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getServerSupabase() {
  return isDemoMode() ? getSupabase() : getSupabaseAdmin()
}

export async function POST(request: NextRequest) {
  let body: GenerateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  if (!isReleaseMode(body.mode)) {
    return NextResponse.json({ error: 'mode must be internal or client' }, { status: 400 })
  }
  if (typeof body.trailId !== 'string' || body.trailId.length === 0) {
    return NextResponse.json({ error: 'trailId is required' }, { status: 400 })
  }
  if (!isDateString(body.startDate) || !isDateString(body.endDate)) {
    return NextResponse.json({ error: 'startDate and endDate must be YYYY-MM-DD dates' }, { status: 400 })
  }
  if (body.endDate < body.startDate) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 })
  }

  const supabase = getServerSupabase()

  try {
    const inputs = await gatherReleaseInputs({
      mode: body.mode,
      trailId: body.trailId,
      startDate: body.startDate,
      endDate: body.endDate,
    }, supabase)
    const synthesis = await synthesizeRelease(inputs)
    const id = randomUUID()
    const row: ReleaseDocumentInsert = {
      id,
      mode: body.mode,
      trail_id: body.trailId,
      start_date: body.startDate,
      end_date: body.endDate,
      title: synthesis.title,
      markdown: synthesis.markdown,
      structured_output: structuredOutputToJson(synthesis.structuredOutput),
      source_observation_ids: inputs.observations.map((observation) => observation.id),
      status: synthesis.fallback ? 'fallback' : 'draft',
    }

    const { error: insertError } = await supabase.from('release_documents').insert(row)
    if (insertError) {
      console.error('release document insert failed', insertError)
      return NextResponse.json({ error: 'Failed to save release document' }, { status: 500 })
    }

    const { data, error: selectError } = await supabase
      .from('release_documents')
      .select('*')
      .eq('id', id)
      .single()

    if (selectError || !data) {
      console.error('release document reload failed', selectError)
      return NextResponse.json({ error: 'Failed to reload release document' }, { status: 500 })
    }

    return NextResponse.json({
      document: data as ReleaseDocument,
      markdown: synthesis.markdown,
      fallback: synthesis.fallback,
      fallbackReason: synthesis.fallbackReason ?? null,
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate release document'
    const status = message.includes('not found') || message.includes('Client release') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

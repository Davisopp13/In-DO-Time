import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { Json, ObservationInsert } from '@/types/database'

type RawObservation = {
  created_at?: unknown
  source?: unknown
  content?: unknown
  related_trail_id?: unknown
  related_project_id?: unknown
  metadata?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCreatedAt(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return new Date().toISOString()
  }

  if (typeof value !== 'string') {
    throw new Error('created_at must be an ISO-compatible string when provided')
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('created_at must be a valid timestamp')
  }

  return parsed.toISOString()
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`${field} must be a string UUID`)
  return value
}

function normalizeObservation(raw: RawObservation, index: number): ObservationInsert {
  if (typeof raw.source !== 'string' || raw.source.trim().length === 0) {
    throw new Error(`observations[${index}].source is required`)
  }

  if (typeof raw.content !== 'string' || raw.content.trim().length === 0) {
    throw new Error(`observations[${index}].content is required`)
  }

  if (raw.metadata !== undefined && !isRecord(raw.metadata)) {
    throw new Error(`observations[${index}].metadata must be an object when provided`)
  }

  return {
    created_at: normalizeCreatedAt(raw.created_at),
    source: raw.source.trim(),
    content: raw.content.trim(),
    related_trail_id: optionalUuid(raw.related_trail_id, `observations[${index}].related_trail_id`),
    related_project_id: optionalUuid(raw.related_project_id, `observations[${index}].related_project_id`),
    metadata: (raw.metadata ?? {}) as Json,
  }
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.OBSERVATIONS_TOKEN
  if (!expectedToken) {
    return NextResponse.json({ error: 'Observation ingest is not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : ''
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  if (!isRecord(body) || !Array.isArray(body.observations)) {
    return NextResponse.json({ error: 'Request body must be { observations: [...] }' }, { status: 400 })
  }

  if (body.observations.length === 0) {
    return NextResponse.json({ error: 'observations must contain at least one item' }, { status: 400 })
  }

  let rows: ObservationInsert[]
  try {
    rows = body.observations.map((item, index) => {
      if (!isRecord(item)) throw new Error(`observations[${index}] must be an object`)
      return normalizeObservation(item, index)
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid observation payload' },
      { status: 400 }
    )
  }

  const { data, error } = await getSupabaseAdmin()
    .from('observations')
    .insert(rows)
    .select('id, created_at')

  if (error) {
    return NextResponse.json({ error: 'Failed to persist observations' }, { status: 500 })
  }

  return NextResponse.json({ inserted: data?.length ?? 0, observations: data }, { status: 201 })
}

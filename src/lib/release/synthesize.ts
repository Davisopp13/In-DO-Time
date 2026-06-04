import Anthropic from '@anthropic-ai/sdk'
import type { Json } from '@/types/database'
import type { ReleaseInputs, ReleaseSection, ReleaseStructuredOutput, SynthesizedRelease } from './types'

const RELEASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          heading: { type: 'string' },
          bullets: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['heading', 'bullets'],
      },
    },
  },
  required: ['sections'],
}

function formatDateRange(inputs: ReleaseInputs): string {
  return inputs.startDate === inputs.endDate
    ? inputs.startDate
    : `${inputs.startDate} to ${inputs.endDate}`
}

export function buildReleaseTitle(inputs: ReleaseInputs): string {
  const modeLabel = inputs.mode === 'client' ? 'Client Update' : 'Release Notes'
  return `${inputs.trail.name} ${modeLabel}: ${formatDateRange(inputs)}`
}

function sanitizeBullet(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeStructuredOutput(value: unknown): ReleaseStructuredOutput | null {
  if (typeof value !== 'object' || value === null || !('sections' in value)) return null
  const sectionsValue = (value as { sections?: unknown }).sections
  if (!Array.isArray(sectionsValue)) return null

  const sections: ReleaseSection[] = sectionsValue
    .map((section): ReleaseSection | null => {
      if (typeof section !== 'object' || section === null) return null
      const heading = (section as { heading?: unknown }).heading
      const bullets = (section as { bullets?: unknown }).bullets
      if (typeof heading !== 'string' || !Array.isArray(bullets)) return null
      const cleanBullets = bullets.filter((bullet): bullet is string => typeof bullet === 'string').map(sanitizeBullet).filter(Boolean)
      if (!heading.trim() || cleanBullets.length === 0) return null
      return { heading: heading.trim(), bullets: cleanBullets }
    })
    .filter((section): section is ReleaseSection => section !== null)

  return { sections }
}

export function renderReleaseMarkdown(title: string, structuredOutput: ReleaseStructuredOutput): string {
  const body = structuredOutput.sections
    .map((section) => {
      const bullets = section.bullets.map((bullet) => `- ${bullet}`).join('\n')
      return `## ${section.heading}\n\n${bullets}`
    })
    .join('\n\n')

  return body ? `# ${title}\n\n${body}` : `# ${title}\n\n_No release-worthy observations found for this period._`
}

export function buildDeterministicRelease(inputs: ReleaseInputs, reason = 'Anthropic synthesis was unavailable'): SynthesizedRelease {
  const observationsBySource = new Map<string, string[]>()
  for (const observation of inputs.observations) {
    const source = observation.source || 'observation'
    const current = observationsBySource.get(source) ?? []
    current.push(observation.content)
    observationsBySource.set(source, current)
  }

  const sections: ReleaseSection[] = Array.from(observationsBySource.entries()).map(([source, contents]) => ({
    heading: source,
    bullets: contents.slice(0, 12).map(sanitizeBullet).filter(Boolean),
  })).filter((section) => section.bullets.length > 0)

  if (sections.length === 0 && inputs.journalEntries.length > 0) {
    sections.push({
      heading: 'Journal Context',
      bullets: inputs.journalEntries.slice(0, 6).map((entry) => sanitizeBullet(entry.content)).filter(Boolean),
    })
  }

  const title = buildReleaseTitle(inputs)
  const structuredOutput = {
    sections,
    fallback: true,
    fallbackReason: reason,
  }

  return {
    title,
    markdown: renderReleaseMarkdown(title, structuredOutput),
    structuredOutput,
    fallback: true,
    fallbackReason: reason,
  }
}

function buildPrompt(inputs: ReleaseInputs): string {
  const projectLookup = new Map(inputs.projects.map((project) => [project.id, project.name]))
  const observations = inputs.observations.map((observation) => ({
    id: observation.id,
    created_at: observation.created_at,
    source: observation.source,
    content: observation.content,
    project: observation.related_project_id ? projectLookup.get(observation.related_project_id) ?? null : null,
    metadata: inputs.mode === 'internal' ? observation.metadata : undefined,
  }))

  return JSON.stringify({
    task: 'Synthesize release document sections from observed work only.',
    mode: inputs.mode,
    audience: inputs.mode === 'client' ? 'External client. Be clear, plain-language, and client-polite.' : 'Davis reviewing shipped work. Be direct and terse.',
    rules: [
      'Do not invent work not present in observations or journal context.',
      'Thin input must produce a short document, never padding.',
      'Rewrite technical notes into human-readable impact where the input supports it.',
      'Client mode must omit internal process churn, raw source/debug metadata, and implementation noise that is not client-relevant.',
      'Return only sections with concrete bullets.',
    ],
    trail: inputs.trail,
    date_range: { start: inputs.startDate, end: inputs.endDate },
    projects: inputs.projects,
    observations,
    journal_context: inputs.journalEntries.map((entry) => ({
      entry_date: entry.entry_date,
      content: entry.content,
    })),
  })
}

function extractJsonText(content: Anthropic.Message['content']): string {
  const textBlock = content.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}

export async function synthesizeRelease(inputs: ReleaseInputs): Promise<SynthesizedRelease> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return buildDeterministicRelease(inputs, 'ANTHROPIC_API_KEY is not configured')
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'
  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 1400,
      system: 'You write concise release notes from factual observation logs. Never add work that is not supported by the input.',
      messages: [{ role: 'user', content: buildPrompt(inputs) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: RELEASE_SCHEMA,
        },
      },
    })

    const parsed = normalizeStructuredOutput(JSON.parse(extractJsonText(message.content)))
    if (!parsed) {
      return buildDeterministicRelease(inputs, 'Anthropic returned malformed release JSON')
    }

    const title = buildReleaseTitle(inputs)
    const structuredOutput = { ...parsed, model }
    return {
      title,
      markdown: renderReleaseMarkdown(title, parsed),
      structuredOutput,
      fallback: false,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Anthropic synthesis failed'
    return buildDeterministicRelease(inputs, reason)
  }
}

export function structuredOutputToJson(output: SynthesizedRelease['structuredOutput']): Json {
  return output as unknown as Json
}

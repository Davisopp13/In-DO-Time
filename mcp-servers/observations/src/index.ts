#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CONFIG_PATH = join(homedir(), '.config', 'in-do-time', 'observations.env')

type ToolResult = { ok: true; id: string } | { ok: false; error: string }

type Credentials = { token: string; apiUrl: string }

function die(message: string): never {
  process.stderr.write(`[observations-mcp] ${message}\n`)
  process.exit(1)
}

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key.length > 0) out[key] = value
  }
  return out
}

function loadCredentials(): Credentials {
  let raw: string
  try {
    raw = readFileSync(CONFIG_PATH, 'utf8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      die(
        `Missing credentials file at ${CONFIG_PATH}.\n` +
          `Create it with these keys:\n` +
          `  OBSERVATIONS_TOKEN=<bearer token>\n` +
          `  OBSERVATIONS_API_URL=<https://host/api/observations>`,
      )
    }
    die(`Failed to read ${CONFIG_PATH}: ${(err as Error).message}`)
  }

  const parsed = parseEnvFile(raw)
  const token = parsed.OBSERVATIONS_TOKEN
  const apiUrl = parsed.OBSERVATIONS_API_URL

  if (!token) die(`OBSERVATIONS_TOKEN missing in ${CONFIG_PATH}`)
  if (!apiUrl) die(`OBSERVATIONS_API_URL missing in ${CONFIG_PATH}`)

  return { token, apiUrl }
}

function loadSource(): string {
  const source = process.env.OBSERVATION_SOURCE
  if (!source || source.trim().length === 0) {
    die(
      'OBSERVATION_SOURCE env var is required. Set it in the MCP client config, ' +
        'e.g. OBSERVATION_SOURCE=claude-code',
    )
  }
  return source.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type RecordObservationArgs = {
  content: string
  related_trail_id?: string
  related_project_id?: string
  metadata?: Record<string, unknown>
}

function validateArgs(args: unknown): { ok: true; value: RecordObservationArgs } | { ok: false; error: string } {
  if (!isRecord(args)) {
    return { ok: false, error: 'arguments must be an object' }
  }

  const { content, related_trail_id, related_project_id, metadata } = args

  if (typeof content !== 'string' || content.trim().length === 0) {
    return { ok: false, error: 'content is required and must be a non-empty string' }
  }

  const out: RecordObservationArgs = { content: content.trim() }

  if (related_trail_id !== undefined && related_trail_id !== null && related_trail_id !== '') {
    if (typeof related_trail_id !== 'string' || !UUID_RE.test(related_trail_id)) {
      return { ok: false, error: 'related_trail_id must be a valid UUID' }
    }
    out.related_trail_id = related_trail_id
  }

  if (related_project_id !== undefined && related_project_id !== null && related_project_id !== '') {
    if (typeof related_project_id !== 'string' || !UUID_RE.test(related_project_id)) {
      return { ok: false, error: 'related_project_id must be a valid UUID' }
    }
    out.related_project_id = related_project_id
  }

  if (metadata !== undefined && metadata !== null) {
    if (!isRecord(metadata)) {
      return { ok: false, error: 'metadata must be an object when provided' }
    }
    out.metadata = metadata
  }

  return { ok: true, value: out }
}

async function postObservation(
  creds: Credentials,
  source: string,
  args: RecordObservationArgs,
): Promise<ToolResult> {
  const observation: Record<string, unknown> = {
    source,
    content: args.content,
  }
  if (args.related_trail_id) observation.related_trail_id = args.related_trail_id
  if (args.related_project_id) observation.related_project_id = args.related_project_id
  if (args.metadata) observation.metadata = args.metadata

  let response: Response
  try {
    response = await fetch(creds.apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify({ observations: [observation] }),
    })
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` }
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.text()
      if (body) {
        try {
          const parsed = JSON.parse(body)
          if (isRecord(parsed) && typeof parsed.error === 'string') {
            detail = `: ${parsed.error}`
          } else {
            detail = `: ${body.slice(0, 200)}`
          }
        } catch {
          detail = `: ${body.slice(0, 200)}`
        }
      }
    } catch {
      // ignore body read errors
    }
    return {
      ok: false,
      error: `Observation API returned ${response.status} ${response.statusText}${detail}`,
    }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (err) {
    return { ok: false, error: `Failed to parse API response: ${(err as Error).message}` }
  }

  if (!isRecord(payload) || !Array.isArray(payload.observations) || payload.observations.length === 0) {
    return { ok: false, error: 'API response did not include an inserted observation' }
  }

  const first = payload.observations[0]
  if (!isRecord(first) || typeof first.id !== 'string') {
    return { ok: false, error: 'API response observation is missing an id' }
  }

  return { ok: true, id: first.id }
}

async function main() {
  const source = loadSource()
  const creds = loadCredentials()

  const server = new Server(
    { name: 'observations-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'record_observation',
        description:
          "Record an observation about the user's work. Use for noting state changes, " +
          'decisions, milestones, or context worth capturing for later reflection.',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The observation text. Required, non-empty.',
            },
            related_trail_id: {
              type: 'string',
              description: 'Optional UUID of a related trail.',
            },
            related_project_id: {
              type: 'string',
              description: 'Optional UUID of a related project.',
            },
            metadata: {
              type: 'object',
              description: 'Optional structured extras.',
              additionalProperties: true,
            },
          },
          required: ['content'],
          additionalProperties: false,
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'record_observation') {
      const result: ToolResult = { ok: false, error: `Unknown tool: ${request.params.name}` }
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: true }
    }

    const validated = validateArgs(request.params.arguments)
    if (!validated.ok) {
      const result: ToolResult = { ok: false, error: validated.error }
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: true }
    }

    let result: ToolResult
    try {
      result = await postObservation(creds, source, validated.value)
    } catch (err) {
      result = { ok: false, error: `Unexpected error: ${(err as Error).message}` }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: !result.ok,
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write(
    `[observations-mcp] ready (source="${source}", api=${creds.apiUrl})\n`,
  )
}

main().catch((err) => {
  process.stderr.write(`[observations-mcp] fatal: ${(err as Error).message}\n`)
  process.exit(1)
})

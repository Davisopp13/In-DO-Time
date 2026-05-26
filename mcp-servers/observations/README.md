# Observations MCP Server

A standalone MCP (Model Context Protocol) server that exposes a single
`record_observation` tool. The tool is a thin wrapper around the
`POST /api/observations` endpoint of the In DO Time app, letting AI agents
(Claude Code, Codex, Antigravity, etc.) emit observations into the data layer
during their sessions.

The server is intentionally decoupled from the main app: its own
`package.json`, its own dependencies, its own build output. The only
dependency on the app is the HTTP contract of the observations endpoint.

## Tool contract

```
Name:        record_observation
Description: Record an observation about the user's work. Use for noting
             state changes, decisions, milestones, or context worth capturing
             for later reflection.

Input:
  content              string  required   the observation text
  related_trail_id     string  optional   UUID of a related trail
  related_project_id   string  optional   UUID of a related project
  metadata             object  optional   structured extras

Returns (as JSON text content on the tool call):
  { "ok": true,  "id": "<uuid>" }   on success
  { "ok": false, "error": "..." }   on failure

The tool never throws. Observation writes failing should not break the
calling agent.
```

The `source` field on each observation is **not** an input — the server fills
it in from the `OBSERVATION_SOURCE` env var on every call.

## Configuration

The server reads two pieces of configuration:

### 1. Identity — `OBSERVATION_SOURCE` env var

Set in the MCP client config, per-agent. Identifies which agent created the
observation (`claude-code`, `codex`, `antigravity`, `manual-test`, etc.).

If the env var is missing or empty, the server exits at startup with a clear
error message.

### 2. Credentials — `~/.config/in-do-time/observations.env`

A shared dotenv file at this exact path (resolved via `os.homedir()`):

```
# ~/.config/in-do-time/observations.env

OBSERVATIONS_TOKEN=replace-with-the-bearer-token-the-app-expects
OBSERVATIONS_API_URL=http://localhost:3000/api/observations
```

Format: one `KEY=VALUE` per line. Blank lines and `#` comments are ignored.
Values may be wrapped in single or double quotes (they will be stripped).

If the file is missing or any required key is absent, the server exits at
startup naming the missing piece.

The token must match the `OBSERVATIONS_TOKEN` configured for the running app
instance you want to write to. For local development this is the value in
the app's `.env.local`.

## Build & run

```bash
cd mcp-servers/observations
npm install
npm run build
ls dist/index.js   # confirm build output
```

Run manually (useful for sanity-checking startup):

```bash
OBSERVATION_SOURCE=manual-test node dist/index.js
```

The server speaks MCP over stdio. After startup it writes a single line to
stderr (`[observations-mcp] ready (...)`) and then waits silently for JSON-RPC
messages on stdin. There is nothing to "curl" — see
[Verifying the API token](#verifying-the-api-token) for a way to test the
underlying endpoint without driving the MCP protocol by hand.

## Sample MCP client config

For Claude Code (`~/.claude.json` or a project-scoped `.mcp.json`):

```json
{
  "mcpServers": {
    "observations": {
      "command": "node",
      "args": [
        "/absolute/path/to/In DO Time/mcp-servers/observations/dist/index.js"
      ],
      "env": {
        "OBSERVATION_SOURCE": "claude-code"
      }
    }
  }
}
```

For Codex / Antigravity / any other MCP client, mirror the same shape — the
`command`/`args`/`env` triple is the standard MCP server stanza. Change the
`OBSERVATION_SOURCE` value per agent so observations are attributable.

The `OBSERVATIONS_TOKEN` and `OBSERVATIONS_API_URL` are intentionally **not**
in the MCP config — they live in the shared credentials file so multiple
agents can reuse them and rotating the token only touches one place.

## Verifying the API token

Stdio MCP isn't easily curl-able. To confirm your token and URL work before
wiring up an MCP client, hit the underlying API directly:

```bash
TOKEN=$(grep '^OBSERVATIONS_TOKEN=' ~/.config/in-do-time/observations.env | cut -d= -f2-)
URL=$(grep '^OBSERVATIONS_API_URL='   ~/.config/in-do-time/observations.env | cut -d= -f2-)

curl -sS -X POST "$URL" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"observations":[{"source":"manual-curl","content":"hello from curl"}]}'
```

A successful response looks like:

```json
{ "inserted": 1, "observations": [{ "id": "...", "created_at": "..." }] }
```

If you get `401 Unauthorized` the token is wrong; if you get `503` the app
isn't configured with `OBSERVATIONS_TOKEN`; if the connection fails the URL
is unreachable from your machine.

## Manual MCP smoke test

Once the server starts cleanly, the easiest end-to-end test is to wire it
into an actual MCP client (Claude Code or otherwise) using the sample config
above and call the tool from a session.

Expected behavior:

1. `initialize` succeeds.
2. `tools/list` returns one tool, `record_observation`, with the input
   schema described above.
3. `tools/call` with name `record_observation` and arguments
   `{ "content": "hello from manual test" }` returns a tool result whose
   text content parses to `{ "ok": true, "id": "<uuid>" }` and produces a
   row in Supabase's `observations` table with `source` equal to the
   `OBSERVATION_SOURCE` from the client config.

## Scope limits (intentional)

- Only one tool. No `list_trails`, `list_projects`, or name→UUID resolution
  — agents pass UUIDs they already have.
- One credentials file path. No prod/dev split for now.
- No tests in this package — manual verification is sufficient for the first
  cut.

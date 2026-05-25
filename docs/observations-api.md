# Observations API

Agents send observations to `POST /api/observations`. The endpoint always accepts a batch envelope, even for a single observation.

## Authentication

Set `OBSERVATIONS_TOKEN` in the app environment. Send it as a bearer token:

```bash
Authorization: Bearer $OBSERVATIONS_TOKEN
```

The endpoint writes with `SUPABASE_SERVICE_ROLE_KEY`, so that key must also be present server-side.

## Request

```json
{
  "observations": [
    {
      "created_at": "2026-05-24T21:15:00-04:00",
      "source": "desktop-agent",
      "content": "Updated the project phase checklist and left one open loop.",
      "related_trail_id": "optional-trail-uuid",
      "related_project_id": "optional-project-uuid",
      "metadata": {
        "window_title": "In DO Time",
        "confidence": 0.88
      }
    }
  ]
}
```

Required fields per observation: `source`, `content`.

Optional fields: `created_at`, `related_trail_id`, `related_project_id`, `metadata`.

`created_at` may include any ISO-compatible timezone offset. The API normalizes it to UTC before writing. If omitted, the server uses the current time. `metadata` must be a JSON object when provided.

## Responses

Success returns `201`:

```json
{
  "inserted": 1,
  "observations": [
    {
      "id": "generated-uuid",
      "created_at": "2026-05-25T01:15:00.000Z"
    }
  ]
}
```

Invalid auth returns `401`. Invalid shape returns `400`. Missing server configuration returns `503`.

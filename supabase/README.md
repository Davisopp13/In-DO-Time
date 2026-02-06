# Supabase Setup

## Running Migrations

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `migrations/001_initial_schema.sql`
4. Paste and run in the SQL Editor

## Tables Created

- **clients**: Client records with name, hourly rate, and color
- **projects**: Projects belonging to clients, with optional hourly rate override
- **time_entries**: Time tracking entries with start/end times, duration, and notes

## Environment Variables

After setting up Supabase, update `.env.local` with your project credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these values in your Supabase project: **Settings > API**

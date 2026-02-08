# Demo Mode Guide

## Overview

**In DO Time** now supports a **Demo Mode** that runs entirely with mock data - no database or Supabase account required! This is perfect for:

- 🎨 Showcasing the app on the DO Code Lab website
- 🧪 Testing features without setting up a database
- 👀 Letting potential users explore the interface
- 📱 Quick local development without database dependencies

## How It Works

When demo mode is enabled, the app uses an in-memory data store instead of connecting to Supabase. All data is realistic and fully functional, but resets on page refresh.

## Quick Start

### For Demo/Testing

1. Copy the demo environment file:
   ```bash
   cp .env.local.demo .env.local
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) - you'll see a demo banner at the top!

### For Production Database

1. Use your regular Supabase credentials in `.env.local`:
   ```bash
   NEXT_PUBLIC_DEMO_MODE=false
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

## Demo Data

The mock data includes:

### Clients
- **DO Code Lab** ($85/hr, Blue) - Website Redesign, Mobile App Development
- **Acme Corp** ($100/hr, Green) - E-commerce Platform
- **TechStart Inc** ($75/hr, Purple) - API Integration, UI Component Library
- **Creative Studio** ($90/hr, Amber) - Brand Identity

### Time Entries
- Today's entries: ~4.75 hours of completed work across multiple projects
- Yesterday's entries: ~8.5 hours of work for historical data

### Features Included
- ✅ All timer operations (start, stop, pause, resume)
- ✅ Project and client management
- ✅ Time entry history
- ✅ Reports and analytics
- ✅ Data persists during the session (resets on refresh)

## Deployment

### Deploy Demo Version

**For DO Code Lab Website Demo:**

1. Create a new Vercel deployment
2. Set environment variable:
   ```
   NEXT_PUBLIC_DEMO_MODE=true
   ```
3. Deploy! No Supabase credentials needed

**Optional:** Set placeholder Supabase values (not used but may be checked):
```
NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=demo-key
```

### Deploy Production Version

Use your normal deployment process with real Supabase credentials and `NEXT_PUBLIC_DEMO_MODE=false` (or unset).

## Demo Mode Features

### UI Indicators
- 🎯 **Demo Banner** - Appears at the top of the page
- 🔄 **Reset Button** - Resets all demo data to defaults
- ❌ **Dismiss** - Hide the banner (it returns on refresh)

### Limitations
- Data resets on page refresh or when Reset button is clicked
- No real database persistence
- All data is stored in memory (browser session)

## Switching Between Modes

You can run multiple deployments from the same codebase:

| Deployment | Environment Variable | Database |
|------------|---------------------|----------|
| **Demo Site** | `NEXT_PUBLIC_DEMO_MODE=true` | Mock data (in-memory) |
| **Production** | `NEXT_PUBLIC_DEMO_MODE=false` | Real Supabase database |

## Technical Details

### Architecture
- `src/lib/mockData.ts` - Mock data store and sample data
- `src/lib/supabaseDemo.ts` - Mock Supabase client that mimics the real API
- `src/lib/supabase.ts` - Smart wrapper that returns demo or real client based on env var
- `src/components/DemoBanner.tsx` - UI banner for demo mode

### Zero Code Changes
The mock client implements the same Supabase API, so **no component changes are needed**. All existing code works identically in both modes.

## FAQ

**Q: Will demo mode work on mobile?**
A: Yes! The demo banner is responsive and works on all devices.

**Q: Can I customize the demo data?**
A: Yes! Edit `src/lib/mockData.ts` to add/modify clients, projects, or time entries.

**Q: Does demo mode support all features?**
A: Yes! All CRUD operations, timers, reports, and filtering work exactly like the real app.

**Q: How do I reset the demo data?**
A: Click "Reset Demo" in the banner, or refresh the page.

**Q: Can I use this for local development?**
A: Absolutely! It's perfect for working on UI/UX without needing database setup.

## Support

Questions or issues? Check the [main README](README.md) or open an issue on GitHub.

---

**Built with ❤️ for DO Code Lab**

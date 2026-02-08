import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getDemoSupabaseClient } from './supabaseDemo'

let supabaseInstance: SupabaseClient<Database> | null = null

// Check if we're in demo mode
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): any {
  // Return demo client if in demo mode
  if (isDemoMode()) {
    return getDemoSupabaseClient()
  }

  // Return cached real Supabase instance
  if (supabaseInstance) {
    return supabaseInstance
  }

  // Initialize real Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

// Export for backward compatibility (lazy getter)
export const supabase = {
  from: <T extends keyof Database['public']['Tables']>(table: T) => {
    return getSupabase().from(table)
  },
}

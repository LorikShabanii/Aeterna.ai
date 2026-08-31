import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { supabaseUrl } from './env'

// Service-role client — bypasses RLS entirely. Only call this from inside a
// server function handler, never from client-reachable code: the key must
// never end up in the browser bundle. Needed only where there's no user
// session to authenticate with (e.g. public recovery-key redemption).
export function getSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env (server-only, no VITE_ prefix) — find it in Supabase Project Settings > API.',
    )
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

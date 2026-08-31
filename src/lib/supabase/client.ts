import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'
import { supabaseAnonKey, supabaseUrl } from './env'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

// createBrowserClient (vs. plain supabase-js) stores the session in cookies
// instead of localStorage, so server functions can read the same session —
// required for RLS-scoped queries during SSR/loaders.
export function getSupabaseBrowserClient() {
  browserClient ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  return browserClient
}

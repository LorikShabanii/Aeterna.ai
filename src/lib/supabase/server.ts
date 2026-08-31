import { createServerClient } from '@supabase/ssr'
import { deleteCookie, getCookies, setCookie } from '@tanstack/react-start/server'
import type { Database } from './types'
import { supabaseAnonKey, supabaseUrl } from './env'

// Call only from inside a server function (createServerFn) or server route
// handler — getCookies/setCookie/deleteCookie require that request context.
export function getSupabaseServerClient() {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = getCookies()
        return Object.entries(cookies).map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options)
        }
      },
    },
  })
}

export function clearSupabaseSessionCookies() {
  // Supabase splits large session cookies across chunks
  // (sb-<project-ref>-auth-token, .0, .1, ...); auth-js clears these itself
  // on signOut, so this is only a fallback for manual cleanup.
  deleteCookie(`sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`)
}

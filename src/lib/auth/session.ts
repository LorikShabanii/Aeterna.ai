import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// Used by route `beforeLoad`/`loader` guards to check auth on the server
// before rendering — avoids a client-side flash of protected content.
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return { id: user.id, email: user.email ?? null }
})

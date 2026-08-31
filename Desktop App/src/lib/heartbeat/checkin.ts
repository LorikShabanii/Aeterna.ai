import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@/lib/supabase/types'

// See the note in src/lib/vault/items.ts — @supabase/supabase-js@2.112.4's
// generic inference currently resolves table types to `never` for this
// Database type (a live upstream bug), so writes need the same manual
// query-builder re-typing used there.
type PgError = { message: string } | null

export interface CheckInStatus {
  lastCheckInAt: string
  checkInFrequencyDays: number
  dueAt: string
  isOverdue: boolean
}

export const getCheckInStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CheckInStatus> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = (await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()) as { data: ProfileRow | null; error: PgError }

    if (error) throw new Error(error.message)
    if (!data) throw new Error('No profile found for this user')

    const dueAt = new Date(
      new Date(data.last_check_in_at).getTime() +
        data.check_in_frequency_days * 24 * 60 * 60 * 1000,
    )

    return {
      lastCheckInAt: data.last_check_in_at,
      checkInFrequencyDays: data.check_in_frequency_days,
      dueAt: dueAt.toISOString(),
      isOverdue: dueAt.getTime() < Date.now(),
    }
  },
)

export const checkIn = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const now = new Date().toISOString()

  const { error } = (await (
    supabase.from('profiles') as unknown as {
      update: (values: {
        last_check_in_at: string
        last_reminder_tier: null
      }) => { eq: (column: 'id', value: string) => PromiseLike<{ error: PgError }> }
    }
  )
    .update({ last_check_in_at: now, last_reminder_tier: null })
    .eq('id', user.id)) as { error: PgError }

  if (error) throw new Error(error.message)

  // 'biometric' stands in for this web check-in until the Tauri shell wraps
  // it with a real OS prompt — CLAUDE.md's method enum only has the two
  // values, and this is the same "I'm here" heartbeat action either way.
  const { error: checkinError } = (await (
    supabase.from('checkins') as unknown as {
      insert: (values: {
        user_id: string
        method: 'biometric'
        checked_in_at: string
      }) => PromiseLike<{ error: PgError }>
    }
  ).insert({ user_id: user.id, method: 'biometric', checked_in_at: now })) as { error: PgError }

  if (checkinError) throw new Error(checkinError.message)
})

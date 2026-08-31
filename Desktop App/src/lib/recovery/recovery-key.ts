import { createServerFn } from '@tanstack/react-start'
import { createHash } from 'node:crypto'
import { generateMnemonic } from 'bip39'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { RecoveryKeyRow } from '@/lib/supabase/types'

// See the note in src/lib/vault/items.ts — @supabase/supabase-js@2.112.4's
// generic inference currently resolves table types to `never` for this
// Database type (a live upstream bug), so writes need the same manual
// query-builder re-typing used there.
type PgError = { message: string } | null

function hashPhrase(phrase: string) {
  // Normalize so extra whitespace/casing from copy-paste doesn't create a
  // hash mismatch at redemption time.
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex')
}

export const getRecoveryKeyStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = (await supabase
    .from('recovery_keys')
    .select('*')
    .eq('user_id', user.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: RecoveryKeyRow | null; error: PgError }

  if (error) throw new Error(error.message)

  return { hasActiveKey: data !== null, createdAt: data?.created_at ?? null }
})

// Returns the plaintext phrase exactly once — only the hash is ever stored.
export const generateRecoveryKey = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // One active key at a time — retire any existing unused one first.
  const { error: deleteError } = (await (
    supabase.from('recovery_keys') as unknown as {
      delete: () => {
        eq: (
          column: 'user_id',
          value: string,
        ) => { is: (column: 'used_at', value: null) => PromiseLike<{ error: PgError }> }
      }
    }
  )
    .delete()
    .eq('user_id', user.id)
    .is('used_at', null)) as { error: PgError }

  if (deleteError) throw new Error(deleteError.message)

  const phrase = generateMnemonic(128) // 12 words, ~128 bits of entropy

  const insertPayload = { user_id: user.id, key_hash: hashPhrase(phrase) }
  const { error: insertError } = (await (
    supabase.from('recovery_keys') as unknown as {
      insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
    }
  ).insert(insertPayload)) as { error: PgError }

  if (insertError) throw new Error(insertError.message)

  return { phrase }
})

const redeemSchema = z.object({ phrase: z.string().min(1, 'Enter your recovery phrase') })

// Public, no-login — see src/routes/recover.tsx. Runs through the
// service-role client since there's no session to identify the user by;
// the recovery key itself is what identifies them.
export const redeemRecoveryKey = createServerFn({ method: 'POST' })
  .validator((data: unknown) => redeemSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const keyHash = hashPhrase(data.phrase)

    const { data: match, error } = (await admin
      .from('recovery_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .is('used_at', null)
      .maybeSingle()) as { data: RecoveryKeyRow | null; error: PgError }

    if (error) throw new Error(error.message)
    if (!match) throw new Error('Invalid or already-used recovery key.')

    const now = new Date().toISOString()

    const { error: markUsedError } = (await (
      admin.from('recovery_keys') as unknown as {
        update: (values: {
          used_at: string
        }) => { eq: (column: 'id', value: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .update({ used_at: now })
      .eq('id', match.id)) as { error: PgError }

    if (markUsedError) throw new Error(markUsedError.message)

    const { error: profileError } = (await (
      admin.from('profiles') as unknown as {
        update: (values: {
          last_check_in_at: string
          last_reminder_tier: null
        }) => { eq: (column: 'id', value: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .update({ last_check_in_at: now, last_reminder_tier: null })
      .eq('id', match.user_id)) as { error: PgError }

    if (profileError) throw new Error(profileError.message)

    const { error: checkinError } = (await (
      admin.from('checkins') as unknown as {
        insert: (values: {
          user_id: string
          method: 'recovery_key'
          checked_in_at: string
        }) => PromiseLike<{ error: PgError }>
      }
    ).insert({ user_id: match.user_id, method: 'recovery_key', checked_in_at: now })) as {
      error: PgError
    }

    if (checkinError) throw new Error(checkinError.message)
  })

import type { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database, VaultKeyRow } from '@/lib/supabase/types'
import { wrapKeyForEscrow } from './escrow'
import {
  generateRawVaultKey,
  generateSaltB64,
  importVaultKey,
  unwrapVaultKeyWithPassword,
  wrapVaultKeyWithPassword,
} from './vault-key'
import { setVaultKey } from './session-key'

type SupabaseBrowserClient = ReturnType<typeof getSupabaseBrowserClient>

// See the note in src/lib/vault/items.ts — @supabase/supabase-js@2.112.4's
// generic inference currently resolves table types to `never` for this
// Database type (a live upstream bug), so writes need the same manual
// query-builder re-typing used there.
type PgError = { message: string } | null

// Call right after signInWithPassword/signUp succeeds, while the plaintext
// password is still in hand. Generates the per-user salt and vault_keys
// row on first use — see supabase/migrations/20260907000000_vault_key_escrow.sql
// for why the vault key is now random-and-wrapped rather than derived
// directly from the password.
export async function ensureVaultKeyFromPassword(supabase: SupabaseBrowserClient, password: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let salt = user.user_metadata?.encryption_salt as string | undefined
  if (!salt) {
    salt = generateSaltB64()
    const { error } = await supabase.auth.updateUser({ data: { encryption_salt: salt } })
    if (error) throw new Error(error.message)
  }

  const { data: existing } = (await supabase
    .from('vault_keys')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()) as { data: VaultKeyRow | null; error: PgError }

  let rawKey: Uint8Array<ArrayBuffer>

  if (existing) {
    rawKey = await unwrapVaultKeyWithPassword(existing.wrapped_by_password, password, salt)
  } else {
    rawKey = generateRawVaultKey()
    const insertPayload: Database['public']['Tables']['vault_keys']['Insert'] = {
      user_id: user.id,
      wrapped_by_password: await wrapVaultKeyWithPassword(rawKey, password, salt),
      wrapped_by_escrow: await wrapKeyForEscrow(rawKey),
    }
    const { error } = (await (
      supabase.from('vault_keys') as unknown as {
        insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
      }
    ).insert(insertPayload)) as { error: PgError }
    if (error) throw new Error(error.message)
  }

  const key = await importVaultKey(rawKey)
  setVaultKey(key)
  return key
}

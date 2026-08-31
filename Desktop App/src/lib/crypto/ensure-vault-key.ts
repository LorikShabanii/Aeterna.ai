import type { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { deriveVaultKey, generateSaltB64 } from './vault-key'
import { setVaultKey } from './session-key'

type SupabaseBrowserClient = ReturnType<typeof getSupabaseBrowserClient>

// Call right after signInWithPassword/signUp succeeds, while the plaintext
// password is still in hand. Generates the per-user salt on first use
// (stored in auth user_metadata — not secret, just makes the key
// re-derivable from the same password on any device).
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

  const key = await deriveVaultKey(password, salt)
  setVaultKey(key)
  return key
}

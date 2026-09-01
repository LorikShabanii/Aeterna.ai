import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Database, VaultItemRow } from '@/lib/supabase/types'

// @supabase/supabase-js@2.112.4's generic inference currently resolves the
// table type to `never` for this (correctly-shaped, __InternalSupabase-
// tagged) Database type — a live upstream bug, not specific to our schema.
// Reads degrade silently (never `data`, no compiler error); writes fail
// loudly since a literal argument can't satisfy a `never` parameter. The
// casts below re-assert the real shape at the query-builder boundary so our
// own code stays properly typed regardless. Revisit once upstream fixes it.
type PgError = { message: string } | null

export const listVaultItems = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // RLS (vault_items_select_own) scopes this to the current user regardless,
  // but filtering explicitly keeps the query's intent self-evident.
  const { data, error } = (await supabase
    .from('vault_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })) as { data: VaultItemRow[] | null; error: PgError }

  if (error) throw new Error(error.message)

  return (data ?? []).map(
    ({ id, type, title, category, encrypted_payload, encrypted_file_url, created_at }) => ({
      id,
      type,
      title,
      category,
      encrypted_payload,
      encrypted_file_url,
      created_at,
    }),
  )
})

async function insertVaultItem(insertPayload: Database['public']['Tables']['vault_items']['Insert']) {
  const supabase = getSupabaseServerClient()
  const { error } = (await (
    supabase.from('vault_items') as unknown as {
      insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
    }
  ).insert(insertPayload)) as { error: PgError }

  if (error) throw new Error(error.message)
}

// Matches CLAUDE.md's data model examples ('personal', 'financial',
// 'land_succession') — land/succession items are just vault_items with
// this category, no separate schema, per that same section.
export const VAULT_ITEM_CATEGORIES = ['personal', 'financial', 'land_succession'] as const
const categorySchema = z.enum(VAULT_ITEM_CATEGORIES).nullish()

const createLetterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  // encryptedPayload is produced client-side (see src/lib/crypto/vault-key.ts) —
  // the server only ever stores/returns ciphertext, never plaintext.
  encryptedPayload: z.string().min(1),
  category: categorySchema,
})

export const createLetter = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createLetterSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    await insertVaultItem({
      user_id: user.id,
      type: 'letter',
      title: data.title,
      encrypted_payload: data.encryptedPayload,
      category: data.category ?? null,
    })
  })

const createFileItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['document', 'photo', 'video']),
  // Path of the already-uploaded, already-encrypted object in the
  // 'vault-files' Storage bucket (see src/routes/_authed/vault.tsx) —
  // the file's bytes never pass through the server.
  storagePath: z.string().min(1),
  category: categorySchema,
})

export const createFileItem = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createFileItemSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    await insertVaultItem({
      user_id: user.id,
      type: data.type,
      title: data.title,
      encrypted_file_url: data.storagePath,
      category: data.category ?? null,
    })
  })

const deleteVaultItemSchema = z.object({
  id: z.string().uuid(),
  storagePath: z.string().nullish(),
})

export const deleteVaultItem = createServerFn({ method: 'POST' })
  .validator((data: unknown) => deleteVaultItemSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    if (data.storagePath) {
      const { error: storageError } = await supabase.storage
        .from('vault-files')
        .remove([data.storagePath])
      if (storageError) throw new Error(storageError.message)
    }

    const { error } = (await (
      supabase.from('vault_items') as unknown as {
        delete: () => { eq: (column: 'id', value: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .delete()
      .eq('id', data.id)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

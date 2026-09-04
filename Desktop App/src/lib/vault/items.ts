import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { generateToken, getAppUrl, hashToken } from '@/lib/tokens'
import type { Database, VaultItemRow, VaultItemWitnessRow } from '@/lib/supabase/types'

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
    ({
      id,
      type,
      title,
      category,
      encrypted_payload,
      encrypted_file_url,
      content_hash,
      captured_at,
      created_at,
    }) => ({
      id,
      type,
      title,
      category,
      encrypted_payload,
      encrypted_file_url,
      content_hash,
      captured_at,
      created_at,
    }),
  )
})

async function insertVaultItem(
  insertPayload: Database['public']['Tables']['vault_items']['Insert'],
): Promise<string> {
  const supabase = getSupabaseServerClient()
  const { data, error } = (await (
    supabase.from('vault_items') as unknown as {
      insert: (values: typeof insertPayload) => {
        select: (columns: 'id') => { single: () => PromiseLike<{ data: { id: string } | null; error: PgError }> }
      }
    }
  )
    .insert(insertPayload)
    .select('id')
    .single()) as { data: { id: string } | null; error: PgError }

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Insert did not return an id')
  return data.id
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

// Up to 2 people present at recording time (docs/roadmap-differentiation-
// features.md > Feature 4) — witnessedAt is the SAME client timestamp as
// the video's own capturedAt above, not a separate one, since the whole
// point is that they were there at that moment. The witness confirms
// themselves asynchronously by email (see src/lib/vault/witnesses.ts) —
// the owner no longer checks a consent box on their behalf.
const witnessSchema = z.object({
  name: z.string().min(1, 'Witness name is required'),
  contact: z.string().min(1, 'Witness contact is required'),
})

const createFileItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['document', 'photo', 'video']),
  // Path of the already-uploaded, already-encrypted object in the
  // 'vault-files' Storage bucket (see src/routes/_authed/vault.tsx) —
  // the file's bytes never pass through the server.
  storagePath: z.string().min(1),
  category: categorySchema,
  // SHA-256 of the raw file and the moment it was selected, both computed
  // client-side before encryption (src/lib/crypto/vault-key.ts#hashFile) —
  // see docs/roadmap-differentiation-features.md > Feature 1.
  contentHash: z.string().length(64),
  capturedAt: z.string().datetime(),
  witnesses: z.array(witnessSchema).max(2).default([]),
})

export const createFileItem = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createFileItemSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const vaultItemId = await insertVaultItem({
      user_id: user.id,
      type: data.type,
      title: data.title,
      encrypted_file_url: data.storagePath,
      category: data.category ?? null,
      content_hash: data.contentHash,
      captured_at: data.capturedAt,
    })

    if (data.witnesses.length > 0) {
      const witnessesWithTokens = data.witnesses.map((w) => ({
        ...w,
        token: generateToken(),
      }))

      const witnessPayload: Database['public']['Tables']['vault_item_witnesses']['Insert'][] =
        witnessesWithTokens.map((w) => ({
          vault_item_id: vaultItemId,
          name: w.name,
          contact: w.contact,
          witnessed_at: data.capturedAt,
          token_hash: hashToken(w.token),
          status: 'pending',
        }))

      const { error } = (await (
        supabase.from('vault_item_witnesses') as unknown as {
          insert: (values: typeof witnessPayload) => PromiseLike<{ error: PgError }>
        }
      ).insert(witnessPayload)) as { error: PgError }

      if (error) throw new Error(error.message)

      // Best-effort — a delivery failure here shouldn't roll back an
      // otherwise-successful upload; the owner can still see the witness
      // sitting in 'pending' status on the item card.
      await Promise.allSettled(
        witnessesWithTokens.map((w) =>
          sendEmail(
            w.contact,
            `You were named as a witness — "${data.title}"`,
            `${w.name}, you're being named as a witness to "${data.title}" on Aeterna, ` +
              `a digital legacy vault.\n\n` +
              `If you were actually present for this, please confirm here:\n` +
              `${getAppUrl()}/witness/${w.token}\n\n` +
              `If you don't recognize this, you can ignore this email.`,
          ),
        ),
      )
    }
  })

// Every witness row for items the current user owns — RLS
// (vault_item_witnesses_select_own) already scopes this; the client
// groups rows by vault_item_id locally, same pattern as
// listVaultItemRecipients.
export const listVaultItemWitnesses = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const { data, error } = (await supabase.from('vault_item_witnesses').select('*')) as {
    data: VaultItemWitnessRow[] | null
    error: PgError
  }

  if (error) throw new Error(error.message)
  return data ?? []
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

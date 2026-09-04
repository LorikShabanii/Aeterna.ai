import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/tokens'
import type { Database, VaultItemWitnessRow } from '@/lib/supabase/types'

// See the note in src/lib/vault/items.ts — @supabase/supabase-js@2.112.4's
// generic inference currently resolves table types to `never` for this
// Database type (a live upstream bug), so writes need the same manual
// query-builder re-typing used there.
type PgError = { message: string } | null

// Fixed attestation text the witness agrees to by confirming — replaces
// the free-text consentText the owner used to fill in on their behalf
// (docs/roadmap-differentiation-features.md > Feature 4 revision).
const WITNESS_CONFIRM_TEXT = 'I confirm I was present and witnessed this recording.'

async function getWitnessByToken(admin: ReturnType<typeof getSupabaseAdminClient>, token: string) {
  const { data: witness, error } = (await admin
    .from('vault_item_witnesses')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle()) as { data: VaultItemWitnessRow | null; error: PgError }

  if (error) throw new Error(error.message)
  if (!witness) throw new Error('This link is invalid or has expired.')
  return witness
}

const getByTokenSchema = z.object({ token: z.string().min(1) })

export const getWitnessInvite = createServerFn({ method: 'GET' })
  .validator((data: unknown) => getByTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const witness = await getWitnessByToken(admin, data.token)

    const { data: item } = (await admin
      .from('vault_items')
      .select('title')
      .eq('id', witness.vault_item_id)
      .maybeSingle()) as { data: { title: string } | null }

    return {
      itemTitle: item?.title ?? 'a vault item',
      witnessName: witness.name,
      witnessedAt: witness.witnessed_at,
      status: witness.status,
    }
  })

// Witness-submitted photos can't go through the client-side-encrypt-before-
// upload pattern the rest of the vault uses — the witness confirming via
// this public link has no session and no access to the owner's vault key.
// Kept small and image-only since this is an unauthenticated write path.
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const confirmWitnessSchema = z.object({
  token: z.string().min(1),
  photoDataUrl: z.string().optional(),
})

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Invalid photo data')
  const [, mimeType, base64] = match
  if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) {
    throw new Error('Photo must be a JPEG, PNG, or WEBP image')
  }
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error('Photo is too large (max 8MB)')
  }
  return { mimeType, bytes: new Uint8Array(bytes) }
}

export const confirmWitness = createServerFn({ method: 'POST' })
  .validator((data: unknown) => confirmWitnessSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const witness = await getWitnessByToken(admin, data.token)

    if (witness.status === 'confirmed') return { alreadyConfirmed: true }

    const { data: item } = (await admin
      .from('vault_items')
      .select('user_id')
      .eq('id', witness.vault_item_id)
      .maybeSingle()) as { data: { user_id: string } | null }
    if (!item) throw new Error('Vault item not found')

    let photoUrl: string | null = null
    if (data.photoDataUrl) {
      const { mimeType, bytes } = parseDataUrl(data.photoDataUrl)
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
      const path = `${item.user_id}/${witness.id}/photo.${extension}`

      const { error: uploadError } = await admin.storage
        .from('witness-photos')
        .upload(path, bytes, { contentType: mimeType, upsert: true })
      if (uploadError) throw new Error(uploadError.message)

      photoUrl = path
    }

    const updatePayload: Database['public']['Tables']['vault_item_witnesses']['Update'] = {
      status: 'confirmed',
      consent_text: WITNESS_CONFIRM_TEXT,
      confirmed_at: new Date().toISOString(),
      photo_url: photoUrl,
    }
    const { error } = (await (
      admin.from('vault_item_witnesses') as unknown as {
        update: (values: typeof updatePayload) => { eq: (col: 'id', v: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .update(updatePayload)
      .eq('id', witness.id)) as { error: PgError }
    if (error) throw new Error(error.message)

    return { alreadyConfirmed: false }
  })

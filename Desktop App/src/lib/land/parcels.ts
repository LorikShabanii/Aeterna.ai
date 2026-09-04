import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Database, LandParcelRecipientRow, LandParcelRow } from '@/lib/supabase/types'

// See the note in src/lib/vault/items.ts — @supabase/supabase-js@2.112.4's
// generic inference currently resolves table types to `never` for this
// Database type (a live upstream bug), so writes need the same manual
// query-builder re-typing used there.
type PgError = { message: string } | null

export const listLandParcels = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = (await supabase
    .from('land_parcels')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })) as { data: LandParcelRow[] | null; error: PgError }

  if (error) throw new Error(error.message)
  return data ?? []
})

const createLandParcelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // Paths of already-uploaded, already-encrypted objects in the
  // 'vault-files' Storage bucket — the same client-side-encrypt-before-
  // upload pattern as vault_items files (src/routes/_authed/land.tsx).
  photoPaths: z.array(z.string().min(1)).default([]),
  // Which CadastralProvider ran (src/lib/land/providers) and what it
  // found — see docs/roadmap-differentiation-features.md > Feature 2.
  countryCode: z.string().length(2).nullish(),
  cadastralReference: z.string().nullish(),
  source: z.enum(['official_cadastre', 'official_cadastre_visual', 'manual_pin']),
})

export const createLandParcel = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createLandParcelSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const insertPayload: Database['public']['Tables']['land_parcels']['Insert'] = {
      user_id: user.id,
      name: data.name,
      geo_boundary: { type: 'point', lat: data.lat, lng: data.lng },
      photo_urls: data.photoPaths,
      country_code: data.countryCode ?? null,
      cadastral_reference: data.cadastralReference ?? null,
      source: data.source,
    }

    const { error } = (await (
      supabase.from('land_parcels') as unknown as {
        insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
      }
    ).insert(insertPayload)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

const deleteLandParcelSchema = z.object({
  id: z.string().uuid(),
  photoPaths: z.array(z.string()).default([]),
})

export const deleteLandParcel = createServerFn({ method: 'POST' })
  .validator((data: unknown) => deleteLandParcelSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    if (data.photoPaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('vault-files').remove(data.photoPaths)
      if (storageError) throw new Error(storageError.message)
    }

    const { error } = (await (
      supabase.from('land_parcels') as unknown as {
        delete: () => { eq: (column: 'id', value: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .delete()
      .eq('id', data.id)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

// Every land_parcel -> recipient link the current user owns. RLS
// (land_parcel_recipients_select_own) already scopes this to their own
// parcels; the client groups rows by land_parcel_id locally.
export const listLandParcelRecipients = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const { data, error } = (await supabase.from('land_parcel_recipients').select('*')) as {
    data: LandParcelRecipientRow[] | null
    error: PgError
  }

  if (error) throw new Error(error.message)
  return data ?? []
})

const assignLandParcelRecipientSchema = z.object({
  landParcelId: z.string().uuid(),
  recipientId: z.string().uuid(),
})

export const assignLandParcelRecipient = createServerFn({ method: 'POST' })
  .validator((data: unknown) => assignLandParcelRecipientSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    const insertPayload: Database['public']['Tables']['land_parcel_recipients']['Insert'] = {
      land_parcel_id: data.landParcelId,
      recipient_id: data.recipientId,
    }

    const { error } = (await (
      supabase.from('land_parcel_recipients') as unknown as {
        insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
      }
    ).insert(insertPayload)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

export const unassignLandParcelRecipient = createServerFn({ method: 'POST' })
  .validator((data: unknown) => assignLandParcelRecipientSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    const { error } = (await (
      supabase.from('land_parcel_recipients') as unknown as {
        delete: () => {
          eq: (
            column: 'land_parcel_id',
            value: string,
          ) => { eq: (column: 'recipient_id', value: string) => PromiseLike<{ error: PgError }> }
        }
      }
    )
      .delete()
      .eq('land_parcel_id', data.landParcelId)
      .eq('recipient_id', data.recipientId)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

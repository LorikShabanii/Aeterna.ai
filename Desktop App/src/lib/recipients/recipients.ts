import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Database, RecipientRow, VaultItemRecipientRow } from '@/lib/supabase/types'

// See the note in src/lib/vault/items.ts — @supabase/supabase-js@2.112.4's
// generic inference currently resolves table types to `never` for this
// Database type (a live upstream bug), so writes need the same manual
// query-builder re-typing used there.
type PgError = { message: string } | null

export const listRecipients = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = (await supabase
    .from('recipients')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })) as { data: RecipientRow[] | null; error: PgError }

  if (error) throw new Error(error.message)
  return data ?? []
})

const createRecipientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact: z.string().min(1, 'Contact is required'),
})

export const createRecipient = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createRecipientSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const insertPayload: Database['public']['Tables']['recipients']['Insert'] = {
      user_id: user.id,
      name: data.name,
      contact: data.contact,
    }

    const { error } = (await (
      supabase.from('recipients') as unknown as {
        insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
      }
    ).insert(insertPayload)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

const deleteRecipientSchema = z.object({ id: z.string().uuid() })

export const deleteRecipient = createServerFn({ method: 'POST' })
  .validator((data: unknown) => deleteRecipientSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const { error } = (await (
      supabase.from('recipients') as unknown as {
        delete: () => { eq: (column: 'id', value: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .delete()
      .eq('id', data.id)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

// Every vault_item -> recipient link the current user owns. RLS
// (vault_item_recipients_select_own) already scopes this to their own
// items; the client groups rows by vault_item_id locally.
export const listVaultItemRecipients = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const { data, error } = (await supabase.from('vault_item_recipients').select('*')) as {
    data: VaultItemRecipientRow[] | null
    error: PgError
  }

  if (error) throw new Error(error.message)
  return data ?? []
})

const assignRecipientSchema = z.object({
  vaultItemId: z.string().uuid(),
  recipientId: z.string().uuid(),
})

export const assignRecipient = createServerFn({ method: 'POST' })
  .validator((data: unknown) => assignRecipientSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    const insertPayload: Database['public']['Tables']['vault_item_recipients']['Insert'] = {
      vault_item_id: data.vaultItemId,
      recipient_id: data.recipientId,
    }

    const { error } = (await (
      supabase.from('vault_item_recipients') as unknown as {
        insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
      }
    ).insert(insertPayload)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

export const unassignRecipient = createServerFn({ method: 'POST' })
  .validator((data: unknown) => assignRecipientSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    const { error } = (await (
      supabase.from('vault_item_recipients') as unknown as {
        delete: () => {
          eq: (
            column: 'vault_item_id',
            value: string,
          ) => { eq: (column: 'recipient_id', value: string) => PromiseLike<{ error: PgError }> }
        }
      }
    )
      .delete()
      .eq('vault_item_id', data.vaultItemId)
      .eq('recipient_id', data.recipientId)) as { error: PgError }

    if (error) throw new Error(error.message)
  })

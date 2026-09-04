import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { generateToken, getAppUrl, hashToken } from '@/lib/tokens'
import type { Database, NotarizationRequestRow } from '@/lib/supabase/types'

// See the note in src/lib/vault/items.ts — @supabase/supabase-js@2.112.4's
// generic inference currently resolves table types to `never` for this
// Database type (a live upstream bug), so writes need the same manual
// query-builder re-typing used there.
type PgError = { message: string } | null

// Stub for MVP (docs/roadmap-differentiation-features.md > Feature 3): a
// real local notary/lawyer partner API can be swapped in later by adding
// a new NotaryPartner implementation and changing getNotaryPartner() below
// — requestNotarization() and the UI never need to change. TODO in
// CLAUDE.md tracks swapping this for a real e-signature provider — what's
// built now is a lightweight "click to confirm" link, not a legally
// binding signature.
interface NotarizationRequest {
  itemTitle: string
  requesterName: string
  requesterContact: string
  note: string
  confirmUrl: string
}

interface NotaryPartner {
  submitRequest(request: NotarizationRequest): Promise<void>
}

const emailStubPartner: NotaryPartner = {
  async submitRequest(request) {
    // No dedicated notary inbox configured yet — falls back to the same
    // account that already sends check-in reminders and OTPs, so this
    // works without a new required env var. Set NOTARY_INTAKE_EMAIL once
    // there's a real intake address to route these to instead.
    const to = process.env.NOTARY_INTAKE_EMAIL || process.env.SMTP_USER
    if (!to) {
      throw new Error('Missing NOTARY_INTAKE_EMAIL or SMTP_USER — set one in .env')
    }
    await sendEmail(
      to,
      `Notarization request — "${request.itemTitle}"`,
      `A notarization request was submitted for the vault item "${request.itemTitle}".\n\n` +
        `Name: ${request.requesterName}\n` +
        `Contact: ${request.requesterContact}\n\n` +
        `Note:\n${request.note || '(none)'}\n\n` +
        `Confirm you've received this: ${request.confirmUrl}`,
    )
  },
}

function getNotaryPartner(): NotaryPartner {
  return emailStubPartner
}

const requestNotarizationSchema = z.object({
  vaultItemId: z.string().uuid(),
  requesterName: z.string().min(1, 'Name is required'),
  requesterContact: z.string().min(1, 'Contact is required'),
  note: z.string().max(2000).default(''),
})

export const requestNotarization = createServerFn({ method: 'POST' })
  .validator((data: unknown) => requestNotarizationSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Don't trust a client-supplied title — this endpoint sends email on
    // the user's behalf, so confirm the item is actually theirs and read
    // its real title server-side rather than taking it as an argument.
    const { data: item, error: itemError } = (await supabase
      .from('vault_items')
      .select('id, title')
      .eq('id', data.vaultItemId)
      .eq('user_id', user.id)
      .maybeSingle()) as { data: { id: string; title: string } | null; error: PgError }
    if (itemError) throw new Error(itemError.message)
    if (!item) throw new Error('Vault item not found')

    const token = generateToken()
    const insertPayload: Database['public']['Tables']['notarization_requests']['Insert'] = {
      vault_item_id: item.id,
      user_id: user.id,
      requester_name: data.requesterName,
      requester_contact: data.requesterContact,
      note: data.note,
      token_hash: hashToken(token),
    }

    const { error } = (await (
      supabase.from('notarization_requests') as unknown as {
        insert: (values: typeof insertPayload) => PromiseLike<{ error: PgError }>
      }
    ).insert(insertPayload)) as { error: PgError }
    if (error) throw new Error(error.message)

    await getNotaryPartner().submitRequest({
      itemTitle: item.title,
      requesterName: data.requesterName,
      requesterContact: data.requesterContact,
      note: data.note,
      confirmUrl: `${getAppUrl()}/notarize/${token}`,
    })
  })

// Every notarization request for items the current user owns — RLS
// (notarization_requests_select_own) already scopes this; the client
// groups rows by vault_item_id locally, same pattern as
// listVaultItemRecipients/listVaultItemWitnesses.
export const listNotarizationRequests = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const { data, error } = (await supabase.from('notarization_requests').select('*')) as {
    data: NotarizationRequestRow[] | null
    error: PgError
  }

  if (error) throw new Error(error.message)
  return data ?? []
})

async function getRequestByToken(admin: ReturnType<typeof getSupabaseAdminClient>, token: string) {
  const { data: request, error } = (await admin
    .from('notarization_requests')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle()) as { data: NotarizationRequestRow | null; error: PgError }

  if (error) throw new Error(error.message)
  if (!request) throw new Error('This link is invalid or has expired.')
  return request
}

const getByTokenSchema = z.object({ token: z.string().min(1) })

export const getNotarizationRequestInfo = createServerFn({ method: 'GET' })
  .validator((data: unknown) => getByTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const request = await getRequestByToken(admin, data.token)

    const { data: item } = (await admin
      .from('vault_items')
      .select('title')
      .eq('id', request.vault_item_id)
      .maybeSingle()) as { data: { title: string } | null }

    return {
      itemTitle: item?.title ?? 'a vault item',
      requesterName: request.requester_name,
      status: request.status,
    }
  })

export const confirmNotarizationRequest = createServerFn({ method: 'POST' })
  .validator((data: unknown) => getByTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const request = await getRequestByToken(admin, data.token)

    if (request.status === 'confirmed') return { alreadyConfirmed: true }

    const updatePayload: Database['public']['Tables']['notarization_requests']['Update'] = {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }
    const { error } = (await (
      admin.from('notarization_requests') as unknown as {
        update: (values: typeof updatePayload) => { eq: (col: 'id', v: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .update(updatePayload)
      .eq('id', request.id)) as { error: PgError }
    if (error) throw new Error(error.message)

    return { alreadyConfirmed: false }
  })

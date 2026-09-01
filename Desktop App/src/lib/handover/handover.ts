import { createServerFn } from '@tanstack/react-start'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import type { HandoverRow, RecipientRow, VaultItemRow } from '@/lib/supabase/types'

// Public, no-login (src/routes/handover.$token.tsx) — the token itself is
// the credential, same pattern as recovery-key redemption. The vault key
// needed to decrypt what's returned here never passes through this
// function — it rides in the email link's URL fragment instead (see
// supabase/functions/heartbeat-cron and supabase/migrations/20260907000000_vault_key_escrow.sql).
type PgError = { message: string } | null

function hashValue(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex')
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!domain || local.length <= 2) return email
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`
}

async function getHandoverByToken(admin: ReturnType<typeof getSupabaseAdminClient>, token: string) {
  const { data: handover, error } = (await admin
    .from('handovers')
    .select('*')
    .eq('token_hash', hashValue(token))
    .maybeSingle()) as { data: HandoverRow | null; error: PgError }

  if (error) throw new Error(error.message)
  if (!handover) throw new Error('This link is invalid or has expired.')
  return handover
}

const getHandoverInfoSchema = z.object({ token: z.string().min(1) })

export interface HandoverItem {
  title: string
  type: VaultItemRow['type']
  category: string | null
  encryptedPayload: string | null
  downloadUrl: string | null
  // The real filename (with extension) — encoded as the storage path's
  // last segment, same trick used on the owner's own vault page. Without
  // it, a downloaded file has nothing to tell the OS what it is and looks
  // like garbled text when opened (the exact bug already fixed once here).
  fileName: string | null
}

export const getHandoverInfo = createServerFn({ method: 'GET' })
  .validator((data: unknown) => getHandoverInfoSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const handover = await getHandoverByToken(admin, data.token)

    const { data: recipient } = (await admin
      .from('recipients')
      .select('*')
      .eq('id', handover.recipient_id)
      .maybeSingle()) as { data: RecipientRow | null; error: PgError }

    const { data: owner } = await admin.auth.admin.getUserById(handover.user_id)

    const { data: links } = (await admin
      .from('vault_item_recipients')
      .select('vault_item_id')
      .eq('recipient_id', handover.recipient_id)) as { data: { vault_item_id: string }[] | null }

    const itemIds = (links ?? []).map((l) => l.vault_item_id)
    const items: HandoverItem[] = []

    if (itemIds.length > 0) {
      const { data: rows } = (await admin
        .from('vault_items')
        .select('*')
        .in('id', itemIds)
        .eq('user_id', handover.user_id)) as { data: VaultItemRow[] | null }

      for (const row of rows ?? []) {
        let downloadUrl: string | null = null
        let fileName: string | null = null
        if (row.encrypted_file_url) {
          // Owner-only Storage RLS means a signed URL is the only way a
          // recipient (no session at all) can fetch the encrypted bytes.
          const { data: signed } = await admin.storage
            .from('vault-files')
            .createSignedUrl(row.encrypted_file_url, 60 * 10)
          downloadUrl = signed?.signedUrl ?? null
          fileName = row.encrypted_file_url.split('/').pop() ?? null
        }
        items.push({
          title: row.title,
          type: row.type,
          category: row.category,
          encryptedPayload: row.encrypted_payload,
          downloadUrl,
          fileName,
        })
      }
    }

    return {
      recipientName: recipient?.name ?? 'there',
      ownerEmail: owner?.user?.email ?? 'someone',
      maskedContact: recipient ? maskEmail(recipient.contact) : null,
      items,
    }
  })

const sendOtpSchema = z.object({ token: z.string().min(1) })

// Stubbed identity verification (CLAUDE.md build order step 7) — proves
// *current* access to the recipient's inbox, on top of the token proving
// they received the original email. See the migration for why this is on
// top of, not instead of, the token itself.
export const sendHandoverOtp = createServerFn({ method: 'POST' })
  .validator((data: unknown) => sendOtpSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const handover = await getHandoverByToken(admin, data.token)

    const { data: recipient } = (await admin
      .from('recipients')
      .select('*')
      .eq('id', handover.recipient_id)
      .maybeSingle()) as { data: RecipientRow | null; error: PgError }
    if (!recipient) throw new Error('Recipient not found.')

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const updatePayload = {
      otp_hash: hashValue(code),
      otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      otp_attempts: 0,
    }

    const { error } = (await (
      admin.from('handovers') as unknown as {
        update: (values: typeof updatePayload) => { eq: (col: 'id', v: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .update(updatePayload)
      .eq('id', handover.id)) as { error: PgError }
    if (error) throw new Error(error.message)

    await sendEmail(
      recipient.contact,
      'Aeterna — your verification code',
      `Your verification code is ${code}. It expires in 10 minutes.`,
    )

    return { maskedContact: maskEmail(recipient.contact) }
  })

const verifyOtpSchema = z.object({ token: z.string().min(1), code: z.string().min(1) })

export const verifyHandoverOtp = createServerFn({ method: 'POST' })
  .validator((data: unknown) => verifyOtpSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()
    const handover = await getHandoverByToken(admin, data.token)

    if (!handover.otp_hash || !handover.otp_expires_at) {
      throw new Error('Request a code first.')
    }
    if (new Date(handover.otp_expires_at).getTime() < Date.now()) {
      throw new Error('That code expired — request a new one.')
    }
    if (handover.otp_attempts >= 5) {
      throw new Error('Too many attempts — request a new code.')
    }

    if (hashValue(data.code) !== handover.otp_hash) {
      const { error } = (await (
        admin.from('handovers') as unknown as {
          update: (values: {
            otp_attempts: number
          }) => { eq: (col: 'id', v: string) => PromiseLike<{ error: PgError }> }
        }
      )
        .update({ otp_attempts: handover.otp_attempts + 1 })
        .eq('id', handover.id)) as { error: PgError }
      if (error) throw new Error(error.message)
      throw new Error('Incorrect code.')
    }

    // Consumed — a code can't be reused once it's worked.
    const { error } = (await (
      admin.from('handovers') as unknown as {
        update: (values: {
          otp_hash: null
          otp_expires_at: null
          otp_attempts: number
        }) => { eq: (col: 'id', v: string) => PromiseLike<{ error: PgError }> }
      }
    )
      .update({ otp_hash: null, otp_expires_at: null, otp_attempts: 0 })
      .eq('id', handover.id)) as { error: PgError }
    if (error) throw new Error(error.message)

    return { verified: true }
  })

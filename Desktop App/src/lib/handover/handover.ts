import { createServerFn } from '@tanstack/react-start'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { HandoverRow, RecipientRow, VaultItemRow } from '@/lib/supabase/types'

// Public, no-login (src/routes/handover.$token.tsx) — the token itself is
// the credential, same pattern as recovery-key redemption. The vault key
// needed to decrypt what's returned here never passes through this
// function — it rides in the email link's URL fragment instead (see
// supabase/functions/heartbeat-cron and supabase/migrations/20260907000000_vault_key_escrow.sql).
type PgError = { message: string } | null

function hashToken(token: string) {
  return createHash('sha256').update(token.trim()).digest('hex')
}

const getHandoverInfoSchema = z.object({ token: z.string().min(1) })

export interface HandoverItem {
  title: string
  type: VaultItemRow['type']
  category: string | null
  encryptedPayload: string | null
  downloadUrl: string | null
}

export const getHandoverInfo = createServerFn({ method: 'GET' })
  .validator((data: unknown) => getHandoverInfoSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdminClient()

    const { data: handover, error } = (await admin
      .from('handovers')
      .select('*')
      .eq('token_hash', hashToken(data.token))
      .maybeSingle()) as { data: HandoverRow | null; error: PgError }

    if (error) throw new Error(error.message)
    if (!handover) throw new Error('This link is invalid or has expired.')

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
        if (row.encrypted_file_url) {
          // Owner-only Storage RLS means a signed URL is the only way a
          // recipient (no session at all) can fetch the encrypted bytes.
          const { data: signed } = await admin.storage
            .from('vault-files')
            .createSignedUrl(row.encrypted_file_url, 60 * 10)
          downloadUrl = signed?.signedUrl ?? null
        }
        items.push({
          title: row.title,
          type: row.type,
          category: row.category,
          encryptedPayload: row.encrypted_payload,
          downloadUrl,
        })
      }
    }

    return {
      recipientName: recipient?.name ?? 'there',
      ownerEmail: owner?.user?.email ?? 'someone',
      items,
    }
  })

import { createServerFn } from '@tanstack/react-start'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { HandoverRow, RecipientRow, VaultItemRow } from '@/lib/supabase/types'

// Public, no-login (src/routes/handover.$token.tsx) — the token itself is
// the credential, same pattern as recovery-key redemption. Deliberately
// shows only titles/type, never encrypted_payload/encrypted_file_url —
// there is no way to decrypt on the recipient's behalf yet (see the note
// in supabase/migrations/20260906000000_handover.sql).
type PgError = { message: string } | null

function hashToken(token: string) {
  return createHash('sha256').update(token.trim()).digest('hex')
}

const getHandoverInfoSchema = z.object({ token: z.string().min(1) })

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
    let items: Pick<VaultItemRow, 'title' | 'type' | 'category'>[] = []
    if (itemIds.length > 0) {
      const { data } = (await admin
        .from('vault_items')
        .select('*')
        .in('id', itemIds)
        .eq('user_id', handover.user_id)) as { data: VaultItemRow[] | null }
      items = (data ?? []).map(({ title, type, category }) => ({ title, type, category }))
    }

    return {
      recipientName: recipient?.name ?? 'there',
      ownerEmail: owner?.user?.email ?? 'someone',
      items,
    }
  })

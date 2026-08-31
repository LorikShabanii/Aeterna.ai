// Escalation cron (CLAUDE.md > Escalation timeline). Invoked hourly by
// pg_cron via pg_net (see supabase/migrations/20260905000000_heartbeat_escalation.sql).
// Deno runtime (Supabase Edge Functions), not Node — separate from the rest
// of this app.
//
// Tiers = days overdue past the check-in due date: 0 / 2 / 5 / 7+, matching
// Day 0 / +2 / +5 / +7. Day +7 only emails the account owner a final
// notice — it does NOT contact recipients or deliver the vault. Recipients
// are never notified before the Handover portal exists (a separate, later
// build step) per CLAUDE.md's "recipients are not confirmers" note.

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'

interface Profile {
  id: string
  check_in_frequency_days: number
  last_check_in_at: string
  last_reminder_tier: number | null
}

const TIERS = [7, 5, 2, 0] as const // checked highest-first so we pick the furthest-along tier that applies

function tierForDaysOverdue(daysOverdue: number): number | null {
  for (const tier of TIERS) {
    if (daysOverdue >= tier) return tier
  }
  return null
}

function subjectAndBody(tier: number, checkInUrl: string, recoverUrl: string) {
  switch (tier) {
    case 0:
      return {
        subject: 'Aeterna — you missed a check-in',
        body: `We didn't see a check-in from you when expected. Nothing has happened yet — just tap in when you get a chance: ${checkInUrl}`,
      }
    case 2:
      return {
        subject: 'Aeterna — second reminder to check in',
        body: `Still no check-in. Everything is fine for now, but please check in soon: ${checkInUrl}`,
      }
    case 5:
      return {
        subject: 'Aeterna — final warning before delivery',
        body: `This is the last reminder before your vault's delivery countdown runs out.\n\nCheck in now: ${checkInUrl}\n\nIf you can't access your usual device, your recovery key can push back the deadline without needing to sign in: ${recoverUrl}`,
      }
    default:
      return {
        subject: 'Aeterna — delivery countdown has ended',
        body: `The check-in window has fully elapsed. (Note: automatic delivery to recipients is not yet implemented — this is a notice to you only.)`,
      }
  }
}

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret && req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, check_in_frequency_days, last_check_in_at, last_reminder_tier')

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_APP_PASSWORD'),
      },
    })

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
    const from = Deno.env.get('SMTP_USER')!
    let sent = 0

    for (const profile of (profiles ?? []) as Profile[]) {
      const dueAt =
        new Date(profile.last_check_in_at).getTime() +
        profile.check_in_frequency_days * 24 * 60 * 60 * 1000
      const daysOverdue = Math.floor((Date.now() - dueAt) / (24 * 60 * 60 * 1000))

      const tier = tierForDaysOverdue(daysOverdue)
      if (tier === null || tier === profile.last_reminder_tier) continue

      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
      const email = authUser?.user?.email
      if (!email) continue

      const { subject, body } = subjectAndBody(tier, `${appUrl}/vault`, `${appUrl}/recover`)

      try {
        await transport.sendMail({ from, to: email, subject, text: body })
        sent += 1
      } catch (sendErr) {
        console.error(`Failed to email ${profile.id} at tier ${tier}:`, sendErr)
        continue
      }

      await supabase.from('profiles').update({ last_reminder_tier: tier }).eq('id', profile.id)
    }

    return new Response(JSON.stringify({ checked: profiles?.length ?? 0, sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('heartbeat-cron failed:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

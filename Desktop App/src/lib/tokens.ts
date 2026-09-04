import { randomBytes, createHash } from 'node:crypto'

// Shared by every public, no-login link (Handover, and now notarization
// confirmation and witness confirmation) — the raw token only ever lives
// in the emailed URL; only its hash is ever persisted, same pattern as
// recovery_keys and handovers.token_hash.
export function generateToken(): string {
  return randomBytes(24).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

// Both link-generating code paths (this app's server functions, and the
// Deno heartbeat-cron edge function, which has its own separate APP_URL —
// see supabase/functions/heartbeat-cron/index.ts) fall back to the same
// localhost default, so dev links work without any .env setup.
export function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000'
}

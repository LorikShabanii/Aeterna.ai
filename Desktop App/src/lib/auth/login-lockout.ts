// Per-device brute-force brake on the sign-in form: after MAX_ATTEMPTS failed
// password attempts for a given email, that email can't be tried again from
// this device until LOCKOUT_MS has passed.
//
// Scope, deliberately: this is a *local* guard, kept in localStorage so it
// survives closing the app (an in-memory counter would reset on every
// restart, which defeats the point). It stops someone sitting at the machine
// guessing passwords — the realistic threat for a desktop vault. It is NOT a
// defence against a determined attacker, who can skip the UI entirely and
// call Supabase's auth endpoint directly with the publishable key that ships
// in every client bundle. Server-side brute-force limits belong in the
// Supabase dashboard (Authentication > Rate Limits); this is the local half.
const LOCKOUT_KEY = 'aeterna:login-lockout'

export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 30 * 60 * 1000

type LockoutRecord = {
  failures: number
  lockedUntil: number | null
}

type LockoutMap = Record<string, LockoutRecord>

// Supabase returns the same "Invalid login credentials" for an unknown email
// and a wrong password (deliberately — it avoids leaking which accounts
// exist), so failures are counted against whatever was typed in the field.
function normalize(email: string): string {
  return email.trim().toLowerCase()
}

function readMap(): LockoutMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LOCKOUT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as LockoutMap
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    // Corrupt or unreadable (private mode, cleared storage) — fail open
    // rather than bricking the login form for a legitimate user.
    return {}
  }
}

function writeMap(map: LockoutMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCKOUT_KEY, JSON.stringify(map))
  } catch {
    // Storage full or blocked — nothing useful to do; the form still works.
  }
}

// Drop records that are no longer doing anything so the map can't grow
// without bound as different emails get typed in.
function prune(map: LockoutMap, now: number): LockoutMap {
  const kept: LockoutMap = {}
  for (const [email, record] of Object.entries(map)) {
    if (record.lockedUntil && record.lockedUntil > now) kept[email] = record
    else if (!record.lockedUntil && record.failures > 0) kept[email] = record
  }
  return kept
}

export type LockoutState = {
  locked: boolean
  /** Milliseconds until the lock lifts; 0 when not locked. */
  remainingMs: number
  /** Attempts left before the next lock; 0 while locked. */
  attemptsLeft: number
}

const UNLOCKED: LockoutState = { locked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS }

export function getLockoutState(email: string, now: number = Date.now()): LockoutState {
  const key = normalize(email)
  if (!key) return UNLOCKED

  const record = readMap()[key]
  if (!record) return UNLOCKED

  if (record.lockedUntil && record.lockedUntil > now) {
    return { locked: true, remainingMs: record.lockedUntil - now, attemptsLeft: 0 }
  }

  // An expired lock means the window has passed — the next attempt starts
  // from a clean slate rather than re-locking on a single mistake.
  if (record.lockedUntil) return UNLOCKED

  return {
    locked: false,
    remainingMs: 0,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - record.failures),
  }
}

export function recordFailedLogin(email: string, now: number = Date.now()): LockoutState {
  const key = normalize(email)
  if (!key) return UNLOCKED

  const map = prune(readMap(), now)
  const previous = map[key]
  // Reset the count when a previous lock has already expired, so failures
  // from an old window don't stack onto the new one.
  const carried = previous && (!previous.lockedUntil || previous.lockedUntil > now) ? previous.failures : 0
  const failures = carried + 1

  const record: LockoutRecord =
    failures >= MAX_ATTEMPTS
      ? { failures, lockedUntil: now + LOCKOUT_MS }
      : { failures, lockedUntil: null }

  map[key] = record
  writeMap(map)

  return record.lockedUntil
    ? { locked: true, remainingMs: record.lockedUntil - now, attemptsLeft: 0 }
    : { locked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS - failures }
}

export function clearLoginFailures(email: string): void {
  const key = normalize(email)
  if (!key) return
  const map = readMap()
  if (!(key in map)) return
  delete map[key]
  writeMap(map)
}

/** Rounds up, so a lock never displays "0:00" while still in force. */
export function formatLockoutRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

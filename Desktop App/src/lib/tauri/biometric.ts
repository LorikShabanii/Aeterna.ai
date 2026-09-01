// Native OS biometric verification (Windows Hello / Touch ID via
// tauri-plugin-biometry) — only available inside the Tauri desktop shell.
// In plain web/dev mode there's no OS biometric API to call, so callers
// should treat that as "can't verify, fall back to a plain check-in."
//
// This is a local device-presence gate, not a cryptographic factor — it
// proves someone passed Windows Hello on this machine, not that they hold
// a credential Supabase can verify server-side. That's consistent with how
// CLAUDE.md already treats the Heartbeat check-in ("call the OS biometric
// API and treat its pass/fail result as the check-in signal").

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface BiometricCheckInResult {
  ok: boolean
  reason?: string
}

const DEFAULT_UNAVAILABLE_HINT =
  "Windows Hello isn't set up on this device — add a PIN or fingerprint in Windows Settings."

export async function requestBiometricVerification(
  reason: string,
  options?: { unavailableHint?: string },
): Promise<BiometricCheckInResult> {
  const { checkStatus, authenticate } = await import('@choochmeque/tauri-plugin-biometry-api')

  const status = await checkStatus()
  if (!status.isAvailable) {
    return { ok: false, reason: options?.unavailableHint ?? DEFAULT_UNAVAILABLE_HINT }
  }

  try {
    await authenticate(reason, { allowDeviceCredential: true })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: `Verification didn't go through (${message}). Try again.` }
  }
}

export async function checkBiometricAvailability(): Promise<boolean> {
  const { checkStatus } = await import('@choochmeque/tauri-plugin-biometry-api')
  const status = await checkStatus()
  return status.isAvailable
}

// Per-device preference: whether login on THIS device should require a
// biometric check after the password. Deliberately local-only, not synced
// to the account — Windows Hello enrollment is tied to a specific device,
// so a per-account server flag would risk locking someone out on a new
// machine that never enrolled anything.
const ENABLED_KEY = 'aeterna:biometric-login-enabled'
const ASKED_KEY = 'aeterna:biometric-login-asked'

export function isBiometricLoginEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ENABLED_KEY) === 'true'
}

export function setBiometricLoginEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  if (enabled) window.localStorage.setItem(ENABLED_KEY, 'true')
  else window.localStorage.removeItem(ENABLED_KEY)
}

export function hasAskedAboutBiometricLogin(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ASKED_KEY) === 'true'
}

export function markAskedAboutBiometricLogin(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ASKED_KEY, 'true')
}

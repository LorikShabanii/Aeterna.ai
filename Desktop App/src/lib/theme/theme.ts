// Theme selection, kept deliberately small: a stored preference of
// 'light' | 'dark' | 'system', resolved against the OS setting and applied
// as a single `dark` class on <html> — which is what the `dark` variant in
// styles.css keys off (`@custom-variant dark (&:is(.dark *))`).
//
// Per-device on purpose, like the biometric preference in
// src/lib/tauri/biometric.ts: which theme suits a machine depends on that
// machine and its lighting, not on the account.
export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'aeterna:theme'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    // Storage blocked (private mode, hardened settings) — follow the OS.
    return 'system'
  }
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light'
  return theme
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark')
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  try {
    // 'system' is the default, so store it as an absence rather than a value.
    if (theme === 'system') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Non-fatal: the choice just won't survive a restart.
  }
}

/**
 * Runs synchronously in <head>, before the browser paints anything, so a
 * dark-mode user never sees a white flash while React hydrates. Deliberately
 * inlined and minified by hand — an external script would be fetched too
 * late to prevent the flash, which is the whole point.
 *
 * Wrapped in try/catch because it must never be the thing that breaks the
 * page: if storage or matchMedia throws, the app just renders light.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

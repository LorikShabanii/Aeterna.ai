import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  type Theme,
} from '@/lib/theme/theme'
import { Button } from '@/components/ui/button'

export function ThemeToggle({ className }: { className?: string }) {
  // Starts at 'system' on both server and client so the first render matches
  // the SSR output; the real preference is read in the effect below. Until
  // someone presses this, the app just follows the OS.
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(getStoredTheme())
    setMounted(true)
  }, [])

  // Keep following the OS while no explicit choice has been made — without
  // this, changing the system theme leaves the app stuck until a reload.
  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const isDark = mounted && resolveTheme(theme) === 'dark'

  function toggle() {
    // Flip away from whatever is actually on screen, which is the resolved
    // theme rather than the stored one ('system' could be either).
    const next: Theme = resolveTheme(getStoredTheme()) === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setStoredTheme(next)
    applyTheme(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={toggle}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {/* Swapped by CSS rather than by state, so the right icon is painted
          immediately on load — the same reason the init script exists. Each
          shows the theme you'd get by pressing, not the one you're in. */}
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </Button>
  )
}

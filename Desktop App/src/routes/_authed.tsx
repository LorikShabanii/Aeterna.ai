import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getCurrentUser } from '@/lib/auth/session'
import { checkIn, getCheckInStatus } from '@/lib/heartbeat/checkin'
import { isTauriRuntime, requestBiometricVerification } from '@/lib/tauri/biometric'
import { LogoutButton } from '@/components/logout-button'
import { SealMark } from '@/components/seal-mark'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    return { user }
  },
  loader: () => getCheckInStatus(),
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  const status = Route.useLoaderData()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)

  async function handleCheckIn() {
    setPending(true)
    setCheckInError(null)
    try {
      if (isTauriRuntime()) {
        const result = await requestBiometricVerification(
          "Confirm you're still here to check in to Aeterna",
          {
            unavailableHint:
              "Windows Hello isn't set up on this device — add a PIN or fingerprint in Windows Settings, or push back your deadline from the recovery key page instead.",
          },
        )
        if (!result.ok) {
          setCheckInError(result.reason ?? 'Could not verify. Try again.')
          return
        }
      }
      await checkIn()
      await router.invalidate()
    } catch {
      setCheckInError('Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  const daysLeft = Math.ceil((new Date(status.dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-mist/70">
        <div className="mx-auto flex h-14 max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6">
          <div className="flex items-center gap-6">
            <Link to="/vault" className="flex items-center gap-2 font-serif text-lg text-ink">
              <SealMark className="size-6" />
              Aeterna
            </Link>
            <nav className="flex items-center gap-5">
              <Link
                to="/vault"
                className="text-sm text-cool transition hover:text-ink"
                activeProps={{ className: 'font-medium text-ink' }}
              >
                Vault
              </Link>
              <Link
                to="/recipients"
                className="text-sm text-cool transition hover:text-ink"
                activeProps={{ className: 'font-medium text-ink' }}
              >
                Recipients
              </Link>
              <Link
                to="/recovery-key"
                className="text-sm text-cool transition hover:text-ink"
                activeProps={{ className: 'font-medium text-ink' }}
              >
                Recovery key
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="border-b border-mist/70 bg-mist/30">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          <span
            className={`flex items-center gap-1.5 text-sm ${status.isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            <span
              className={`size-1.5 rounded-full ${status.isOverdue ? 'bg-destructive' : 'bg-seal'}`}
            />
            {status.isOverdue
              ? 'Check-in overdue'
              : `Next check-in in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
          </span>
          <Button size="sm" variant="outline" onClick={handleCheckIn} disabled={pending}>
            {pending ? 'Checking in…' : 'Check in'}
          </Button>
        </div>
        {checkInError ? (
          <div className="mx-auto max-w-5xl px-6 pb-2.5">
            <p className="text-sm text-destructive">{checkInError}</p>
          </div>
        ) : null}
      </div>

      <Outlet />
    </div>
  )
}

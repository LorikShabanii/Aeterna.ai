import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getCurrentUser } from '@/lib/auth/session'
import { checkIn, getCheckInStatus } from '@/lib/heartbeat/checkin'
import { LogoutButton } from '@/components/logout-button'
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

  async function handleCheckIn() {
    setPending(true)
    try {
      await checkIn()
      await router.invalidate()
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
            <Link to="/vault" className="font-serif text-lg text-ink">
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
      </div>

      <Outlet />
    </div>
  )
}

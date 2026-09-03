import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { z } from 'zod'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ensureVaultKeyFromPassword } from '@/lib/crypto/ensure-vault-key'
import {
  clearLoginFailures,
  formatLockoutRemaining,
  getLockoutState,
  MAX_ATTEMPTS,
  recordFailedLogin,
  type LockoutState,
} from '@/lib/auth/login-lockout'
import { BiometricGate } from '@/components/biometric-gate'
import { SealMark } from '@/components/seal-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [awaitingBiometric, setAwaitingBiometric] = useState(false)
  // Starts unlocked and is filled in by the effect below: localStorage isn't
  // readable during SSR, and seeding it here would mismatch on hydration.
  const [lockout, setLockout] = useState<LockoutState>({
    locked: false,
    remainingMs: 0,
    attemptsLeft: MAX_ATTEMPTS,
  })
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Lockouts are tracked per email, so the banner has to follow the field.
  const email = form.watch('email')
  useEffect(() => {
    setLockout(getLockoutState(email))
  }, [email])

  // Count the lock down live, so a waiting user can see it lift.
  useEffect(() => {
    if (!lockout.locked) return
    const id = setInterval(() => {
      const next = getLockoutState(email)
      setLockout(next)
      if (!next.locked) setFormError(null)
    }, 1000)
    return () => clearInterval(id)
  }, [lockout.locked, email])

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setFormError(null)

    // Re-read rather than trusting render state, which the countdown may
    // not have refreshed yet.
    const current = getLockoutState(values.email)
    if (current.locked) {
      setLockout(current)
      setFormError(
        `Too many failed attempts. Try again in ${formatLockoutRemaining(current.remainingMs)}.`,
      )
      return
    }

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      const next = recordFailedLogin(values.email)
      setLockout(next)
      if (next.locked) {
        setFormError(
          `Too many failed attempts. Sign-in for this email is locked on this device for ${formatLockoutRemaining(next.remainingMs)}.`,
        )
      } else if (next.attemptsLeft <= 2) {
        setFormError(
          `${error.message} — ${next.attemptsLeft} ${next.attemptsLeft === 1 ? 'attempt' : 'attempts'} left before a 30-minute lock.`,
        )
      } else {
        setFormError(error.message)
      }
      return
    }

    clearLoginFailures(values.email)
    await ensureVaultKeyFromPassword(supabase, values.password)
    setAwaitingBiometric(true)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-cool transition-colors hover:text-ink"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Link>
          <ThemeToggle />
        </div>
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <SealMark className="size-7" />
          <span className="font-serif text-xl text-ink">Aeterna</span>
        </Link>
        <Card className="torn">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-medium">Sign in</CardTitle>
            <CardDescription>Sign in to check in and manage your vault.</CardDescription>
          </CardHeader>
          <CardContent>
            {awaitingBiometric ? (
              <BiometricGate onDone={() => navigate({ to: '/vault' })} />
            ) : (
              <>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              autoComplete="email"
                              disabled={lockout.locked}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="current-password"
                              disabled={lockout.locked}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {lockout.locked ? (
                      <div className="rounded-md border border-seal/30 bg-mist/40 p-3 text-sm text-ink">
                        <p className="font-medium">Sign-in paused</p>
                        <p className="mt-1 text-cool">
                          Too many failed attempts for this email. Try again in{' '}
                          <span className="font-medium tabular-nums text-ink">
                            {formatLockoutRemaining(lockout.remainingMs)}
                          </span>
                          .
                        </p>
                      </div>
                    ) : formError ? (
                      <p className="text-sm text-destructive">{formError}</p>
                    ) : null}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={form.formState.isSubmitting || lockout.locked}
                    >
                      {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
                    </Button>
                  </form>
                </Form>
                <p className="mt-4 text-center text-sm text-cool">
                  No account?{' '}
                  <Link to="/signup" className="text-ink underline underline-offset-4">
                    Sign up
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ensureVaultKeyFromPassword } from '@/lib/crypto/ensure-vault-key'
import { BiometricGate } from '@/components/biometric-gate'
import { SealMark } from '@/components/seal-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  // Master password: derives the client-side encryption key (PBKDF2/Argon2)
  // per CLAUDE.md > Encryption approach — never transmitted or stored server-side.
  password: z.string().min(8, 'Use at least 8 characters'),
})

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [awaitingBiometric, setAwaitingBiometric] = useState(false)
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: z.infer<typeof signupSchema>) {
    setFormError(null)
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp(values)
    if (error) {
      setFormError(error.message)
      return
    }
    // If email confirmation is off (Auth > Providers > Email), signUp
    // returns a live session immediately; otherwise there's no session yet
    // — the biometric-enrollment offer happens on their first login instead,
    // once a session actually exists (see login.tsx).
    if (data.session) {
      await ensureVaultKeyFromPassword(supabase, values.password)
      setAwaitingBiometric(true)
    } else {
      setConfirmationSent(true)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <SealMark className="size-7" />
          <span className="font-serif text-xl text-ink">Aeterna</span>
        </div>
        <Card className="torn">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-medium">Create your vault</CardTitle>
            <CardDescription>
              Your password never leaves your device — it encrypts your vault locally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmationSent ? (
              <p className="text-sm text-cool">
                Check your email to confirm your account, then{' '}
                <Link to="/login" className="text-ink underline underline-offset-4">
                  sign in
                </Link>
                .
              </p>
            ) : awaitingBiometric ? (
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
                            <Input type="email" autoComplete="email" {...field} />
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
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? 'Creating vault…' : 'Create vault'}
                    </Button>
                  </form>
                </Form>
                <p className="mt-4 text-center text-sm text-cool">
                  Already have a vault?{' '}
                  <Link to="/login" className="text-ink underline underline-offset-4">
                    Sign in
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

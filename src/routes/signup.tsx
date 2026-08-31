import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
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
    // returns a live session immediately; otherwise there's no session yet.
    if (data.session) {
      await navigate({ to: '/vault' })
    } else {
      setConfirmationSent(true)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your vault</CardTitle>
          <CardDescription>
            Your password never leaves your device — it encrypts your vault locally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmationSent ? (
            <p className="text-sm text-muted-foreground">
              Check your email to confirm your account, then{' '}
              <Link to="/login" className="underline underline-offset-4">
                sign in
              </Link>
              .
            </p>
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
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have a vault?{' '}
                <Link to="/login" className="underline underline-offset-4">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

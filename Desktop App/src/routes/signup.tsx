import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { z } from 'zod'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ensureVaultKeyFromPassword } from '@/lib/crypto/ensure-vault-key'
import { CALLING_CODES, DEFAULT_COUNTRY_ISO, findCallingCode, toE164 } from '@/lib/phone/country-codes'
import { BiometricGate } from '@/components/biometric-gate'
import { SealMark } from '@/components/seal-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(80, 'Too long'),
    lastName: z.string().trim().min(1, 'Last name is required').max(80, 'Too long'),
    email: z.string().email('Enter a valid email'),
    // Master password: derives the client-side encryption key (PBKDF2/Argon2)
    // per CLAUDE.md > Encryption approach — never transmitted or stored server-side.
    password: z.string().min(8, 'Use at least 8 characters'),
    // Typo insurance that matters more here than on a normal signup: this
    // password derives the vault encryption key, so a mistyped one can't be
    // reset without losing what it encrypted.
    confirmPassword: z.string().min(1, 'Re-enter your password'),
    phoneCountry: z.string().min(1, 'Pick a country code'),
    // Optional. Empty is valid; anything typed has to look like a real number.
    phoneNumber: z.string(),
  })
  .superRefine((values, ctx) => {
    // Checked before the phone rules below, which bail early when the
    // optional number is blank.
    if (values.confirmPassword && values.confirmPassword !== values.password) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      })
    }

    const typed = values.phoneNumber.trim()
    if (!typed) return

    if (/[^\d\s()+.-]/.test(typed)) {
      ctx.addIssue({
        code: 'custom',
        path: ['phoneNumber'],
        message: 'Digits only — or leave it blank.',
      })
      return
    }
    // toE164 strips the trunk zero, so check what actually survives.
    const e164 = toE164(values.phoneCountry, typed)
    if (!e164 || e164.replace(/\D/g, '').length < 7) {
      ctx.addIssue({
        code: 'custom',
        path: ['phoneNumber'],
        message: 'That number looks too short — or leave it blank.',
      })
    }
  })

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [awaitingBiometric, setAwaitingBiometric] = useState(false)
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phoneCountry: DEFAULT_COUNTRY_ISO,
      phoneNumber: '',
    },
  })

  const selectedCountry = findCallingCode(form.watch('phoneCountry'))

  async function onSubmit(values: z.infer<typeof signupSchema>) {
    setFormError(null)
    const supabase = getSupabaseBrowserClient()

    const typedPhone = values.phoneNumber.trim()
    const phoneE164 = typedPhone ? toE164(values.phoneCountry, typedPhone) : null

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        // Goes to auth.users.raw_user_meta_data, which the on_auth_user_created
        // trigger copies onto `profiles` — see
        // supabase/migrations/20260909000000_profile_contact_details.sql.
        // Note `phone` belongs *here* and not at the top level of signUp():
        // a top-level phone would start Supabase's SMS OTP flow instead.
        data: {
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          phone: phoneE164,
          phone_country: phoneE164 ? values.phoneCountry : null,
        },
      },
    })
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
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name</FormLabel>
                            <FormControl>
                              <Input autoComplete="given-name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name</FormLabel>
                            <FormControl>
                              <Input autoComplete="family-name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormLabel className="flex items-baseline gap-2">
                        Phone
                        <span className="text-xs font-normal text-cool">optional</span>
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="phoneCountry"
                          render={({ field }) => (
                            <FormItem className="shrink-0">
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger className="w-28" aria-label="Country calling code">
                                    <SelectValue>
                                      {selectedCountry
                                        ? `${selectedCountry.flag} +${selectedCountry.dial}`
                                        : 'Code'}
                                    </SelectValue>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-72">
                                  {CALLING_CODES.map((country) => (
                                    <SelectItem key={country.iso} value={country.iso}>
                                      <span className="mr-1.5">{country.flag}</span>
                                      {country.name}
                                      <span className="ml-1.5 text-cool">+{country.dial}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel-national"
                                  placeholder="44 123 456"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

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

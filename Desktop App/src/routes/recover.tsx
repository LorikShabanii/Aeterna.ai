import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { redeemRecoveryKey } from '@/lib/recovery/recovery-key'
import { SealMark } from '@/components/seal-mark'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

// Deliberately public and login-free — CLAUDE.md > False-trigger mitigation:
// this has to work even without the device/phone that normally does the
// check-in. The phrase itself is the only credential needed.
export const Route = createFileRoute('/recover')({ component: RecoverPage })

function RecoverPage() {
  const [phrase, setPhrase] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setResult(null)
    try {
      await redeemRecoveryKey({ data: { phrase } })
      setResult('success')
      setPhrase('')
    } catch {
      setResult('error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <SealMark className="size-7" />
          <span className="font-serif text-xl text-ink">Aeterna</span>
        </Link>
        <Card className="torn">
        <CardHeader>
          <CardTitle className="font-serif text-2xl font-medium">Push back a check-in deadline</CardTitle>
          <CardDescription>
            Paste the recovery phrase you saved when you set this up. This only delays delivery —
            it can't open or read anything in the vault.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result === 'success' ? (
            <p className="text-sm">
              Done — the check-in deadline for that vault has been pushed back.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-phrase">Recovery phrase</Label>
                <Textarea
                  id="recovery-phrase"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  rows={3}
                  placeholder="twelve words separated by spaces"
                  required
                />
              </div>
              {result === 'error' ? (
                <p className="text-sm text-destructive">
                  That phrase wasn't recognized, or has already been used.
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Checking…' : 'Push back deadline'}
              </Button>
            </form>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  )
}

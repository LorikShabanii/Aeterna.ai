import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { generateRecoveryKey, getRecoveryKeyStatus } from '@/lib/recovery/recovery-key'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authed/recovery-key')({
  loader: () => getRecoveryKeyStatus(),
  component: RecoveryKeyPage,
})

function RecoveryKeyPage() {
  const status = Route.useLoaderData()
  const router = useRouter()
  const [revealedPhrase, setRevealedPhrase] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  async function handleGenerate() {
    setPending(true)
    try {
      const { phrase } = await generateRecoveryKey()
      setRevealedPhrase(phrase)
      setConfirmRegenerate(false)
      await router.invalidate()
    } finally {
      setPending(false)
    }
  }

  function handleDone() {
    setRevealedPhrase(null)
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 font-serif text-2xl font-medium text-ink">Recovery key</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your recovery key can only push back your check-in deadline — it cannot decrypt your
        vault. Store it offline (printed, or in a safe); anyone can redeem it from a public page
        with no login, so treat it like a spare key, not a password.
      </p>

      {revealedPhrase ? (
        <Card className="torn">
          <CardHeader>
            <CardTitle className="font-serif font-medium">Save this now — it won't be shown again</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-input bg-muted/40 p-4 font-mono text-sm leading-relaxed">
              {revealedPhrase}
            </p>
            <p className="text-sm text-destructive">
              This is the only time this phrase is shown. Write it down or print it before
              continuing.
            </p>
            <Button onClick={handleDone}>I've saved it</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="torn">
          <CardHeader>
            <CardTitle className="font-serif font-medium">
              {status.hasActiveKey ? 'Active recovery key' : 'No recovery key yet'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.hasActiveKey ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(status.createdAt!).toLocaleDateString()}. Generating a new one
                  immediately retires this one.
                </p>
                {confirmRegenerate ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm">Your current key will stop working. Continue?</p>
                    <Button size="sm" variant="destructive" onClick={handleGenerate} disabled={pending}>
                      {pending ? 'Generating…' : 'Yes, replace it'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRegenerate(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setConfirmRegenerate(true)}>
                    Generate a new recovery key
                  </Button>
                )}
              </>
            ) : (
              <Button onClick={handleGenerate} disabled={pending}>
                {pending ? 'Generating…' : 'Generate recovery key'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

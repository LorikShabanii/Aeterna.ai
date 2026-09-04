import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { confirmNotarizationRequest, getNotarizationRequestInfo } from '@/lib/notary/notary'
import { SealMark } from '@/components/seal-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Public, no-login, same pattern as /handover/$token and /recover — the
// token in the URL is the credential. Lightweight stub, not a real
// e-signature integration (see docs/roadmap-differentiation-features.md >
// Feature 3 and its CLAUDE.md TODO) — this just records that whoever
// received the request acknowledged it.
export const Route = createFileRoute('/notarize/$token')({
  loader: ({ params }) => getNotarizationRequestInfo({ data: { token: params.token } }),
  component: NotarizePage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <SealMark className="size-7" />
          <span className="font-serif text-xl text-ink">Aeterna</span>
        </div>
        <Card className="torn">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-medium">Link not found</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'This link is invalid.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  ),
})

function NotarizePage() {
  const { token } = Route.useParams()
  const { itemTitle, requesterName, status } = Route.useLoaderData()
  const [confirmed, setConfirmed] = useState(status === 'confirmed')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      await confirmNotarizationRequest({ data: { token } })
      setConfirmed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm this request.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <SealMark className="size-7" />
          <span className="font-serif text-xl text-ink">Aeterna</span>
        </div>
        <Card className="torn">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-medium">Notarization request</CardTitle>
            <CardDescription>
              {requesterName} asked for "{itemTitle}" to be notarized through Aeterna.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmed ? (
              <p className="text-sm text-seal">Confirmed — thanks for acknowledging this request.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This is a stub, not a real e-signature — confirming just lets{' '}
                  {requesterName} know you've received it.
                </p>
                <Button onClick={handleConfirm} disabled={pending}>
                  {pending ? 'Confirming…' : 'Confirm'}
                </Button>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

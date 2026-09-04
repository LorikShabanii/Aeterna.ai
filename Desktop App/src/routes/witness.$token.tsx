import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { confirmWitness, getWitnessInvite } from '@/lib/vault/witnesses'
import { SealMark } from '@/components/seal-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Public, no-login, same pattern as /handover/$token and /notarize/$token —
// the token in the URL is the credential. The witness confirms themselves
// here (docs/roadmap-differentiation-features.md > Feature 4 revision)
// instead of the owner checking a box on their behalf. The optional photo
// is stored as-is and never automatically compared against the video —
// see this route's CLAUDE.md TODO and CLAUDE.md's standing "no custom
// face-recognition model" policy.
export const Route = createFileRoute('/witness/$token')({
  loader: ({ params }) => getWitnessInvite({ data: { token: params.token } }),
  component: WitnessPage,
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function WitnessPage() {
  const { token } = Route.useParams()
  const { itemTitle, witnessName, witnessedAt, status } = Route.useLoaderData()
  const [confirmed, setConfirmed] = useState(status === 'confirmed')
  const [photo, setPhoto] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      const photoDataUrl = photo ? await fileToDataUrl(photo) : undefined
      await confirmWitness({ data: { token, photoDataUrl } })
      setConfirmed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm this.')
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
            <CardTitle className="font-serif text-2xl font-medium">Witness confirmation</CardTitle>
            <CardDescription>
              {witnessName}, you were named as a witness to "{itemTitle}", recorded on{' '}
              {new Date(witnessedAt).toLocaleString()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmed ? (
              <p className="text-sm text-seal">Confirmed — thank you.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  By confirming, you're stating you were actually present and witnessed this
                  recording.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="witness-photo">Photo of yourself (optional)</Label>
                  <Input
                    id="witness-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supporting evidence only — it's stored as submitted and never automatically
                    compared against the recording.
                  </p>
                </div>
                <Button onClick={handleConfirm} disabled={pending}>
                  {pending ? 'Confirming…' : 'Confirm I was present'}
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

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getHandoverInfo, sendHandoverOtp, verifyHandoverOtp, type HandoverItem } from '@/lib/handover/handover'
import { decryptText, decryptToBlob, importVaultKey } from '@/lib/crypto/vault-key'
import { SealMark } from '@/components/seal-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Deliberately public and login-free, same as /recover — the token in the
// URL is the credential. The vault key (when present) rides in the URL
// fragment (#key=...), which browsers never send to any server — only
// this page's own client-side code ever sees it, and only to decrypt
// locally. See src/lib/handover/handover.ts and
// supabase/migrations/20260907000000_vault_key_escrow.sql.
export const Route = createFileRoute('/handover/$token')({
  loader: ({ params }) => getHandoverInfo({ data: { token: params.token } }),
  component: HandoverPage,
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

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function HandoverPage() {
  const { token } = Route.useParams()
  const { recipientName, ownerEmail, maskedContact, items } = Route.useLoaderData()

  const [verified, setVerified] = useState(false)

  // Read after mount, not during render — the URL fragment never reaches
  // the server, so the SSR pass and first client render must agree there's
  // no key yet, same reasoning as the vault page's locked/unlocked state.
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null)
  const [keyMissing, setKeyMissing] = useState(false)

  useEffect(() => {
    const match = window.location.hash.match(/key=([^&]+)/)
    if (!match) {
      setKeyMissing(true)
      return
    }
    importVaultKey(fromBase64(decodeURIComponent(match[1])))
      .then(setVaultKey)
      .catch(() => setKeyMissing(true))
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <SealMark className="size-7" />
          <span className="font-serif text-xl text-ink">Aeterna</span>
        </div>
        <Card className="torn">
        <CardHeader>
          <CardTitle className="font-serif text-2xl font-medium">For {recipientName}</CardTitle>
          <CardDescription>
            {ownerEmail} has entrusted you with the following through Aeterna.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is listed yet.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i}>
                  <HandoverItemCard item={item} vaultKey={verified ? vaultKey : null} />
                </li>
              ))}
            </ul>
          )}

          {!verified && items.length > 0 ? (
            <OtpGate token={token} maskedContact={maskedContact} onVerified={() => setVerified(true)} />
          ) : null}

          {verified && keyMissing ? (
            <p className="text-sm text-muted-foreground">
              This link doesn't include a decryption key, so content can't be shown here — only
              what was left for you.
            </p>
          ) : null}
        </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OtpGate({
  token,
  maskedContact,
  onVerified,
}: {
  token: string
  maskedContact: string | null
  onVerified: () => void
}) {
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setPending(true)
    setError(null)
    try {
      await sendHandoverOtp({ data: { token } })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a code. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await verifyHandoverOtp({ data: { token, code } })
      onVerified()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify that code.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="border-t border-mist/70 pt-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-cool">Verify it's you</p>
      {!sent ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            To view or download anything, confirm you still have access to{' '}
            {maskedContact ?? 'your email'}.
          </p>
          <Button size="sm" onClick={handleSend} disabled={pending}>
            {pending ? 'Sending…' : 'Send verification code'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="otp-code">6-digit code</Label>
            <Input
              id="otp-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Verifying…' : 'Verify'}
            </Button>
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={handleSend}>
              Resend code
            </Button>
          </div>
        </form>
      )}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function HandoverItemCard({ item, vaultKey }: { item: HandoverItem; vaultKey: CryptoKey | null }) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleReveal() {
    if (!vaultKey || !item.encryptedPayload) return
    setError(null)
    try {
      setRevealed(await decryptText(vaultKey, item.encryptedPayload))
    } catch {
      setError("Couldn't decrypt this — the link may be out of date.")
    }
  }

  async function handleDownload() {
    if (!vaultKey || !item.downloadUrl) return
    setError(null)
    setPending(true)
    try {
      const response = await fetch(item.downloadUrl)
      const encryptedBlob = await response.blob()
      const decrypted = await decryptToBlob(vaultKey, encryptedBlob)
      const url = URL.createObjectURL(decrypted)
      const link = document.createElement('a')
      link.href = url
      link.download = item.title
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Couldn't decrypt this — the link may be out of date.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-md border border-input px-3 py-2 text-sm">
      <p className="font-medium">{item.title}</p>
      <p className="text-muted-foreground">
        {item.type}
        {item.category ? ` · ${item.category}` : ''}
      </p>
      {item.encryptedPayload ? (
        revealed === null ? (
          <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={handleReveal} disabled={!vaultKey}>
            Reveal
          </Button>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-foreground">{revealed}</p>
        )
      ) : item.downloadUrl ? (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0"
          onClick={handleDownload}
          disabled={!vaultKey || pending}
        >
          {pending ? 'Decrypting…' : 'Download'}
        </Button>
      ) : null}
      {error ? <p className="mt-1 text-destructive">{error}</p> : null}
    </div>
  )
}

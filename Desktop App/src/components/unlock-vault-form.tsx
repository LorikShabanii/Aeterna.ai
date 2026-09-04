import { useState } from 'react'
import { ensureVaultKeyFromPassword } from '@/lib/crypto/ensure-vault-key'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

// Shared by every page that needs the in-memory vault key (src/lib/crypto/
// session-key.ts) and finds it empty — a page refresh loses it, since it's
// deliberately never persisted (see that file's own comment).
export function UnlockVaultForm({ onUnlocked }: { onUnlocked: (key: CryptoKey) => void }) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const key = await ensureVaultKeyFromPassword(supabase, password)
      onUnlocked(key)
    } catch {
      setError('Could not unlock the vault with that password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="torn">
      <CardHeader>
        <CardTitle className="font-serif font-medium">Unlock your vault</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUnlock} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your vault key lives only in this browser tab, never on our servers — re-enter your
            password to unlock it for this session.
          </p>
          <div className="space-y-2">
            <Label htmlFor="unlock-password">Password</Label>
            <Input
              id="unlock-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending || !password}>
            {pending ? 'Unlocking…' : 'Unlock'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

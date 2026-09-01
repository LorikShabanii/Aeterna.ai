import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createFileItem, createLetter, deleteVaultItem, listVaultItems } from '@/lib/vault/items'
import {
  assignRecipient,
  listRecipients,
  listVaultItemRecipients,
  unassignRecipient,
} from '@/lib/recipients/recipients'
import type { RecipientRow } from '@/lib/supabase/types'
import { decryptText, decryptToBlob, encryptFile, encryptText } from '@/lib/crypto/vault-key'
import { ensureVaultKeyFromPassword } from '@/lib/crypto/ensure-vault-key'
import { getVaultKey } from '@/lib/crypto/session-key'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const Route = createFileRoute('/_authed/vault')({
  loader: async () => {
    const [items, recipients, assignments] = await Promise.all([
      listVaultItems(),
      listRecipients(),
      listVaultItemRecipients(),
    ])
    return { items, recipients, assignments }
  },
  component: VaultPage,
})

function VaultPage() {
  const { items, recipients, assignments } = Route.useLoaderData()
  const router = useRouter()

  // The vault key lives only in memory (src/lib/crypto/session-key.ts) and
  // is lost on refresh. Read it after mount, not during render, so the
  // server-rendered HTML and the first client render always agree (both
  // start "locked") and only update once we know the real client state.
  const [vaultKey, setVaultKeyState] = useState<CryptoKey | null>(null)
  useEffect(() => {
    setVaultKeyState(getVaultKey())
  }, [])

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 font-serif text-2xl font-medium text-ink">Your vault</h1>

      {vaultKey ? (
        <Tabs defaultValue="letter">
          <TabsList>
            <TabsTrigger value="letter">Write a letter</TabsTrigger>
            <TabsTrigger value="file">Upload a file</TabsTrigger>
          </TabsList>
          <TabsContent value="letter">
            <NewLetterForm vaultKey={vaultKey} onCreated={() => router.invalidate()} />
          </TabsContent>
          <TabsContent value="file">
            <UploadFileForm vaultKey={vaultKey} onCreated={() => router.invalidate()} />
          </TabsContent>
        </Tabs>
      ) : (
        <UnlockVaultForm onUnlocked={(key) => setVaultKeyState(key)} />
      )}

      {vaultKey ? (
        <div className="mt-8 space-y-3">
          {items.length === 0 ? (
            <Card className="torn">
              <CardHeader>
                <CardTitle className="font-serif font-medium">No vault items yet</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Write a letter or upload a file above — everything is encrypted in your browser
                before it's ever sent.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <VaultItemCard
                    item={item}
                    vaultKey={vaultKey}
                    recipients={recipients}
                    assignedRecipientIds={assignments
                      .filter((a) => a.vault_item_id === item.id)
                      .map((a) => a.recipient_id)}
                    onDeleted={() => router.invalidate()}
                    onAssignmentChanged={() => router.invalidate()}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : items.length > 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {items.length} item{items.length === 1 ? '' : 's'} in your vault — unlock to view them.
        </p>
      ) : null}
    </div>
  )
}

function UnlockVaultForm({ onUnlocked }: { onUnlocked: (key: CryptoKey) => void }) {
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

function NewLetterForm({
  vaultKey,
  onCreated,
}: {
  vaultKey: CryptoKey
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const encryptedPayload = await encryptText(vaultKey, body)
      await createLetter({ data: { title, encryptedPayload } })
      setTitle('')
      setBody('')
      onCreated()
    } catch {
      setError('Could not save that letter. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="torn">
      <CardHeader>
        <CardTitle className="font-serif font-medium">Write a letter</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="letter-title">Title</Label>
            <Input
              id="letter-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="For my daughter"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="letter-body">Letter</Label>
            <Textarea
              id="letter-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write what you want them to know…"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Sealing…' : 'Seal letter'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

type FileVaultType = 'document' | 'photo' | 'video'

const FILE_TYPE_ACCEPT: Record<FileVaultType, string> = {
  photo: 'image/*',
  video: 'video/*',
  document: '.pdf,.doc,.docx,.odt,.rtf,.txt,application/pdf,application/msword,text/plain',
}

// The <input accept> filter only narrows the OS file picker — it doesn't
// block drag-and-drop or an explicit "All files" choice, so re-check
// against the file's actual MIME type before upload.
function matchesFileType(file: File, type: FileVaultType): boolean {
  if (type === 'photo') return file.type.startsWith('image/')
  if (type === 'video') return file.type.startsWith('video/')
  return !file.type.startsWith('image/') && !file.type.startsWith('video/')
}

function UploadFileForm({
  vaultKey,
  onCreated,
}: {
  vaultKey: CryptoKey
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<FileVaultType>('document')
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    if (!matchesFileType(file, type)) {
      setError(`That doesn't look like a ${type} — pick a matching file or change the type.`)
      return
    }
    setPending(true)
    setError(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const encryptedBlob = await encryptFile(vaultKey, file)
      // The original filename (with extension) rides along in the storage
      // path — storage.foldername() only looks at the segment before the
      // last, so this doesn't change what the RLS policies check — and lets
      // downloads restore the real extension instead of a bare UUID.
      const storagePath = `${user.id}/${crypto.randomUUID()}/${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('vault-files')
        .upload(storagePath, encryptedBlob, { contentType: 'application/octet-stream' })
      if (uploadError) throw uploadError

      await createFileItem({ data: { title, type, storagePath } })
      setTitle('')
      setFile(null)
      onCreated()
    } catch {
      setError('Could not upload that file. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="torn">
      <CardHeader>
        <CardTitle className="font-serif font-medium">Upload a file</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-title">Title</Label>
            <Input
              id="file-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Deed to the house"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-type">Type</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value as FileVaultType)
                setFile(null)
              }}
            >
              <SelectTrigger id="file-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-input">File</Label>
            {file ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <Input
                key={type}
                id="file-input"
                type="file"
                accept={FILE_TYPE_ACCEPT[type]}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            )}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending || !file}>
            {pending ? 'Sealing…' : 'Seal file'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface VaultItemRow {
  id: string
  type: string
  title: string
  category: string | null
  encrypted_payload: string | null
  encrypted_file_url: string | null
  created_at: string
}

function VaultItemCard({
  item,
  vaultKey,
  recipients,
  assignedRecipientIds,
  onDeleted,
  onAssignmentChanged,
}: {
  item: VaultItemRow
  vaultKey: CryptoKey | null
  recipients: RecipientRow[]
  assignedRecipientIds: string[]
  onDeleted: () => void
  onAssignmentChanged: () => void
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  async function handleToggleRecipient(recipientId: string, isAssigned: boolean) {
    setAssigning(recipientId)
    try {
      if (isAssigned) {
        await unassignRecipient({ data: { vaultItemId: item.id, recipientId } })
      } else {
        await assignRecipient({ data: { vaultItemId: item.id, recipientId } })
      }
      onAssignmentChanged()
    } finally {
      setAssigning(null)
    }
  }

  async function handleReveal() {
    if (!vaultKey || !item.encrypted_payload) return
    setActionError(null)
    try {
      setRevealed(await decryptText(vaultKey, item.encrypted_payload))
    } catch {
      setActionError('Wrong password for this session — sign out and back in to retry.')
    }
  }

  async function handleDownload() {
    if (!vaultKey || !item.encrypted_file_url) return
    setActionError(null)
    setPending(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: encryptedBlob, error } = await supabase.storage
        .from('vault-files')
        .download(item.encrypted_file_url)
      if (error || !encryptedBlob) throw error ?? new Error('Download failed')

      const decrypted = await decryptToBlob(vaultKey, encryptedBlob)
      const url = URL.createObjectURL(decrypted)
      const link = document.createElement('a')
      link.href = url
      // Restore the real filename (with extension) from the storage path —
      // item.title has no extension, which is what made downloads look like
      // garbled text: the OS had nothing to tell it what kind of file it was.
      link.download = item.encrypted_file_url?.split('/').pop() || item.title
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setActionError('Could not decrypt this file — sign out and back in to retry.')
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    setPending(true)
    try {
      await deleteVaultItem({ data: { id: item.id, storagePath: item.encrypted_file_url } })
      onDeleted()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base font-medium">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          {item.type}
          {item.category ? ` · ${item.category}` : ''}
        </p>
        {item.encrypted_payload ? (
          revealed === null ? (
            <Button
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0"
              onClick={handleReveal}
              disabled={!vaultKey}
            >
              Reveal
            </Button>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-foreground">{revealed}</p>
          )
        ) : (
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-auto p-0"
            onClick={handleDownload}
            disabled={!vaultKey || pending}
          >
            Download
          </Button>
        )}
        {actionError ? <p className="mt-1 text-destructive">{actionError}</p> : null}

        <div className="mt-4 border-t border-mist/70 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-cool">Recipients</p>
          {recipients.length === 0 ? (
            <p className="mt-1 text-xs">Add recipients on the Recipients page to assign this.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {recipients.map((recipient) => {
                const isAssigned = assignedRecipientIds.includes(recipient.id)
                return (
                  <li key={recipient.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`${item.id}-${recipient.id}`}
                      checked={isAssigned}
                      disabled={assigning === recipient.id}
                      onCheckedChange={() => handleToggleRecipient(recipient.id, isAssigned)}
                    />
                    <Label htmlFor={`${item.id}-${recipient.id}`} className="text-foreground">
                      {recipient.name}
                    </Label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-mist/70 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={pending || !vaultKey}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

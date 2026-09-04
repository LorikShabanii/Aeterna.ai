import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  createFileItem,
  createLetter,
  deleteVaultItem,
  listVaultItems,
  listVaultItemWitnesses,
  VAULT_ITEM_CATEGORIES,
} from '@/lib/vault/items'
import {
  assignRecipient,
  listRecipients,
  listVaultItemRecipients,
  unassignRecipient,
} from '@/lib/recipients/recipients'
import { listNotarizationRequests, requestNotarization } from '@/lib/notary/notary'
import type { NotarizationRequestRow, RecipientRow, VaultItemWitnessRow } from '@/lib/supabase/types'
import { decryptText, decryptToBlob, encryptFile, encryptText, hashFile } from '@/lib/crypto/vault-key'
import { getVaultKey } from '@/lib/crypto/session-key'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSealing } from '@/lib/use-sealing'
import { SealingOverlay } from '@/components/sealing-overlay'
import { UnlockVaultForm } from '@/components/unlock-vault-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/_authed/vault')({
  loader: async () => {
    const [items, recipients, assignments, witnesses, notarizations] = await Promise.all([
      listVaultItems(),
      listRecipients(),
      listVaultItemRecipients(),
      listVaultItemWitnesses(),
      listNotarizationRequests(),
    ])
    return { items, recipients, assignments, witnesses, notarizations }
  },
  component: VaultPage,
})

function VaultPage() {
  const { items, recipients, assignments, witnesses, notarizations } = Route.useLoaderData()
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
                    witnesses={witnesses.filter((w) => w.vault_item_id === item.id)}
                    notarizations={notarizations.filter((n) => n.vault_item_id === item.id)}
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

type VaultItemCategory = (typeof VAULT_ITEM_CATEGORIES)[number]

const CATEGORY_LABELS: Record<VaultItemCategory, string> = {
  personal: 'Personal',
  financial: 'Financial',
  land_succession: 'Land & property',
}

function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: VaultItemCategory | ''
  onChange: (value: VaultItemCategory | '') => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Category (optional)</Label>
      <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : (v as VaultItemCategory))}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {VAULT_ITEM_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
  const [category, setCategory] = useState<VaultItemCategory | ''>('')
  const [error, setError] = useState<string | null>(null)
  const { sealing, runSealed } = useSealing()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await runSealed(async () => {
        const encryptedPayload = await encryptText(vaultKey, body)
        await createLetter({ data: { title, encryptedPayload, category: category || null } })
      })
      setTitle('')
      setBody('')
      setCategory('')
      onCreated()
    } catch {
      setError('Could not save that letter. Try again.')
    }
  }

  return (
    <Card className="torn">
      {sealing ? <SealingOverlay label="Sealing your letter…" /> : null}
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
          <CategorySelect id="letter-category" value={category} onChange={setCategory} />
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
          <Button type="submit" disabled={sealing}>
            Seal letter
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

interface WitnessDraft {
  name: string
  contact: string
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
  const [category, setCategory] = useState<VaultItemCategory | ''>('')
  const [file, setFile] = useState<File | null>(null)
  // Set the moment the file is selected, not at submit — that's the actual
  // capture moment; submit can happen arbitrarily later while the user
  // fills in the title. See docs/roadmap-differentiation-features.md > Feature 1.
  const [capturedAt, setCapturedAt] = useState<string | null>(null)
  // Up to 2 people present at recording time (docs/roadmap-differentiation-
  // features.md > Feature 4) — only offered for video. The owner just names
  // them here; each witness gets an email and confirms themselves via
  // src/routes/witness.$token.tsx, they're not self-attested by the owner.
  const [witnessDrafts, setWitnessDrafts] = useState<WitnessDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const { sealing, runSealed } = useSealing()

  function handleFileSelected(selected: File | null) {
    setFile(selected)
    setCapturedAt(selected ? new Date().toISOString() : null)
  }

  function addWitness() {
    setWitnessDrafts((prev) => (prev.length >= 2 ? prev : [...prev, { name: '', contact: '' }]))
  }

  function updateWitness(index: number, patch: Partial<WitnessDraft>) {
    setWitnessDrafts((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)))
  }

  function removeWitness(index: number) {
    setWitnessDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !capturedAt) return
    if (!matchesFileType(file, type)) {
      setError(`That doesn't look like a ${type} — pick a matching file or change the type.`)
      return
    }
    if (witnessDrafts.some((w) => !w.name || !w.contact)) {
      setError('Fill in each witness’s name and contact.')
      return
    }
    setError(null)
    try {
      await runSealed(async () => {
        const supabase = getSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Hashed from the untouched original bytes, before encryption —
        // hashing the ciphertext would only prove the encrypted blob
        // existed, not the file itself.
        const contentHash = await hashFile(file)
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

        await createFileItem({
          data: {
            title,
            type,
            storagePath,
            category: category || null,
            contentHash,
            capturedAt,
            witnesses: witnessDrafts.map((w) => ({
              name: w.name,
              contact: w.contact,
            })),
          },
        })
      })
      setTitle('')
      handleFileSelected(null)
      setCategory('')
      setWitnessDrafts([])
      onCreated()
    } catch {
      setError('Could not upload that file. Try again.')
    }
  }

  return (
    <Card className="torn">
      {sealing ? <SealingOverlay label="Sealing your file…" /> : null}
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
                handleFileSelected(null)
                setWitnessDrafts([])
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
          <CategorySelect id="file-category" value={category} onChange={setCategory} />
          <div className="space-y-2">
            <Label htmlFor="file-input">File</Label>
            {file ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleFileSelected(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <Input
                key={type}
                id="file-input"
                type="file"
                accept={FILE_TYPE_ACCEPT[type]}
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                required
              />
            )}
          </div>
          {type === 'video' ? (
            <div className="space-y-3">
              <div>
                <Label>Witnesses (optional, up to 2)</Label>
                <p className="text-xs text-muted-foreground">
                  Anyone present for this recording can be added as a witness, timestamped at
                  the same moment as the video itself. They'll get an email asking them to
                  confirm — this list only names them, it doesn't confirm on their behalf.
                </p>
              </div>
              {witnessDrafts.map((witness, index) => (
                <div key={index} className="space-y-2 rounded-md border border-input p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`witness-name-${index}`}>Witness {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWitness(index)}
                    >
                      Remove
                    </Button>
                  </div>
                  <Input
                    id={`witness-name-${index}`}
                    value={witness.name}
                    onChange={(e) => updateWitness(index, { name: e.target.value })}
                    placeholder="Name"
                  />
                  <Input
                    value={witness.contact}
                    onChange={(e) => updateWitness(index, { contact: e.target.value })}
                    placeholder="Email"
                  />
                </div>
              ))}
              {witnessDrafts.length < 2 ? (
                <Button type="button" variant="outline" size="sm" onClick={addWitness}>
                  Add a witness
                </Button>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={sealing || !file}>
            Seal file
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
  content_hash: string | null
  captured_at: string | null
  created_at: string
}

function VaultItemCard({
  item,
  vaultKey,
  recipients,
  assignedRecipientIds,
  witnesses,
  notarizations,
  onDeleted,
  onAssignmentChanged,
}: {
  item: VaultItemRow
  vaultKey: CryptoKey | null
  recipients: RecipientRow[]
  assignedRecipientIds: string[]
  witnesses: VaultItemWitnessRow[]
  notarizations: NotarizationRequestRow[]
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
          {item.category ? ` · ${CATEGORY_LABELS[item.category as VaultItemCategory] ?? item.category}` : ''}
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

        {item.captured_at && item.content_hash ? (
          <div className="mt-4 rounded-md border border-mist/70 bg-mist/20 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-cool">
              Verified capture time
            </p>
            <p className="mt-1 text-foreground">
              {new Date(item.captured_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
            <p className="mt-1 text-xs">
              This file's SHA-256 hash and capture time were recorded on your device before
              upload.
            </p>
          </div>
        ) : null}

        {witnesses.length > 0 ? (
          <div className="mt-4 border-t border-mist/70 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-cool">
              Witnessed by
            </p>
            <ul className="mt-1.5 space-y-1">
              {witnesses.map((witness) => (
                <li key={witness.id} className="text-foreground">
                  {witness.name}
                  <span className="text-muted-foreground">
                    {' '}
                    —{' '}
                    {new Date(witness.witnessed_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>{' '}
                  {witness.status === 'confirmed' ? (
                    <span className="text-xs text-seal">confirmed</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">awaiting confirmation</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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

        <div className="mt-4 flex items-center justify-between border-t border-mist/70 pt-3">
          <div className="flex items-center gap-2">
            <RequestNotarizationDialog itemId={item.id} itemTitle={item.title} />
            {notarizations.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {notarizations.some((n) => n.status === 'confirmed')
                  ? 'acknowledged'
                  : 'awaiting acknowledgement'}
              </span>
            ) : null}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending || !vaultKey}
              >
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif">Delete "{item.title}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can't be undone, and it will also be removed from anyone it was assigned to.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

function RequestNotarizationDialog({ itemId, itemTitle }: { itemId: string; itemTitle: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await requestNotarization({ data: { vaultItemId: itemId, requesterName: name, requesterContact: contact, note } })
      setSent(true)
    } catch {
      setError('Could not send that request. Try again.')
    } finally {
      setPending(false)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Reset after the close animation rather than mid-close, so the form
      // doesn't visibly flash back to empty before the dialog is gone.
      setTimeout(() => {
        setName('')
        setContact('')
        setNote('')
        setError(null)
        setSent(false)
      }, 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Request notarization
        </Button>
      </DialogTrigger>
      <DialogContent>
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif">Request sent</DialogTitle>
              <DialogDescription>
                We'll follow up with you directly about notarizing "{itemTitle}".
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-serif">Request notarization</DialogTitle>
              <DialogDescription>
                Not a real notary integration yet — this sends your request to Aeterna, who'll
                follow up about "{itemTitle}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="notary-name">Your name</Label>
                <Input id="notary-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notary-contact">Email or phone</Label>
                <Input
                  id="notary-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notary-note">Note (optional)</Label>
                <Textarea
                  id="notary-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Anything the notary should know"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !name || !contact}>
                {pending ? 'Sending…' : 'Send request'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

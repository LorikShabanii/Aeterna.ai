import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  assignLandParcelRecipient,
  createLandParcel,
  deleteLandParcel,
  listLandParcelRecipients,
  listLandParcels,
  unassignLandParcelRecipient,
} from '@/lib/land/parcels'
import { listRecipients } from '@/lib/recipients/recipients'
import type { LandParcelSource, RecipientRow } from '@/lib/supabase/types'
import { encryptFile } from '@/lib/crypto/vault-key'
import { getVaultKey } from '@/lib/crypto/session-key'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSealing } from '@/lib/use-sealing'
import { SealingOverlay } from '@/components/sealing-overlay'
import { UnlockVaultForm } from '@/components/unlock-vault-form'
import { LandParcelMap } from '@/components/land-parcel-map'
import { getProvider, SUPPORTED_COUNTRY_CODES } from '@/lib/land/providers/registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

const COUNTRY_LABELS: Record<string, string> = {
  XK: 'Kosovo',
  FR: 'France',
  LV: 'Latvia',
  ES: 'Spain',
}

export const Route = createFileRoute('/_authed/land')({
  loader: async () => {
    const [parcels, recipients, assignments] = await Promise.all([
      listLandParcels(),
      listRecipients(),
      listLandParcelRecipients(),
    ])
    return { parcels, recipients, assignments }
  },
  component: LandPage,
})

function LandPage() {
  const { parcels, recipients, assignments } = Route.useLoaderData()
  const router = useRouter()

  // Same pattern as /vault — the vault key lives only in memory and is
  // lost on refresh (src/lib/crypto/session-key.ts).
  const [vaultKey, setVaultKeyState] = useState<CryptoKey | null>(null)
  useEffect(() => {
    setVaultKeyState(getVaultKey())
  }, [])

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 font-serif text-2xl font-medium text-ink">Land & property</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Mark a specific piece of land, attach photos or documents to it, and assign it to the
        recipients who should inherit that plot — a structured claim per plot, not just a loose
        document in the vault.
      </p>

      {parcels.length > 0 ? (
        <div className="mb-6">
          <LandParcelMap
            markers={parcels.map((p) => ({
              id: p.id,
              name: p.name,
              lat: p.geo_boundary.lat,
              lng: p.geo_boundary.lng,
            }))}
          />
        </div>
      ) : null}

      {vaultKey ? (
        <NewParcelForm vaultKey={vaultKey} onCreated={() => router.invalidate()} />
      ) : (
        <UnlockVaultForm onUnlocked={(key) => setVaultKeyState(key)} />
      )}

      {vaultKey ? (
        <div className="mt-8 space-y-3">
          {parcels.length === 0 ? (
            <Card className="torn">
              <CardHeader>
                <CardTitle className="font-serif font-medium">No parcels yet</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Mark a piece of land above to start a structured claim for it.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {parcels.map((parcel) => (
                <li key={parcel.id}>
                  <ParcelCard
                    parcel={parcel}
                    vaultKey={vaultKey}
                    recipients={recipients}
                    assignedRecipientIds={assignments
                      .filter((a) => a.land_parcel_id === parcel.id)
                      .map((a) => a.recipient_id)}
                    onDeleted={() => router.invalidate()}
                    onAssignmentChanged={() => router.invalidate()}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : parcels.length > 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {parcels.length} parcel{parcels.length === 1 ? '' : 's'} — unlock to view details.
        </p>
      ) : null}
    </div>
  )
}

interface ParcelRow {
  id: string
  name: string
  geo_boundary: { type: 'point'; lat: number; lng: number }
  photo_urls: string[]
  country_code: string | null
  cadastral_reference: string | null
  source: LandParcelSource
  created_at: string
}

function NewParcelForm({
  vaultKey,
  onCreated,
}: {
  vaultKey: CryptoKey
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [visuallyConfirmed, setVisuallyConfirmed] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const { sealing, runSealed } = useSealing()

  const provider = countryCode ? getProvider(countryCode) : null
  const overlay = provider?.getMapOverlay() ?? null

  function handleFilesSelected(selected: FileList | null) {
    if (!selected) return
    setFiles((prev) => [...prev, ...Array.from(selected)])
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!countryCode) {
      setError('Pick a country first.')
      return
    }
    if (!position) {
      setError('Click the map to mark where this parcel is.')
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

        const photoPaths: string[] = []
        for (const file of files) {
          const encryptedBlob = await encryptFile(vaultKey, file)
          const storagePath = `${user.id}/land-parcels/${crypto.randomUUID()}/${file.name}`
          const { error: uploadError } = await supabase.storage
            .from('vault-files')
            .upload(storagePath, encryptedBlob, { contentType: 'application/octet-stream' })
          if (uploadError) throw uploadError
          photoPaths.push(storagePath)
        }

        // Automated matching isn't available from any provider yet (see
        // providers/kosovo.ts) — this always resolves to null today, but
        // the plumbing is here so a future provider that DOES support it
        // works without touching this form.
        const automated = await provider?.lookupParcel(position.lat, position.lng)
        const source: LandParcelSource = automated
          ? 'official_cadastre'
          : overlay && visuallyConfirmed
            ? 'official_cadastre_visual'
            : 'manual_pin'

        await createLandParcel({
          data: {
            name,
            lat: position.lat,
            lng: position.lng,
            photoPaths,
            countryCode,
            cadastralReference: automated?.cadastralReference ?? null,
            source,
          },
        })
      })
      setName('')
      setPosition(null)
      setVisuallyConfirmed(false)
      setFiles([])
      onCreated()
    } catch {
      setError('Could not save that parcel. Try again.')
    }
  }

  return (
    <Card className="torn">
      {sealing ? <SealingOverlay label="Sealing this parcel…" /> : null}
      <CardHeader>
        <CardTitle className="font-serif font-medium">Mark a parcel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parcel-country">Country</Label>
            <Select
              value={countryCode}
              onValueChange={(value) => {
                setCountryCode(value)
                setVisuallyConfirmed(false)
              }}
            >
              <SelectTrigger id="parcel-country" className="w-full">
                <SelectValue placeholder="Pick a country" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_COUNTRY_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {COUNTRY_LABELS[code] ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {countryCode && !overlay ? (
              <p className="text-xs text-muted-foreground">
                No official cadastral layer available for {COUNTRY_LABELS[countryCode]} yet —
                this will be a manual pin.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="parcel-name">Name</Label>
            <Input
              id="parcel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family plot, north field"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <p className="text-xs text-muted-foreground">
              {overlay
                ? `Click the map to drop a pin — official ${COUNTRY_LABELS[countryCode]} cadastral boundaries are shown for reference.`
                : 'Click the map to drop a pin where this parcel is.'}
            </p>
            <LandParcelMap
              markers={[]}
              pickable
              draftPosition={position}
              overlay={overlay}
              onPick={(lat, lng) => {
                setPosition({ lat, lng })
                setVisuallyConfirmed(false)
              }}
            />
            {position ? (
              <p className="text-xs text-cool">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </p>
            ) : null}
            {position && overlay ? (
              <div className="flex items-start gap-2 rounded-md border border-mist/70 bg-mist/20 p-3">
                <Checkbox
                  id="visually-confirmed"
                  checked={visuallyConfirmed}
                  onCheckedChange={(checked) => setVisuallyConfirmed(checked === true)}
                />
                <Label htmlFor="visually-confirmed" className="text-xs font-normal text-foreground">
                  This pin lands on an official parcel boundary shown on the map above.
                </Label>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="parcel-files">Photos or documents (optional)</Label>
            {files.length > 0 ? (
              <ul className="space-y-1.5">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(i)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Input
              id="parcel-files"
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              onChange={(e) => {
                const input = e.target
                handleFilesSelected(input.files)
                // Deferred to the next microtask — clearing input.value
                // synchronously inside its own change handler can race
                // with the browser's own file-selection bookkeeping (seen
                // reliably under CDP-driven automation; not worth risking
                // for real users either) and silently drop the selection.
                queueMicrotask(() => {
                  input.value = ''
                })
              }}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={sealing || !name || !position || !countryCode}>
            Seal parcel
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ParcelCard({
  parcel,
  vaultKey,
  recipients,
  assignedRecipientIds,
  onDeleted,
  onAssignmentChanged,
}: {
  parcel: ParcelRow
  vaultKey: CryptoKey
  recipients: RecipientRow[]
  assignedRecipientIds: string[]
  onDeleted: () => void
  onAssignmentChanged: () => void
}) {
  const [pending, setPending] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function handleToggleRecipient(recipientId: string, isAssigned: boolean) {
    setAssigning(recipientId)
    try {
      if (isAssigned) {
        await unassignLandParcelRecipient({ data: { landParcelId: parcel.id, recipientId } })
      } else {
        await assignLandParcelRecipient({ data: { landParcelId: parcel.id, recipientId } })
      }
      onAssignmentChanged()
    } finally {
      setAssigning(null)
    }
  }

  async function handleDownload(path: string) {
    setDownloadError(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: encryptedBlob, error } = await supabase.storage.from('vault-files').download(path)
      if (error || !encryptedBlob) throw error ?? new Error('Download failed')

      const { decryptToBlob } = await import('@/lib/crypto/vault-key')
      const decrypted = await decryptToBlob(vaultKey, encryptedBlob)
      const url = URL.createObjectURL(decrypted)
      const link = document.createElement('a')
      link.href = url
      link.download = path.split('/').pop() || 'file'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Could not decrypt this file — sign out and back in to retry.')
    }
  }

  async function handleDelete() {
    setPending(true)
    try {
      await deleteLandParcel({ data: { id: parcel.id, photoPaths: parcel.photo_urls } })
      onDeleted()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base font-medium">{parcel.name}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          {parcel.geo_boundary.lat.toFixed(5)}, {parcel.geo_boundary.lng.toFixed(5)}
          {parcel.country_code ? ` · ${COUNTRY_LABELS[parcel.country_code] ?? parcel.country_code}` : ''}
        </p>

        {parcel.source === 'official_cadastre' ? (
          <p className="mt-1 text-xs font-medium text-seal">
            Matched to official registry{parcel.cadastral_reference ? `: ${parcel.cadastral_reference}` : ''}
          </p>
        ) : parcel.source === 'official_cadastre_visual' ? (
          <p className="mt-1 text-xs font-medium text-seal">
            Checked against the official {parcel.country_code ? COUNTRY_LABELS[parcel.country_code] : ''}{' '}
            cadastre — not an automated match
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Approximate location — not matched to an official registry
          </p>
        )}

        {parcel.photo_urls.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-cool">
              Photos & documents
            </p>
            <ul className="mt-1.5 space-y-1">
              {parcel.photo_urls.map((path) => (
                <li key={path}>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => handleDownload(path)}
                  >
                    {path.split('/').pop()}
                  </Button>
                </li>
              ))}
            </ul>
            {downloadError ? <p className="mt-1 text-destructive">{downloadError}</p> : null}
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
                      id={`${parcel.id}-${recipient.id}`}
                      checked={isAssigned}
                      disabled={assigning === recipient.id}
                      onCheckedChange={() => handleToggleRecipient(recipient.id, isAssigned)}
                    />
                    <Label htmlFor={`${parcel.id}-${recipient.id}`} className="text-foreground">
                      {recipient.name}
                    </Label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-mist/70 pt-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending}
              >
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif">Delete "{parcel.name}"?</AlertDialogTitle>
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

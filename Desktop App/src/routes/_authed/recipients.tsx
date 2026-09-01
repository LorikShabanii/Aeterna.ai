import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { createRecipient, deleteRecipient, listRecipients } from '@/lib/recipients/recipients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authed/recipients')({
  loader: () => listRecipients(),
  component: RecipientsPage,
})

function RecipientsPage() {
  const recipients = Route.useLoaderData()
  const router = useRouter()

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Recipients</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Recipients aren't contacted or asked to confirm anything — they only receive vault items
        after a missed check-in runs its course. Assign recipients to specific items on the{' '}
        <span className="font-medium">Vault</span> page.
      </p>

      <NewRecipientForm onCreated={() => router.invalidate()} />

      <div className="mt-8 space-y-3">
        {recipients.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No recipients yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Add someone above — a name and an email address is all that's needed.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {recipients.map((recipient) => (
              <li key={recipient.id}>
                <RecipientCard recipient={recipient} onDeleted={() => router.invalidate()} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function NewRecipientForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await createRecipient({ data: { name, contact } })
      setName('')
      setContact('')
      onCreated()
    } catch {
      setError('Could not add that recipient. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a recipient</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient-name">Name</Label>
            <Input
              id="recipient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amara"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient-contact">Email</Label>
            <Input
              id="recipient-contact"
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="amara@example.com"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add recipient'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface RecipientRow {
  id: string
  name: string
  contact: string
}

function RecipientCard({
  recipient,
  onDeleted,
}: {
  recipient: RecipientRow
  onDeleted: () => void
}) {
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    try {
      await deleteRecipient({ data: { id: recipient.id } })
      onDeleted()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{recipient.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{recipient.contact}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending}>
          Delete
        </Button>
      </CardHeader>
    </Card>
  )
}

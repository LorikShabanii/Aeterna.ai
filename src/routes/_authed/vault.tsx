import { createFileRoute } from '@tanstack/react-router'
import { listVaultItems } from '@/lib/vault/items'
import { LogoutButton } from '@/components/logout-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authed/vault')({
  loader: () => listVaultItems(),
  component: VaultPage,
})

function VaultPage() {
  const items = Route.useLoaderData()
  const { user } = Route.useRouteContext()

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your vault</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No vault items yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Vault item creation (letters, documents, photos, videos) is the next build step.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {item.type}
                  {item.category ? ` · ${item.category}` : ''}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

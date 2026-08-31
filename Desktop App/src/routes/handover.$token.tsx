import { createFileRoute } from '@tanstack/react-router'
import { getHandoverInfo } from '@/lib/handover/handover'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Deliberately public and login-free, same as /recover — the token in the
// URL is the credential (see src/lib/handover/handover.ts for why this
// only lists titles rather than showing actual content).
export const Route = createFileRoute('/handover/$token')({
  loader: ({ params }) => getHandoverInfo({ data: { token: params.token } }),
  component: HandoverPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link not found</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : 'This link is invalid.'}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
})

function HandoverPage() {
  const { recipientName, ownerEmail, items } = Route.useLoaderData()

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper p-6 text-ink">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>For {recipientName}</CardTitle>
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
                <li key={i} className="rounded-md border border-input px-3 py-2 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground">
                    {item.type}
                    {item.category ? ` · ${item.category}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            Viewing the actual contents isn't available yet — this page currently only confirms
            what's been left for you.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

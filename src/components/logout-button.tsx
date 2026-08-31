import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  async function handleLogout() {
    setPending(true)
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    await navigate({ to: '/login' })
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={pending}>
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}

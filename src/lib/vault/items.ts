import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const listVaultItems = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // RLS (vault_items_select_own) scopes this to the current user regardless,
  // but filtering explicitly keeps the query's intent self-evident.
  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return data.map(({ id, type, title, category, created_at }) => ({
    id,
    type,
    title,
    category,
    created_at,
  }))
})

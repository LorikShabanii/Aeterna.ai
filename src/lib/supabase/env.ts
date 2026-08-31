function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill in your Supabase project settings.`,
    )
  }
  return value
}

export const supabaseUrl = required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)
export const supabaseAnonKey = required(
  'VITE_SUPABASE_ANON_KEY',
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

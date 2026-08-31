// Hand-written to match supabase/migrations/0001_vault_items.sql.
// Regenerate with `supabase gen types typescript` once the project has more
// tables and this drifts out of sync.

export type VaultItemType = 'letter' | 'document' | 'photo' | 'video' | 'financial'

export interface VaultItemRow {
  id: string
  user_id: string
  type: VaultItemType
  title: string
  encrypted_payload: string | null
  encrypted_file_url: string | null
  category: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      vault_items: {
        Row: VaultItemRow
        Insert: Omit<VaultItemRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<VaultItemRow, 'id' | 'user_id'>>
        Relationships: []
      }
    }
  }
}

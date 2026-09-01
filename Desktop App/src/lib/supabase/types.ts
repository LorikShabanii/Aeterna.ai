// Hand-written to match supabase/migrations/*.sql.
// Regenerate with `supabase gen types typescript` once this drifts out of sync.
//
// Row/Insert/Update are spelled out as plain object types rather than
// derived with Omit/Partial — Supabase's generic client machinery checks
// this shape structurally, and mapped types (what Omit/Partial produce)
// don't satisfy that check the way a plain object literal does.

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

export interface RecipientRow {
  id: string
  user_id: string
  name: string
  contact: string
  verification_status: string | null
  created_at: string
}

export interface VaultItemRecipientRow {
  vault_item_id: string
  recipient_id: string
  created_at: string
}

export interface ProfileRow {
  id: string
  check_in_frequency_days: number
  last_check_in_at: string
  created_at: string
  last_reminder_tier: number | null
}

export type CheckInMethod = 'biometric' | 'recovery_key'

export interface CheckinRow {
  id: string
  user_id: string
  checked_in_at: string
  method: CheckInMethod
}

export interface RecoveryKeyRow {
  id: string
  user_id: string
  key_hash: string
  created_at: string
  used_at: string | null
}

export interface HandoverRow {
  id: string
  user_id: string
  recipient_id: string
  token_hash: string
  created_at: string
  otp_hash: string | null
  otp_expires_at: string | null
  otp_attempts: number
}

export interface VaultKeyRow {
  user_id: string
  wrapped_by_password: string
  wrapped_by_escrow: string
  created_at: string
}

export interface Database {
  // Required by @supabase/supabase-js's generic client machinery — without
  // it, every query result silently types as `never`. Matches what
  // `supabase gen types typescript` emits for this project's Postgrest version.
  __InternalSupabase: {
    PostgrestVersion: '13'
  }
  public: {
    Tables: {
      vault_items: {
        Row: VaultItemRow
        Insert: {
          id?: string
          user_id: string
          type: VaultItemType
          title: string
          encrypted_payload?: string | null
          encrypted_file_url?: string | null
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: VaultItemType
          title?: string
          encrypted_payload?: string | null
          encrypted_file_url?: string | null
          category?: string | null
          created_at?: string
        }
        Relationships: []
      }
      recipients: {
        Row: RecipientRow
        Insert: {
          id?: string
          user_id: string
          name: string
          contact: string
          verification_status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          contact?: string
          verification_status?: string | null
          created_at?: string
        }
        Relationships: []
      }
      vault_item_recipients: {
        Row: VaultItemRecipientRow
        Insert: {
          vault_item_id: string
          recipient_id: string
          created_at?: string
        }
        Update: {
          vault_item_id?: string
          recipient_id?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: ProfileRow
        Insert: {
          id: string
          check_in_frequency_days?: number
          last_check_in_at?: string
          created_at?: string
          last_reminder_tier?: number | null
        }
        Update: {
          id?: string
          check_in_frequency_days?: number
          last_check_in_at?: string
          created_at?: string
          last_reminder_tier?: number | null
        }
        Relationships: []
      }
      checkins: {
        Row: CheckinRow
        Insert: {
          id?: string
          user_id: string
          checked_in_at?: string
          method: CheckInMethod
        }
        Update: {
          id?: string
          user_id?: string
          checked_in_at?: string
          method?: CheckInMethod
        }
        Relationships: []
      }
      recovery_keys: {
        Row: RecoveryKeyRow
        Insert: {
          id?: string
          user_id: string
          key_hash: string
          created_at?: string
          used_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          key_hash?: string
          created_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      handovers: {
        Row: HandoverRow
        Insert: {
          id?: string
          user_id: string
          recipient_id: string
          token_hash: string
          created_at?: string
          otp_hash?: string | null
          otp_expires_at?: string | null
          otp_attempts?: number
        }
        Update: {
          id?: string
          user_id?: string
          recipient_id?: string
          token_hash?: string
          created_at?: string
          otp_hash?: string | null
          otp_expires_at?: string | null
          otp_attempts?: number
        }
        Relationships: []
      }
      vault_keys: {
        Row: VaultKeyRow
        Insert: {
          user_id: string
          wrapped_by_password: string
          wrapped_by_escrow: string
          created_at?: string
        }
        Update: {
          user_id?: string
          wrapped_by_password?: string
          wrapped_by_escrow?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

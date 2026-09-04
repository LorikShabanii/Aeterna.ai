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
  content_hash: string | null
  captured_at: string | null
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

export type WitnessStatus = 'pending' | 'confirmed'

export interface VaultItemWitnessRow {
  id: string
  vault_item_id: string
  name: string
  contact: string
  // Only set once the witness actually confirms — null while pending.
  consent_text: string | null
  witnessed_at: string
  token_hash: string | null
  status: WitnessStatus
  confirmed_at: string | null
  photo_url: string | null
  created_at: string
}

export type NotarizationStatus = 'pending' | 'confirmed'

export interface NotarizationRequestRow {
  id: string
  vault_item_id: string
  user_id: string
  requester_name: string
  requester_contact: string
  note: string
  token_hash: string
  status: NotarizationStatus
  confirmed_at: string | null
  created_at: string
}

export interface ProfileRow {
  id: string
  check_in_frequency_days: number
  last_check_in_at: string
  created_at: string
  last_reminder_tier: number | null
  first_name: string | null
  last_name: string | null
  /** E.164, e.g. +38344123456. Optional — nothing sends SMS today. */
  phone: string | null
  /** ISO 3166-1 alpha-2 of the dial code the user picked. */
  phone_country: string | null
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

// v1 is a single pin; a future polygon shape can share this same jsonb
// column (e.g. `{ type: 'polygon', points: [...] }`) without a migration.
export interface GeoBoundaryPoint {
  type: 'point'
  lat: number
  lng: number
}
export type GeoBoundary = GeoBoundaryPoint

export type LandParcelSource = 'official_cadastre' | 'official_cadastre_visual' | 'manual_pin'

export interface LandParcelRow {
  id: string
  user_id: string
  name: string
  geo_boundary: GeoBoundary
  photo_urls: string[]
  country_code: string | null
  cadastral_reference: string | null
  source: LandParcelSource
  created_at: string
}

export interface LandParcelRecipientRow {
  land_parcel_id: string
  recipient_id: string
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
          content_hash?: string | null
          captured_at?: string | null
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
          content_hash?: string | null
          captured_at?: string | null
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
      vault_item_witnesses: {
        Row: VaultItemWitnessRow
        Insert: {
          id?: string
          vault_item_id: string
          name: string
          contact: string
          consent_text?: string | null
          witnessed_at: string
          token_hash?: string | null
          status?: WitnessStatus
          confirmed_at?: string | null
          photo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vault_item_id?: string
          name?: string
          contact?: string
          consent_text?: string | null
          witnessed_at?: string
          token_hash?: string | null
          status?: WitnessStatus
          confirmed_at?: string | null
          photo_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      notarization_requests: {
        Row: NotarizationRequestRow
        Insert: {
          id?: string
          vault_item_id: string
          user_id: string
          requester_name: string
          requester_contact: string
          note?: string
          token_hash: string
          status?: NotarizationStatus
          confirmed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vault_item_id?: string
          user_id?: string
          requester_name?: string
          requester_contact?: string
          note?: string
          token_hash?: string
          status?: NotarizationStatus
          confirmed_at?: string | null
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
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          phone_country?: string | null
        }
        Update: {
          id?: string
          check_in_frequency_days?: number
          last_check_in_at?: string
          created_at?: string
          last_reminder_tier?: number | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          phone_country?: string | null
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
      land_parcels: {
        Row: LandParcelRow
        Insert: {
          id?: string
          user_id: string
          name: string
          geo_boundary: GeoBoundary
          photo_urls?: string[]
          country_code?: string | null
          cadastral_reference?: string | null
          source?: LandParcelSource
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          geo_boundary?: GeoBoundary
          photo_urls?: string[]
          country_code?: string | null
          cadastral_reference?: string | null
          source?: LandParcelSource
          created_at?: string
        }
        Relationships: []
      }
      land_parcel_recipients: {
        Row: LandParcelRecipientRow
        Insert: {
          land_parcel_id: string
          recipient_id: string
          created_at?: string
        }
        Update: {
          land_parcel_id?: string
          recipient_id?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

-- Handover decryption (the design gap flagged when 20260906000000_handover.sql
-- was written: recipients never had the owner's password, so there was no
-- way for them to ever decrypt anything).
--
-- The vault key stops being derived directly from the password and becomes
-- a random key, stored wrapped two ways:
--   - wrapped_by_password: unwrapped client-side with the owner's password,
--     for normal day-to-day use (same UX as before).
--   - wrapped_by_escrow: RSA-OAEP-encrypted with a public key embedded in
--     the client (src/lib/crypto/escrow.ts) — only the matching private
--     key (an Edge Function secret, ESCROW_PRIVATE_KEY, never given to any
--     client) can unwrap it, and only heartbeat-cron does so, only at the
--     Day +7 tier, to put the key in a recipient's email link.
--
-- Honest tradeoff, not a cosmetic one: this means the service technically
-- *can* decrypt any vault at any time via the escrow key — the promise
-- becomes "not read during your lifetime, released automatically only at
-- the pre-committed delivery moment," not "literally impossible, ever."
-- A true zero-knowledge release without any trusted party is possible
-- (cryptographic timelocks) but far beyond MVP scope.
--
-- Known simplification: one vault key covers everything in the vault, so a
-- recipient's link can decrypt any item's ciphertext they might obtain —
-- not just the ones assigned to them. The app itself never hands a
-- recipient anything but their assigned items, so this isn't an active
-- exploit path today, but per-item keys (wrapped per-assignment) would be
-- needed for true isolation between recipients. Left as a follow-up.

create table vault_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wrapped_by_password text not null,
  wrapped_by_escrow text not null,
  created_at timestamptz not null default now()
);

alter table vault_keys enable row level security;

create policy "vault_keys_select_own"
  on vault_keys for select
  using (auth.uid() = user_id);

create policy "vault_keys_insert_own"
  on vault_keys for insert
  with check (auth.uid() = user_id);

-- No update/delete policy — a key, once set, isn't rotated in this pass.

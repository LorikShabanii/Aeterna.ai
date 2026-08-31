-- Recovery key (CLAUDE.md > False-trigger mitigation). The only safety net
-- against a missed check-in with no human confirmer in the loop — it can
-- push back the check-in deadline, and that's ALL it can do: it is a
-- separate secret from the vault encryption key and cannot decrypt
-- anything. Redemption is a public, no-login flow (src/routes/recover.tsx),
-- so it runs through the service-role client and needs no RLS write access.

create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method text not null check (method in ('biometric', 'recovery_key'))
);

create index checkins_user_id_idx on checkins (user_id);

alter table checkins enable row level security;

create policy "checkins_select_own"
  on checkins for select
  using (auth.uid() = user_id);

-- Regular check-ins are written by the authenticated user themselves.
-- Recovery-key redemptions are written via the service-role client (no
-- session exists during that public flow), which bypasses RLS entirely.
create policy "checkins_insert_own"
  on checkins for insert
  with check (auth.uid() = user_id);

create table recovery_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 of the recovery phrase — never the plaintext phrase itself.
  -- High-entropy (12+ BIP39 words, ~128 bits) so a fast hash is appropriate
  -- here, unlike a user-chosen password.
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index recovery_keys_user_id_idx on recovery_keys (user_id);

alter table recovery_keys enable row level security;

create policy "recovery_keys_select_own"
  on recovery_keys for select
  using (auth.uid() = user_id);

create policy "recovery_keys_insert_own"
  on recovery_keys for insert
  with check (auth.uid() = user_id);

-- Generating a new key retires any existing unused one first (one active
-- key at a time keeps redemption lookup unambiguous) — used keys stay
-- (no delete policy covers them) as a redemption history.
create policy "recovery_keys_delete_unused_own"
  on recovery_keys for delete
  using (auth.uid() = user_id and used_at is null);

-- No update policy: marking a key used happens only via the service-role
-- client during public redemption.

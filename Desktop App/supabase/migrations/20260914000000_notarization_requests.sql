-- Lightweight confirmation link for notarization requests (docs/roadmap-
-- differentiation-features.md > Feature 3 revision). Still a stub, not a
-- real e-signature integration (see that doc's TODO for the real
-- provider) — this just gives the emailed request a link the recipient
-- can click to acknowledge it, same public-token pattern as Handover
-- (20260906000000_handover.sql) and its OTP flow
-- (20260908000000_handover_otp.sql).

create table notarization_requests (
  id uuid primary key default gen_random_uuid(),
  vault_item_id uuid not null references vault_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  requester_name text not null,
  requester_contact text not null,
  note text not null default '',
  -- Hashed like every other public-link token in this app — the plaintext
  -- only ever lives in the emailed link.
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index notarization_requests_user_id_idx on notarization_requests (user_id);
create index notarization_requests_vault_item_id_idx on notarization_requests (vault_item_id);

alter table notarization_requests enable row level security;

create policy "notarization_requests_select_own"
  on notarization_requests for select
  using (auth.uid() = user_id);

create policy "notarization_requests_insert_own"
  on notarization_requests for insert
  with check (auth.uid() = user_id);

-- No update policy for authenticated users — confirming via the public
-- link happens with no session (whoever received the email), so that goes
-- through the service-role client instead, same pattern as Handover OTP
-- verification.

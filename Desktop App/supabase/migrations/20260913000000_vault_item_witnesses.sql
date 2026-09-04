-- Multi-witness co-signing at recording time (docs/roadmap-
-- differentiation-features.md > Feature 4): up to 2 people present at a
-- video testimony can be recorded as witnesses in the same session, at
-- the same client-generated timestamp as the video's own capture hash
-- (Feature 1 — vault_items.captured_at / content_hash). This is what
-- turns "my dad said this on video" into "my dad said this, witnessed by
-- two people, at a provable time."
--
-- consent_text holds a fixed attestation sentence, written when the
-- witness checks the consent checkbox at submit time (see
-- src/routes/_authed/vault.tsx) — not a hand-drawn/typed signature for
-- MVP, per the roadmap's "simple typed signature or consent checkbox"
-- either/or.

create table vault_item_witnesses (
  id uuid primary key default gen_random_uuid(),
  vault_item_id uuid not null references vault_items (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  contact text not null check (char_length(trim(contact)) > 0),
  consent_text text not null check (char_length(trim(consent_text)) > 0),
  -- Shared with the video's own vault_items.captured_at — the witness was
  -- present at that same moment, not whenever this row happens to commit.
  witnessed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index vault_item_witnesses_vault_item_id_idx on vault_item_witnesses (vault_item_id);

alter table vault_item_witnesses enable row level security;

-- No column for ownership on this table — scoped via the vault_item it
-- belongs to, same pattern as vault_item_recipients
-- (20260902000000_recipients.sql). No update policy: a witness record is
-- either right when it's created or it isn't; it can be deleted (e.g. the
-- whole vault_item is deleted) but not edited after the fact — editing
-- attested testimony after submission would undermine the point of it.
create policy "vault_item_witnesses_select_own"
  on vault_item_witnesses for select
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_item_witnesses.vault_item_id
        and vault_items.user_id = auth.uid()
    )
  );

create policy "vault_item_witnesses_insert_own"
  on vault_item_witnesses for insert
  with check (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_item_witnesses.vault_item_id
        and vault_items.user_id = auth.uid()
    )
  );

create policy "vault_item_witnesses_delete_own"
  on vault_item_witnesses for delete
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_item_witnesses.vault_item_id
        and vault_items.user_id = auth.uid()
    )
  );

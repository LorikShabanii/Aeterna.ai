-- Async witness confirmation (docs/roadmap-differentiation-features.md >
-- Feature 4 revision): witnesses now confirm themselves, by email, rather
-- than being self-attested by the vault owner at upload time — a real
-- evidentiary upgrade, since the person actually being named as a witness
-- is the one confirming it. Same public-token pattern as Handover and the
-- new notarization_requests table.
--
-- Deliberately NOT doing photo-vs-video face matching — see CLAUDE.md's
-- "Do not build a custom face-recognition model" and this doc's TODO for
-- why that's a separate, much bigger decision. A witness's optional photo
-- is stored as-is, for a human to look at later, never automatically
-- compared against anything.
--
-- consent_text is now nullable: it's only ever populated when the witness
-- actually confirms (previously it was always set at insert time, back
-- when the owner filled it in on the witness's behalf).

alter table vault_item_witnesses add column token_hash text unique;
alter table vault_item_witnesses add column status text not null default 'pending'
  check (status in ('pending', 'confirmed'));
alter table vault_item_witnesses add column confirmed_at timestamptz;
alter table vault_item_witnesses add column photo_url text;
alter table vault_item_witnesses alter column consent_text drop not null;
alter table vault_item_witnesses add constraint vault_item_witnesses_consent_when_confirmed
  check (status = 'pending' or consent_text is not null);

comment on column vault_item_witnesses.photo_url is
  'Path in the witness-photos Storage bucket — NOT client-side encrypted like vault-files, since the witness confirming has no access to the owner''s vault key. Owner-readable only via RLS, never publicly accessible.';

-- Witness-submitted photos can't go through the same client-side-
-- encrypt-before-upload pattern as vault-files: the witness confirming
-- via the public link has no session and no access to the owner's vault
-- key. This bucket is private (not encrypted) but still access-controlled
-- — only the owner can read their own witnesses' photos, and only the
-- confirmWitness server function (via the service-role client) ever
-- writes to it, so no public/anon write policy is needed at all.
insert into storage.buckets (id, name, public)
values ('witness-photos', 'witness-photos', false)
on conflict (id) do nothing;

create policy "witness_photos_select_own"
  on storage.objects for select
  using (bucket_id = 'witness-photos' and auth.uid()::text = (storage.foldername(name))[1]);

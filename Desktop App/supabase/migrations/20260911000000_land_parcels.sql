-- Parcel-level land mapping (docs/roadmap-differentiation-features.md >
-- Feature 2): a structured claim per plot of land, not just a loose
-- document in the vault — targets multi-heir land disputes where "which
-- piece of land" matters as much as "who inherits it."
--
-- geo_boundary is jsonb so v1 (a single pin) and a future polygon shape can
-- share one column without a schema change:
--   {"type": "point", "lat": 42.6629, "lng": 21.1655}
-- photo_urls holds paths into the existing 'vault-files' Storage bucket —
-- its owner-scoped RLS policies already cover any path prefix under the
-- user's own folder (see 20260901000000_vault_files_storage.sql), so no
-- new bucket/policy is needed. Client-side encrypted before upload, same
-- as vault_items files.

create table land_parcels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  geo_boundary jsonb not null,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index land_parcels_user_id_idx on land_parcels (user_id);

alter table land_parcels enable row level security;

create policy "land_parcels_select_own"
  on land_parcels for select
  using (auth.uid() = user_id);

create policy "land_parcels_insert_own"
  on land_parcels for insert
  with check (auth.uid() = user_id);

create policy "land_parcels_update_own"
  on land_parcels for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "land_parcels_delete_own"
  on land_parcels for delete
  using (auth.uid() = user_id);

-- Which recipients get which parcel — same join-table pattern as
-- vault_item_recipients (20260902000000_recipients.sql).
create table land_parcel_recipients (
  land_parcel_id uuid not null references land_parcels (id) on delete cascade,
  recipient_id uuid not null references recipients (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (land_parcel_id, recipient_id)
);

create index land_parcel_recipients_recipient_id_idx on land_parcel_recipients (recipient_id);

alter table land_parcel_recipients enable row level security;

create policy "land_parcel_recipients_select_own"
  on land_parcel_recipients for select
  using (
    exists (
      select 1 from land_parcels
      where land_parcels.id = land_parcel_recipients.land_parcel_id
        and land_parcels.user_id = auth.uid()
    )
  );

create policy "land_parcel_recipients_insert_own"
  on land_parcel_recipients for insert
  with check (
    exists (
      select 1 from land_parcels
      where land_parcels.id = land_parcel_recipients.land_parcel_id
        and land_parcels.user_id = auth.uid()
    )
    and exists (
      select 1 from recipients
      where recipients.id = land_parcel_recipients.recipient_id
        and recipients.user_id = auth.uid()
    )
  );

create policy "land_parcel_recipients_delete_own"
  on land_parcel_recipients for delete
  using (
    exists (
      select 1 from land_parcels
      where land_parcels.id = land_parcel_recipients.land_parcel_id
        and land_parcels.user_id = auth.uid()
    )
  );

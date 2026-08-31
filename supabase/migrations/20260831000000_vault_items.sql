-- vault_items: the core "vault" table (CLAUDE.md > Data model).
-- Owner-only for now — vault_item_recipients / Handover access is added in a
-- later migration once the Recipients step of the build order lands.

create type vault_item_type as enum ('letter', 'document', 'photo', 'video', 'financial');

create table vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type vault_item_type not null,
  title text not null check (char_length(trim(title)) > 0),
  -- Client-side encrypted (AES-256-GCM) before it ever reaches Postgres —
  -- the server must never see plaintext. See CLAUDE.md > Encryption approach.
  encrypted_payload text,
  encrypted_file_url text,
  category text,
  created_at timestamptz not null default now(),
  constraint vault_items_has_content check (
    encrypted_payload is not null or encrypted_file_url is not null
  )
);

create index vault_items_user_id_idx on vault_items (user_id);

alter table vault_items enable row level security;

-- Recipients are not confirmers and are never granted read access here —
-- they only receive items via the Handover portal after final delivery
-- (CLAUDE.md > Core mechanic). Until that flow exists, access is owner-only.
create policy "vault_items_select_own"
  on vault_items for select
  using (auth.uid() = user_id);

create policy "vault_items_insert_own"
  on vault_items for insert
  with check (auth.uid() = user_id);

create policy "vault_items_update_own"
  on vault_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "vault_items_delete_own"
  on vault_items for delete
  using (auth.uid() = user_id);

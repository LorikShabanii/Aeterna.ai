-- Recipients (CLAUDE.md > Data model). Name + contact only — recipients are
-- NOT confirmers and are never contacted until final delivery, so there is
-- deliberately no notification/invite logic here or anywhere upstream of
-- the Handover step.

create table recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  contact text not null check (char_length(trim(contact)) > 0),
  -- Only meaningful at Handover time (identity verification), not before —
  -- no logic reads or writes this yet.
  verification_status text,
  created_at timestamptz not null default now()
);

create index recipients_user_id_idx on recipients (user_id);

alter table recipients enable row level security;

create policy "recipients_select_own"
  on recipients for select
  using (auth.uid() = user_id);

create policy "recipients_insert_own"
  on recipients for insert
  with check (auth.uid() = user_id);

create policy "recipients_update_own"
  on recipients for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "recipients_delete_own"
  on recipients for delete
  using (auth.uid() = user_id);

-- Which recipients get which vault items.
create table vault_item_recipients (
  vault_item_id uuid not null references vault_items (id) on delete cascade,
  recipient_id uuid not null references recipients (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vault_item_id, recipient_id)
);

create index vault_item_recipients_recipient_id_idx on vault_item_recipients (recipient_id);

alter table vault_item_recipients enable row level security;

-- Ownership isn't a column on this join table, so policies check it via the
-- vault_item and recipient rows it links — both of which are already
-- owner-scoped by the policies above.
create policy "vault_item_recipients_select_own"
  on vault_item_recipients for select
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_item_recipients.vault_item_id
        and vault_items.user_id = auth.uid()
    )
  );

create policy "vault_item_recipients_insert_own"
  on vault_item_recipients for insert
  with check (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_item_recipients.vault_item_id
        and vault_items.user_id = auth.uid()
    )
    and exists (
      select 1 from recipients
      where recipients.id = vault_item_recipients.recipient_id
        and recipients.user_id = auth.uid()
    )
  );

create policy "vault_item_recipients_delete_own"
  on vault_item_recipients for delete
  using (
    exists (
      select 1 from vault_items
      where vault_items.id = vault_item_recipients.vault_item_id
        and vault_items.user_id = auth.uid()
    )
  );

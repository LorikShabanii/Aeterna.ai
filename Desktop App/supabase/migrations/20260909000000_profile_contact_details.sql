-- Name and optional phone collected at signup (CLAUDE.md > Data model lists
-- `display_name` on users; first/last name is the same idea, split so the
-- Handover email can address a recipient properly later).
--
-- These live on `profiles` rather than in a new table because they are
-- 1:1 with the user and already covered by the owner-only RLS policies in
-- 20260903000000_heartbeat.sql.
--
-- Phone is deliberately nullable: it is optional on the signup form, and
-- nothing in the product sends SMS today. Stored in E.164 (+38344123456)
-- alongside the ISO country the user picked, so the country survives even
-- for dial codes shared by several countries (+1 is US and Canada).

alter table profiles add column first_name text;
alter table profiles add column last_name text;
alter table profiles add column phone text;
alter table profiles add column phone_country text;

-- Signup writes these into auth.users.raw_user_meta_data (the only thing a
-- client can write before a session exists when email confirmation is on).
-- The new-user trigger copies them across into the profile it already
-- creates, so the app never needs a second authenticated round-trip.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, phone_country)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone_country'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill anyone who signed up before this migration but whose metadata
-- already carries the fields; the trigger above only fires on insert.
update public.profiles p
set
  first_name = coalesce(p.first_name, nullif(trim(u.raw_user_meta_data ->> 'first_name'), '')),
  last_name = coalesce(p.last_name, nullif(trim(u.raw_user_meta_data ->> 'last_name'), '')),
  phone = coalesce(p.phone, nullif(trim(u.raw_user_meta_data ->> 'phone'), '')),
  phone_country = coalesce(p.phone_country, nullif(trim(u.raw_user_meta_data ->> 'phone_country'), ''))
from auth.users u
where u.id = p.id;

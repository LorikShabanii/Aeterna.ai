-- Heartbeat (CLAUDE.md > Core mechanic / Data model). Tracks check-ins so a
-- future scheduled Edge Function can walk the escalation timeline
-- (Day 0 / +2 / +5 / +7-or-custom). This migration only adds the tracking
-- table and the check-in action itself — the cron job, reminder emails, and
-- the Day+7 delivery trigger are separate, later pieces of this build step.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Free tier is a fixed 7-day cadence; paid tier makes this editable
  -- (CLAUDE.md > Escalation timeline) — no billing/editing UI yet, so
  -- every profile just gets the free-tier default for now.
  check_in_frequency_days integer not null default 7 check (check_in_frequency_days > 0),
  last_check_in_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row for new signups.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users who signed up before this migration — the
-- trigger above only fires on new auth.users inserts.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

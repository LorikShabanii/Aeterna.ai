# Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In Project Settings > API, copy the Project URL and `anon` `public` key
   into `.env` (see `.env.example` at the repo root).
3. Apply the schema in `migrations/`:
   - **SQL editor** (fastest for MVP): paste the contents of each file in
     `migrations/`, in filename order, into the Supabase SQL editor and run.
   - **Supabase CLI**: `supabase link --project-ref <ref>` then
     `supabase db push`.
4. Auth > Providers: Email is enabled by default. Decide whether to require
   email confirmation (Auth > Providers > Email > "Confirm email") — the
   signup UI in `src/routes/signup.tsx` already handles both cases.

## What's in `migrations/`

- `20260831000000_vault_items.sql` — the `vault_items` table (letters,
  documents, photos, videos, financial notes) with owner-only Row Level
  Security. `auth.users` (built into Supabase Auth) is used directly as the
  owner reference — no separate `public.users` table exists yet.

## Not yet migrated

Per CLAUDE.md's data model, `recipients`, `vault_item_recipients`,
`checkins`, and `recovery_keys` are follow-up migrations tied to their own
build-order steps (Recipients, Heartbeat, Recovery key) — not part of this
pass, which only covers Auth + `vault_items`.

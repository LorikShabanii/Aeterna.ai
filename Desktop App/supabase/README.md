# Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In Project Settings > API, copy the Project URL, `anon`/`publishable` key,
   and `service_role`/`secret` key into `.env` (see `.env.example` at the
   repo root). The service role key is only needed for the recovery-key
   redemption flow and the heartbeat cron — never commit it or put it in
   `.env.example`.
3. Apply the schema in `migrations/`, **in filename order** — paste each
   file's contents into the Supabase SQL editor and run it separately (a
   later file references tables an earlier one creates, and running them
   concatenated as one script means a "table already exists" error on a
   re-run aborts the whole batch, silently skipping the rest).
4. Auth > Providers: Email is enabled by default. Decide whether to require
   email confirmation (Auth > Providers > Email > "Confirm email") — the
   signup UI in `src/routes/signup.tsx` already handles both cases.
5. For the escalation reminder emails, see
   `functions/heartbeat-cron/README.md` — separate setup (Gmail App
   Password + Supabase CLI secrets + function deploy).

## What's in `migrations/`

- `20260831000000_vault_items.sql` — the `vault_items` table, owner-only RLS.
- `20260901000000_vault_files_storage.sql` — the `vault-files` Storage
  bucket + owner-only object policies, for document/photo/video uploads.
- `20260902000000_recipients.sql` — `recipients` + `vault_item_recipients`
  (who gets which item). Recipients are never contacted before Handover.
- `20260903000000_heartbeat.sql` — `profiles` (check-in tracking) + a
  trigger that creates one for every new signup.
- `20260904000000_recovery_keys.sql` — `recovery_keys` (hashed, redeemable
  from the public `/recover` page) + `checkins` (audit log by method).
- `20260905000000_heartbeat_escalation.sql` — adds `last_reminder_tier` to
  `profiles` and schedules the hourly cron that calls the
  `heartbeat-cron` Edge Function. **Edit the `<CRON_SECRET>` placeholder in
  this file to match what you set in step 5 before running it.**
- `20260909000000_profile_contact_details.sql` — adds `first_name`,
  `last_name`, `phone` (E.164, nullable) and `phone_country` to `profiles`,
  and rewrites `handle_new_user()` to copy them out of the signup metadata.

## Not yet migrated

Per CLAUDE.md's data model/build order, the Handover portal (recipient
identity verification + actual delivery of vault items) doesn't exist yet —
`heartbeat-cron`'s Day +7 tier only emails the account owner a final
notice, it does not contact recipients.

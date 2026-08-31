# heartbeat-cron

Sends the escalation reminder emails (CLAUDE.md > Escalation timeline) via
Gmail SMTP — an interim stand-in for Resend/Postmark until a real domain is
set up. Runs hourly, triggered by `pg_cron` (see the
`20260905000000_heartbeat_escalation.sql` migration).

## One-time setup

1. **Gmail App Password** — this only works with an App Password, not your
   normal Gmail password:
   - Turn on 2-Step Verification: https://myaccount.google.com/signinoptions/two-step-verification
   - Create an app password for "Mail": https://myaccount.google.com/apppasswords
   - Copy the 16-character password (spaces don't matter).

2. **Log in to the Supabase CLI** (opens a browser):
   ```
   supabase login
   ```

3. **Link this project** (only needed once):
   ```
   supabase link --project-ref lnrjryuaxfcdwasexgba
   ```

4. **Set the function's secrets** (server-only — these never touch the app's
   own `.env`/bundle, they live in Supabase's Edge Function environment):
   ```
   supabase secrets set SMTP_USER=loriksh12@gmail.com
   supabase secrets set SMTP_APP_PASSWORD=<the 16-char app password>
   supabase secrets set CRON_SECRET=<any random string you make up>
   supabase secrets set APP_URL=http://localhost:3000
   ```
   `CRON_SECRET` just needs to match the value pasted into the migration's
   `Authorization` header — it stops randoms from POSTing to this function's
   public URL and triggering it. `APP_URL` should become the real deployed
   URL once this app is hosted somewhere.

5. **Deploy the function** — `--no-verify-jwt` is required: Supabase's own
   gateway otherwise demands a real Supabase JWT on every request and
   rejects the `CRON_SECRET` bearer token before this function's own code
   (which checks `CRON_SECRET` itself) ever runs:
   ```
   supabase functions deploy heartbeat-cron --no-verify-jwt
   ```

6. **Run the migration** (`20260905000000_heartbeat_escalation.sql`) in the
   SQL editor — but first replace `<CRON_SECRET>` in that file with the same
   value you set in step 4.

## Testing it without waiting for the cron

```
curl -X POST https://lnrjryuaxfcdwasexgba.supabase.co/functions/v1/heartbeat-cron \
  -H "Authorization: Bearer <CRON_SECRET>"
```

To actually see an email, set a test account's `check_in_frequency_days` to
a small number (or manually backdate `last_check_in_at`) so it's overdue.

## Known limits (by design, for now)

- Day +7 only emails the account owner — it does not deliver anything to
  recipients. That's the Handover portal, a separate later build step.
- Gmail SMTP is a personal-account stand-in. Move to Resend/Postmark once a
  domain is available — swap `sendEmail()` for their API and this stops
  depending on a personal Gmail account's sending limits (~500/day) and app
  password.

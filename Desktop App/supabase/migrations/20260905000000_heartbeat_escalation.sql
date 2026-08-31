-- Escalation cron wiring (CLAUDE.md > Escalation timeline). The actual
-- tier logic + email sending lives in the Edge Function
-- (supabase/functions/heartbeat-cron) — this migration just adds the
-- column that tracks which reminder tier was last sent (so the cron
-- doesn't re-email the same tier every time it runs) and schedules that
-- function to run hourly via pg_cron + pg_net.
--
-- Tiers, in days overdue past the check-in due date: 0, 2, 5, 7+ — matching
-- Day 0 / +2 / +5 / +7 from CLAUDE.md. Day +7 only sends a final notice to
-- the account owner here; actual delivery to recipients is the Handover
-- portal, a separate later build step (CLAUDE.md explicitly says recipients
-- aren't contacted before then).

alter table profiles add column last_reminder_tier integer;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Replace <CRON_SECRET> below with the same value passed to
-- `supabase secrets set CRON_SECRET=...` before running this (see
-- supabase/functions/heartbeat-cron/README.md). Re-run just this select if
-- you rotate the secret later — cron.schedule replaces a job of the same name.
select cron.schedule(
  'heartbeat-escalation',
  '0 * * * *', -- hourly
  $$
  select net.http_post(
    url := 'https://lnrjryuaxfcdwasexgba.supabase.co/functions/v1/heartbeat-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

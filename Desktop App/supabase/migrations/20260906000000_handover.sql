-- Handover, minimal first slice (CLAUDE.md > Core mechanic, step 3 /
-- build order step 7). This is deliberately NOT full Handover yet:
--
-- Recipients were never given the owner's master password, so there is
-- currently no way for them to decrypt anything — that's a real unsolved
-- design question (likely needs the vault key split/escrowed so a copy
-- becomes recoverable only after delivery triggers). Solving that is out
-- of scope for this slice.
--
-- What THIS slice does: at the Day +7 tier, heartbeat-cron emails each
-- recipient assigned to one of the owner's items a link to a page that
-- lists *what* they've been entrusted with (titles only, no content) —
-- proving the notification pipeline works end to end, honestly, without
-- pretending content delivery exists yet.

create table handovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references recipients (id) on delete cascade,
  -- Hashed like recovery_keys — the plaintext token only ever lives in the
  -- emailed link, which is itself the credential for this public, no-login page.
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id, recipient_id)
);

create index handovers_user_id_idx on handovers (user_id);

alter table handovers enable row level security;

create policy "handovers_select_own"
  on handovers for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for authenticated users — rows are only
-- ever written by heartbeat-cron via the service-role client, and the
-- public handover page reads by token via the same service-role client
-- (a recipient has no session to authenticate with).

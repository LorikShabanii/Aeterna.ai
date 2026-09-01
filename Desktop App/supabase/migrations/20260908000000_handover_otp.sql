-- Stubbed OTP-by-email identity verification for Handover (CLAUDE.md build
-- order step 7: "identity verification can be a stubbed OTP-by-email for
-- MVP"). The handover token alone already proves inbox access at the
-- moment it was emailed; this adds a second check that proves *current*
-- access, in case the link itself later leaks (forwarded, browser
-- history, shared computer) — a 6-digit code re-sent to the same address
-- on demand.

alter table handovers add column otp_hash text;
alter table handovers add column otp_expires_at timestamptz;
alter table handovers add column otp_attempts integer not null default 0;

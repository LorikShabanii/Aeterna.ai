# Aeterna — Project Brief for Claude Code

This file gives Claude Code the full context for building Aeterna. Read this
before making changes. It reconciles the Lovable-generated landing page
(design system to KEEP) with the fuller product concept (functionality to ADD).

## What exists already (do not rebuild)

- **Stack**: TanStack Start, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
  ("new-york" style, Radix primitives), Bun package manager.
- **Design system to preserve**: the "sealed letter" aesthetic in
  `src/routes/index.tsx` and `src/styles.css` — color tokens `paper`, `ink`,
  `cool`, `seal`, `mist`, `fog`; serif display type + sans body type; the
  "torn edge" card treatment. This UI direction is a deliberate choice and
  should be extended into the app screens, not replaced.
- **shadcn components already installed**: accordion, alert-dialog, avatar,
  calendar, card, checkbox, dialog, dropdown-menu, form, input, select,
  sheet, sidebar, table, tabs, tooltip, and more — use these instead of
  building new primitives.
- Currently the app is **landing-page only**. No auth, no database, no
  vault logic, no file upload, no backend exists yet.

## What Lovable narrowed (important context)

Lovable's copy drifted the concept toward "sealed letters" only (text
messages to loved ones). The actual product is broader — a vault that
holds **letters, documents, photos, videos, and scanned files** — and has
one additional real-world use case that the original Aeterna spec didn't
have: **land/property succession documentation for the Balkans**, based on
a real, well-documented problem (~60% of properties in Kosovo are
unregistered; cadastral records were destroyed/relocated during the
1998-99 war; property/inheritance cases are described by Kosovo's own
courts as among the most complex due to missing documentation).

**Resolution**: keep the "letter/vault" language and visual metaphor for
the UI (it's good, keep it), but generalize the underlying data model so a
"vault item" can be a letter, a financial note, a scanned document, or a
video testimony — with land/succession as one supported item type, not a
separate app.

## Core mechanic (revised — no guardian-confirmation step)

1. **The Vault** — user creates encrypted vault items, each assigned to
   one or more recipients.
2. **The Heartbeat** — user checks in via device biometrics (see below).
   Missed check-ins trigger a graduated reminder sequence, then delivery.
   There is **no living human confirmer** in this design — delivery is a
   deliberate surprise to recipients. See "False-trigger mitigation"
   below for how this risk is handled instead.
3. **The Handover** — after the final trigger, recipients get a secure
   link, verify identity, and receive their assigned items.

### Escalation timeline

| Trigger point | Action |
|---|---|
| Day 0 (missed check-in) | Push/email reminder |
| Day +2 | Second reminder |
| Day +5 | Final warning — explicitly reminds the user their recovery key can push the deadline |
| Day +7 (free tier) or custom interval (paid tier) | Vault delivered to recipients — no human confirmation step |

Free tier: fixed 7-day cadence and 7-day grace window. Paid tier: both the
check-in cadence and the grace window are user-configurable
(`check_in_frequency_days`, editable).

### False-trigger mitigation (replaces guardian confirmation)

Since there's no second human in the loop, the **recovery key is the only
safety net** — it has to be genuinely reliable:

- Recovery key is a **separate secret from the vault encryption key** — it
  can only push back the check-in deadline, it cannot decrypt anything.
  Losing it should be inconvenient, not catastrophic.
- Delivered once, at signup/payment — printable card or a BIP39-style
  12-24 word phrase, meant to be stored offline (wallet, safe, etc.).
- Redeemable from a plain, no-login public webpage (works even without
  the phone/device that normally does the biometric check-in).
- Reminder copy (Day +5 especially) must explicitly tell the user this
  key exists and how to use it — this is the main lever against false
  positives, so it can't be a buried settings-page fact.

## Data model (target — none of this exists yet)

```
users
  id, email, display_name
  check_in_frequency_days, last_check_in_at

recipients
  id, user_id (owner), name, contact (email/phone)
  verification_status         -- checked at handover time, not before

vault_items
  id, user_id, type: 'letter' | 'document' | 'photo' | 'video' | 'financial'
  title
  encrypted_payload          -- for short text (client-side encrypted)
  encrypted_file_url         -- for uploaded files (client-side encrypted before upload)
  category                    -- e.g. 'personal', 'financial', 'land_succession'
  created_at

vault_item_recipients
  vault_item_id, recipient_id     -- which recipients get which items

checkins
  id, user_id, checked_in_at, method    -- method: 'biometric' | 'recovery_key'

recovery_keys
  id, user_id, key_hash (never store plaintext), created_at, used_at (nullable)
```

Land/succession items are just `vault_items` with `category:
'land_succession'` — no separate schema needed for MVP. Witness/notary
co-signing and OCR on scanned documents are Phase 2, not MVP (see below).

Note: recipients are NOT confirmers and are not contacted until final
delivery — do not build any notification-to-recipient logic before the
Handover step.

## Encryption approach

- Client-side encryption using the Web Crypto API before anything is sent
  to the server. The server/database must never see plaintext or the
  user's key.
- For MVP, a simple approach: derive an encryption key from the user's
  master password (never transmitted) using PBKDF2/Argon2 in-browser;
  encrypt payloads/files with AES-256-GCM before upload.
- Flag clearly in the UI (already done in the landing copy: "the courier
  never reads the letter") — keep this promise true in the implementation.

## Platform (MVP decision)

**Desktop app, built with Tauri.** Wrap the existing React/Tailwind/shadcn
UI in Tauri rather than rewriting it. Mobile (Capacitor, iOS/Android) is
explicitly Phase 2 — do not build mobile-specific code paths for MVP.

Tauri gives access to native OS biometric prompts (Windows Hello on
Windows, Touch ID/Face ID via `local-authentication`-equivalent APIs on
macOS) for the Heartbeat check-in. **Do not build a custom face-recognition
model** — call the OS biometric API and treat its pass/fail result as the
check-in signal. The app never touches raw biometric data; this avoids
BIPA/GDPR special-category-data exposure that a custom facial-recognition
system would create.

## Suggested backend

**Supabase** (Postgres + Auth + Storage + Row Level Security) — matches
the original spec, fast to stand up, and RLS enforces that a user's rows
are only readable by that user (and, after handover, by verified
recipients). Skip Redis for MVP — a `last_check_in_at` timestamp column
plus a scheduled Supabase Edge Function (cron) covers the Heartbeat logic
without extra infra.

## Build order (MVP)

1. **Auth** — Supabase Auth (email/password at signup), then bind OS
   biometric check-in as the day-to-day login/check-in method inside the
   Tauri shell.
2. **Vault CRUD** — create/view/delete vault items, starting with the
   `letter` type (text only) since the UI already expects this.
3. **File upload** — add `document`/`photo`/`video` types with client-side
   encryption before upload to Supabase Storage. This is where the
   image-to-PDF scanning feature plugs in: scan → merge pages → PDF →
   encrypt → upload, then link the resulting file to a `vault_item`
   (optionally alongside a video testimony for the same item).
4. **Recipients** — add/manage recipients (name + contact only), assign
   vault items to them. No confirmation or notification logic here.
5. **Heartbeat** — biometric check-in UI + Edge Function cron that walks
   the escalation table above (Day 0 / +2 / +5 / +7-or-custom).
6. **Recovery key** — generate at signup/payment, one-time display,
   public no-login redemption page that pushes back the deadline.
7. **Handover portal** — recipient-facing route, triggered only after
   final delivery; identity verification can be a stubbed OTP-by-email
   for MVP (real ID verification, e.g. Stripe Identity, is Phase 2).

## Explicitly out of scope for MVP (Phase 2+)

- Mobile app (Capacitor/iOS/Android).
- OCR on scanned documents.
- Cryptographic hashing/timestamping of scans and videos for
  evidentiary/legal weight (needed before this is pitched as usable in an
  actual property dispute).
- Notary/witness co-signing flow for land-succession items.
- Real government ID verification (Stripe Identity/Onfido).
- Multi-language UI.
- Paid-tier billing logic beyond gating custom cadence (full Stripe
  subscription management can follow once core flows work).

## Accounts / integrations needed before building

| Item | For | Notes |
|---|---|---|
| Supabase project | DB, Auth, Storage | Project URL + anon key (client) + service role key (server-only, never expose in the app bundle) |
| Email service (Resend or Postmark) | Check-in reminders, recovery key delivery | API key |
| Stripe | Paid tier | Gates custom check-in cadence + custom grace window |
| Apple Developer account | macOS notarization for Tauri build | Needed to distribute outside sideloading |
| Windows code-signing cert | Windows build trust | Optional for MVP but needed before public distribution |
| Domain | Marketing site + API | — |

## Non-goals generally

- Do not hold funds or execute any financial transaction — Aeterna stores
  and delivers information, it is not a payments product.
- Do not claim the product is "legally binding" anywhere in the UI or
  copy without a lawyer's sign-off — see Phase 2 evidentiary-weight items
  above.

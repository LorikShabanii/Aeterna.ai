# Roadmap: competitive-differentiation features

Backlog spec for four features that differentiate Aeterna from generic vault
competitors (GoodTrust, DGLegacy, Trustworthy) by targeting the
land/succession-documentation use case specifically (see CLAUDE.md's "What
Lovable narrowed" section for that context). **Not started** — saved here so
a future session can pick this up without re-deriving the plan.

Build these as extensions to the existing `vault_items` model, not a
separate app. Build order: **Feature 1 first** — Features 2-4 all depend on
the hash/timestamp pattern it establishes. Build incrementally; show the
resulting schema and UI after each feature before starting the next.

Before starting: this moves items 2 and 4 below out of CLAUDE.md's
"Explicitly out of scope for MVP (Phase 2+)" list — update that section
when work begins (see the note at the bottom of this file).

## Feature 1 — Evidentiary hashing and timestamping

When a user captures a video, photo, or scanned document, compute a SHA-256
hash of the file client-side at the moment of capture — before encryption,
before upload. Store the hash and a client-generated timestamp alongside
the encrypted payload in `vault_items`. Show the user a "verified capture
time" on the item's detail view.

Goal: make it provable later that a specific file existed, unmodified, at a
specific time — this is what turns "a video in a vault" into something with
evidentiary weight.

Implementation notes:
- Hash via `crypto.subtle.digest('SHA-256', fileBytes)` (Web Crypto API,
  already used elsewhere for encryption — see `src/lib/crypto/`), computed
  on the raw file **before** `encryptFile`/upload, not on the ciphertext.
- New columns on `vault_items`: `content_hash` (text, hex or base64 SHA-256)
  and `captured_at` (timestamptz, client-generated at capture — distinct
  from `created_at`, which is server-set on insert).
- "Verified capture time" UI: show `captured_at` + a short explanation
  (e.g. "This file's SHA-256 hash and capture time were recorded on your
  device before upload") on the vault item detail view.

## Feature 2 — Parcel-level land mapping

New table `land_parcels`: `id`, `user_id`, `name`, `geo_boundary`
(lat/lng pin or polygon), `photo_urls` (encrypted), `assigned_recipient_ids`.

Build a simple map-based UI (a single pin is fine for v1; polygon drawing
can come later) where a user marks a specific piece of land, attaches
photos/documents to it, and assigns it to one or more recipients.

Goal: this directly targets multi-heir land disputes — a structured claim
per plot, not just a loose document in the vault.

Implementation notes:
- Needs a map library — none currently installed; pick one that works
  inside a Tauri webview (Leaflet + OpenStreetMap tiles is the simplest
  no-API-key option; avoid anything requiring a Google Maps billing key for
  MVP).
- `photo_urls` follows the existing encrypted-file-upload pattern used for
  `vault_items.encrypted_file_url` (client-side encrypt before upload to
  the `vault-files` Storage bucket).
- `assigned_recipient_ids` — decide whether this is a join table (matching
  the existing `vault_item_recipients` pattern) or a plain array column;
  the join-table pattern is more consistent with the rest of the schema.
- RLS: owner-only, matching every other table (see any migration in
  `supabase/migrations/` for the policy pattern).

## Feature 3 — Notary/lawyer referral flow (stub for MVP)

Add a "Request notarization" button on any `vault_item`. For now this is a
lightweight stub, not a real integration: it opens a simple form (name,
contact, note) and sends it via the existing email service (Resend/Postmark
— see `supabase/functions/heartbeat-cron/` for the existing email-sending
pattern via nodemailer/Deno npm specifier).

Structure the code so a real local notary/lawyer partner API can be swapped
in later without changing the UI — e.g. a single `requestNotarization()`
server function that currently just emails a fixed address, behind an
interface that could later hit a real partner API instead.

## Feature 4 — Multi-witness co-signing at recording time

When a user records a video testimony, allow up to 2 additional people to
be added as witnesses in the same session: name, contact, and a simple
typed signature or consent checkbox, timestamped at the same moment as the
video hash from Feature 1.

Store witness records linked to the `vault_item` (new table, e.g.
`vault_item_witnesses`: `id`, `vault_item_id`, `name`, `contact`,
`consent_text` or `signature_text`, `witnessed_at`).

Goal: this is what turns "my dad said this on video" into "my dad said
this, witnessed by two people, at a provable time."

Depends on Feature 1's capture-time hashing/timestamp UI already existing
in the video-recording flow, since witness consent is captured at the same
moment.

## When picking this back up

1. Re-read CLAUDE.md for current build status (it may have moved further
   since this doc was written).
2. Move the "Cryptographic hashing/timestamping" and "Notary/witness
   co-signing flow" bullets out of CLAUDE.md's "Explicitly out of scope for
   MVP (Phase 2+)" section — this roadmap supersedes that for those two
   items.
3. Start with Feature 1, following the migration-numbering convention in
   `supabase/migrations/` (filename-ordered timestamps) and the existing
   `as unknown as {...}` cast workaround needed at Supabase write call
   sites (see any file under `src/lib/*/` for the pattern — a known
   `@supabase/supabase-js` typing bug, not something to "fix").

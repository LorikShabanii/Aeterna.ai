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

## Feature 1 — Evidentiary hashing and timestamping ✅ built

`supabase/migrations/20260910000000_vault_item_capture_provenance.sql`,
`hashFile()` in `src/lib/crypto/vault-key.ts`, wired into `UploadFileForm`
and the "Verified capture time" block in `VaultItemCard`
(`src/routes/_authed/vault.tsx`). Verified end-to-end: uploaded a file with
known content through the real UI and confirmed the stored `content_hash`
exactly matches a SHA-256 computed independently via Node's own `crypto`
module (not the app's code), and `captured_at` falls inside the actual
upload window.

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

## Feature 2 — Parcel-level land mapping ✅ built

`supabase/migrations/20260911000000_land_parcels.sql`, `src/lib/land/
parcels.ts`, `src/components/land-parcel-map.tsx` (plain Leaflet, not
react-leaflet — see note below), new `/land` route
(`src/routes/_authed/land.tsx`). Verified end-to-end through the real UI:
clicked the map to drop a pin, attached a file, assigned a recipient —
confirmed server-side that `geo_boundary`, `photo_urls`, and the
`land_parcel_recipients` row all landed correctly, and that a page reload
still shows the parcel pinned on an overview map.

Two real bugs found and fixed during verification, worth knowing about:
1. Leaflet's default marker icon does an internal CSS-probe to find its
   asset paths, which silently 404s under Vite's bundling even after
   `Icon.Default.mergeOptions(...)` — fixed by never touching
   `Icon.Default` and instead building one explicit `L.icon(...)` and
   passing it to every `L.marker(...)` call.
2. The file-upload `<input>`'s `onChange` was clearing `input.value = ''`
   synchronously, in the same tick as the change event — this reliably
   raced with the browser's own file-selection bookkeeping and silently
   dropped the selected file before React state ever saw it. Fixed by
   deferring the reset with `queueMicrotask`. Worth checking any other
   file input in the app for the same synchronous-reset pattern.

### Revision: pluggable cadastral providers

Follow-up scope: match parcels to real government cadastral registries
where available, starting with Kosovo, via a `CadastralProvider` interface
(`src/lib/land/providers/`) — `lookupParcel(lat, lng)` for automated
matching, `getMapOverlay()` for a visual reference layer when automated
matching isn't available. `registry.ts` maps `country_code` → provider,
defaulting to a no-op fallback. France/Latvia/Spain are stubbed
(`providers/{france,latvia,spain}.ts`) with the interface implemented and
a TODO — not investigated yet.

`supabase/migrations/20260912000000_land_parcels_cadastral_provider.sql`
added `country_code`, `cadastral_reference`, and a three-state `source`
(`official_cadastre` / `official_cadastre_visual` / `manual_pin`) —  kept
three states rather than the originally-specced two because an automated
match and a human eyeballing a pin against a real official layer are
genuinely different evidentiary strength, and collapsing them would
overstate what a visual check actually proves.

**Kosovo (`providers/kosovo.ts`): investigated thoroughly, currently
returns null from both methods.** Real research, not guesswork — captured
the actual Kosovo Cadastral Agency Geoportal's own network traffic
(geoportal.rks-gov.net, an Angular app over a real GeoServer). Confirmed
real, working endpoints and layer names:
`https://geoportal.rks-gov.net/kgp/api/GeoServerProxy/wms`, layers
`KCM_DEV_WS:ParcelGeomView` (parcel polygons) and
`KCM_DEV_WS:ParcelDetailRpGeomView` (parcel number labels), both declared
`queryable="1"` with real CRS/bbox metadata in GetCapabilities.

What doesn't work, confirmed by testing rather than assumed:
- `GetFeatureInfo` (parcel-at-a-point lookup) returns HTTP 204 empty at
  every point tried, inside and outside the layer's declared coverage.
- Raw WFS `GetFeature` 404s on every path tried.
- **`GetMap` (map imagery) also returns HTTP 204 with zero bytes for both
  parcel layers specifically** — verified with a proper control:
  `KG_DEV_WS:MunicipalityKGP` (administrative boundaries, same proxy, same
  request pattern) returns real 200 responses with real image bytes, so
  the mechanism works fine — the parcel layers themselves just have no
  retrievable data behind their otherwise-correct registration. Confirmed
  with 35 real tile requests fired by this app's own map component during
  live use, not just synthetic tests.
- `/kgp/api/Authentication` 401s — there's likely an authenticated tier
  that exposes more; not obtainable from inside this codebase.

**First pass wrongly concluded `GetMap` (and therefore a visual overlay)
worked**, based on testing a different, unrelated layer
(`MunicipalityKGP`) and not re-verifying the actual parcel layer's
responses specifically — caught and corrected before it shipped as a
checkbox asking users to confirm something that was never actually
visible. `getMapOverlay()` now honestly returns `null` for Kosovo, same as
the unbuilt stubs, until AKK's data or an authenticated endpoint proves
otherwise. If that changes, `getMapOverlay()` is the only place that needs
to change — `land.tsx`'s visual-confirm checkbox already handles a working
overlay correctly, it's just never exercised while this returns null.

**TODO, deferred by request:** the `/land` country picker currently only
lists the four providers in `registry.ts` (Kosovo + three unbuilt stubs).
Needs to list all EU member states plus the rest of the Balkans regardless
of whether a provider is built yet — `SUPPORTED_COUNTRY_CODES` should stop
being "providers that exist" and become "the full selectable list," with
`getProvider()` still falling back to the no-op provider for anything
without a real implementation.

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

## Feature 3 — Notary/lawyer referral flow (stub for MVP) ✅ built

`src/lib/notary/notary.ts` — `requestNotarization()` server function
behind a `NotaryPartner` interface (`emailStubPartner` is the only
implementation; swap in a real partner API later by adding a new one and
changing `getNotaryPartner()`, without touching the UI). Reuses the
existing `sendEmail()` helper (`src/lib/email/send.ts`, the same Gmail
SMTP transport already used for Handover OTPs) rather than adding a new
email pathway. Routes to `NOTARY_INTAKE_EMAIL` if set, otherwise falls
back to `SMTP_USER` so it works with zero new required config. "Request
notarization" button + dialog on `VaultItemCard`
(`src/routes/_authed/vault.tsx`) — doesn't trust a client-supplied item
title, re-reads it server-side scoped to the authenticated owner before
sending.

No new table — deliberately kept to the "lightweight stub" the roadmap
asked for; the email itself is the record for now.

Verified for real, not just typechecked: submitted an actual request
through the live UI, then confirmed via the real Gmail account that the
email genuinely arrived — correct subject
(`Notarization request — "Grandpa testimony"`), correct body (requester
name/contact/note) — not just "the server function didn't throw."

Add a "Request notarization" button on any `vault_item`. For now this is a
lightweight stub, not a real integration: it opens a simple form (name,
contact, note) and sends it via the existing email service (Resend/Postmark
— see `supabase/functions/heartbeat-cron/` for the existing email-sending
pattern via nodemailer/Deno npm specifier).

Structure the code so a real local notary/lawyer partner API can be swapped
in later without changing the UI — e.g. a single `requestNotarization()`
server function that currently just emails a fixed address, behind an
interface that could later hit a real partner API instead.

### Revision — confirmation link (bug fix) ✅ built

Original build sent the notarization email but gave the recipient nothing
to actually do with it. Added a public, no-login confirmation link —
same token pattern as `/handover/$token`: `generateToken()`/`hashToken()`
now live in a shared `src/lib/tokens.ts` (extracted so this and the
Feature 4 revision below reuse the exact same logic), a new
`notarization_requests` table
(`supabase/migrations/20260914000000_notarization_requests.sql`) records
`token_hash` + `status` (`pending`/`confirmed`), and
`requestNotarization()` now includes `Confirm you've received this: {url}`
in the outgoing email, linking to `/notarize/$token`
(`src/routes/notarize.$token.tsx`). Confirming just records an
acknowledgement — explicitly labeled in the UI as a stub, not a real
e-signature. See CLAUDE.md's new TODO section for swapping in a real
e-signature provider.

`listNotarizationRequests()` added and wired into the vault loader so
`VaultItemCard` can show "awaiting acknowledgement" / "acknowledged" next
to the existing "Request notarization" button.

## Feature 4 — Multi-witness co-signing at recording time ✅ built

`supabase/migrations/20260913000000_vault_item_witnesses.sql` — new
`vault_item_witnesses` table, owner-scoped RLS via the parent
`vault_item` (same pattern as `vault_item_recipients`), no update policy
by design (attested testimony shouldn't be editable after the fact, only
deletable via cascade if the item itself is deleted). Wired into
`createFileItem` (`src/lib/vault/items.ts`) — `insertVaultItem` now
returns the new row's id so witness rows can reference it in the same
call. Witnesses only ever appear in the UI for `type === 'video'`
(`UploadFileForm` in `src/routes/_authed/vault.tsx`), up to 2, each with
name/contact/consent-checkbox, and share the exact same `witnessedAt` as
the video's own `capturedAt` from Feature 1 — not a separately-generated
timestamp.

Verified end-to-end: uploaded a video with 2 witnesses through the real
UI, then confirmed server-side that both `vault_item_witnesses` rows were
created with the correct name/contact/consent text, and that
`witnessed_at` on both rows exactly equals `vault_items.captured_at` for
that video — not just close, an exact match, which is the actual claim
being made ("witnessed at a provable time," not "witnessed around the
same time").

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

### Revision — async self-confirmation by the witness (bug fix) ✅ built

Original build let the *owner* check a consent box on the witness's
behalf at upload time — the person named as a witness never actually
attested to anything themselves, which undermines the whole evidentiary
point of the feature. The original ask was to also match a submitted
photo against the video automatically — declined for now since that's
custom face-recognition, which conflicts with CLAUDE.md's standing "Do
not build a custom face-recognition model" policy (BIPA/GDPR
special-category biometric data exposure); see CLAUDE.md's new TODO
section, which flags this as a deliberate, separate policy decision if
ever revisited, not a default to build toward.

What's built instead: the owner now only names witnesses (name + contact)
at upload time — no checkbox, no consent text collected from them.
`createFileItem` (`src/lib/vault/items.ts`) generates a token per witness,
inserts each `vault_item_witnesses` row as `status: 'pending'` with
`token_hash`, and emails each witness a link to `/witness/$token`
(`src/routes/witness.$token.tsx`) via `sendEmail()` — best-effort, wrapped
in `Promise.allSettled` so a delivery failure doesn't roll back an
otherwise-successful upload. The witness follows the link, sees who named
them and for what, and confirms themselves — `confirmWitness()`
(`src/lib/vault/witnesses.ts`) sets a fixed attestation text, `status:
'confirmed'`, and `confirmed_at`, using the service-role client since the
witness has no session.

A photo upload is offered but optional and explicitly labeled "supporting
evidence only... never automatically compared against anything." Since
the submitting witness has no vault-key access, it can't go through the
usual client-side-encrypt-before-upload pattern — it's stored as-is in a
new private `witness-photos` Storage bucket
(`supabase/migrations/20260915000000_vault_item_witnesses_async_confirm.sql`),
owner-readable only via RLS, written only by `confirmWitness()` via the
service-role client (so no public/anon write policy is needed), and
validated server-side (JPEG/PNG/WEBP only, 8MB max) since it's an
unauthenticated write path. `consent_text` on the table is now nullable
— it's only populated at confirmation time — with a check constraint
enforcing it's still required once `status = 'confirmed'`.

`VaultItemCard`'s "Witnessed by" list now shows "confirmed" vs "awaiting
confirmation" per witness instead of unconditionally listing them as
witnessed.

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

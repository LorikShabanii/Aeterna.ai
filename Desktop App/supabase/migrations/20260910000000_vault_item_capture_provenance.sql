-- Evidentiary hashing and timestamping (docs/roadmap-differentiation-
-- features.md > Feature 1): for document/photo/video items, the client
-- hashes the raw file and records a capture timestamp before encrypting
-- and uploading it, so it can later be shown that a specific file existed,
-- unmodified, at a specific time.
--
-- Both columns are nullable: letters and financial notes have no "file" to
-- hash, and items created before this migration have neither.

alter table vault_items add column content_hash text;
alter table vault_items add column captured_at timestamptz;

comment on column vault_items.content_hash is
  'SHA-256 (hex) of the raw file, computed client-side before encryption. Null for letters/text items.';
comment on column vault_items.captured_at is
  'Client-generated timestamp at the moment of file selection/capture — distinct from created_at, which is server-set on insert.';

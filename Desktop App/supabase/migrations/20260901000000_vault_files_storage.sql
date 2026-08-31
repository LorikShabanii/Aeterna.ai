-- Storage for document/photo/video vault items. Files are encrypted
-- client-side (AES-256-GCM) before upload — see src/lib/crypto/vault-key.ts
-- — so the bucket only ever holds ciphertext, matching CLAUDE.md's
-- "the courier never reads the letter" promise.
--
-- Objects are keyed "<user_id>/<uuid>" so the owner-only policies below can
-- check the folder name against auth.uid() without a lookup table.

insert into storage.buckets (id, name, public)
values ('vault-files', 'vault-files', false)
on conflict (id) do nothing;

create policy "vault_files_select_own"
  on storage.objects for select
  using (bucket_id = 'vault-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "vault_files_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'vault-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "vault_files_delete_own"
  on storage.objects for delete
  using (bucket_id = 'vault-files' and auth.uid()::text = (storage.foldername(name))[1]);

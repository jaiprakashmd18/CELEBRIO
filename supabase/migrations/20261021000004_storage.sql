-- Celebrio — storage buckets and policies
--
--   template-previews  public   gallery preview images (admins upload)
--   project-assets     private  customer photos (server uploads after validation)
--   exports            private  generated paid files (served via short-lived signed URLs)
--
-- Customer photos and exports have no client-side policies at all: every
-- read and write goes through server routes that verify ownership and
-- entitlements first, using the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('template-previews', 'template-previews', true, 5242880, array['image/webp', 'image/png', 'image/jpeg']),
  ('project-assets', 'project-assets', false, 10485760, array['image/webp', 'image/png', 'image/jpeg']),
  ('exports', 'exports', false, 52428800, array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "template previews: admins upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'template-previews' and public.is_admin());

create policy "template previews: admins update"
  on storage.objects for update to authenticated
  using (bucket_id = 'template-previews' and public.is_admin());

create policy "template previews: admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'template-previews' and public.is_admin());

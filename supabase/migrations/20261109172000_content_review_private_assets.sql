insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-assets',
  'content-assets',
  false,
  52428800,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists content_assets_select on storage.objects;
create policy content_assets_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'content-assets'
  and exists (
    select 1
    from public.content_batches b
    where b.id::text = (storage.foldername(name))[1]
      and (
        b.owner_user_id = (select auth.uid())
        or lower(coalesce(b.reviewer_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  )
);

drop policy if exists content_assets_insert_owner on storage.objects;
create policy content_assets_insert_owner
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'content-assets'
  and exists (
    select 1
    from public.content_batches b
    where b.id::text = (storage.foldername(name))[1]
      and b.owner_user_id = (select auth.uid())
  )
);

drop policy if exists content_assets_update_owner on storage.objects;
create policy content_assets_update_owner
on storage.objects for update
to authenticated
using (
  bucket_id = 'content-assets'
  and exists (
    select 1
    from public.content_batches b
    where b.id::text = (storage.foldername(name))[1]
      and b.owner_user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'content-assets'
  and exists (
    select 1
    from public.content_batches b
    where b.id::text = (storage.foldername(name))[1]
      and b.owner_user_id = (select auth.uid())
  )
);

drop policy if exists content_assets_delete_owner on storage.objects;
create policy content_assets_delete_owner
on storage.objects for delete
to authenticated
using (
  bucket_id = 'content-assets'
  and exists (
    select 1
    from public.content_batches b
    where b.id::text = (storage.foldername(name))[1]
      and b.owner_user_id = (select auth.uid())
  )
);

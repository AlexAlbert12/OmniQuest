-- Create and secure the public avatars bucket used by student/teacher profiles.
-- Avatar objects are public to support rankings and profile previews, but only
-- the authenticated owner can write or delete files under their own path.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_own_avatar_storage_path(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and p_object_name is not null
    and (
      -- Current app format: <user-id>.jpg
      p_object_name in (
        auth.uid()::text || '.jpg',
        auth.uid()::text || '.jpeg',
        auth.uid()::text || '.png',
        auth.uid()::text || '.webp',
        auth.uid()::text || '.gif'
      )
      -- Safer future format: <user-id>/avatar.<ext> or any file under own folder.
      or p_object_name like auth.uid()::text || '/%'
    );
$$;

revoke all on function public.is_own_avatar_storage_path(text) from public;
grant execute on function public.is_own_avatar_storage_path(text) to authenticated;

drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;

create policy "Avatars are publicly readable"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and public.is_own_avatar_storage_path(name)
);

create policy "Users can update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and public.is_own_avatar_storage_path(name)
)
with check (
  bucket_id = 'avatars'
  and public.is_own_avatar_storage_path(name)
);

create policy "Users can delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and public.is_own_avatar_storage_path(name)
);

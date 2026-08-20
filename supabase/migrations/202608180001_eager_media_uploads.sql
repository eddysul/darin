-- Eager photo uploads: temp storage paths before a post/entry exists,
-- per-media upload_status, and orphan temp cleanup after 24 hours.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.memory_posts
  add column if not exists status text not null default 'published';

alter table public.memory_posts
  drop constraint if exists memory_posts_status_check;
alter table public.memory_posts
  add constraint memory_posts_status_check
  check (status in ('posting', 'published', 'failed'));

alter table public.memory_media
  add column if not exists upload_status text not null default 'ready';

alter table public.memory_media
  drop constraint if exists memory_media_upload_status_check;
alter table public.memory_media
  add constraint memory_media_upload_status_check
  check (upload_status in ('uploading', 'ready', 'failed'));

alter table public.diary_media
  add column if not exists upload_status text not null default 'ready';

alter table public.diary_media
  drop constraint if exists diary_media_upload_status_check;
alter table public.diary_media
  add constraint diary_media_upload_status_check
  check (upload_status in ('uploading', 'ready', 'failed'));

grant update on table public.memory_media to authenticated;
grant update on table public.diary_media to authenticated;

-- ---------------------------------------------------------------------------
-- Temp path helpers: {baby_id}/temp/{session_id}/{file}
-- ---------------------------------------------------------------------------
create or replace function public.is_temp_media_path(p_name text)
returns boolean
language sql
immutable
as $$
  select
    p_name not like '%..%'
    and split_part(p_name, '/', 2) = 'temp'
    and split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and split_part(p_name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and length(split_part(p_name, '/', 4)) > 0;
$$;

create or replace function public.can_write_temp_media_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_temp_media_path(p_name)
    and public.can_edit_care_logs(split_part(p_name, '/', 1)::uuid);
$$;

revoke all on function public.is_temp_media_path(text) from public;
revoke all on function public.can_write_temp_media_path(text) from public;
grant execute on function public.is_temp_media_path(text) to authenticated;
grant execute on function public.can_write_temp_media_path(text) to authenticated;

-- ---------------------------------------------------------------------------
-- memory_media row updates (upload_status / dimensions)
-- ---------------------------------------------------------------------------
drop policy if exists memory_media_update_manager on public.memory_media;
create policy memory_media_update_manager on public.memory_media
  for update to authenticated
  using (public.can_manage_memory_post(memory_post_id))
  with check (public.can_manage_memory_post(memory_post_id));

drop policy if exists diary_media_update_author_admin on public.diary_media;
create policy diary_media_update_author_admin on public.diary_media
  for update to authenticated
  using (public.can_manage_diary_entry(diary_entry_id))
  with check (public.can_manage_diary_entry(diary_entry_id));

-- ---------------------------------------------------------------------------
-- Storage: allow temp uploads before a post/entry row exists.
-- Linked objects are still authorized via media.storage_path.
-- ---------------------------------------------------------------------------
drop policy if exists memories_objects_select_visible on storage.objects;
create policy memories_objects_select_visible on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memories'
    and (
      exists (
        select 1
        from public.memory_media m
        where m.storage_path = name
          and public.can_view_memory_post(m.memory_post_id)
      )
      or public.can_write_temp_media_path(name)
    )
  );

drop policy if exists memories_objects_insert_manager on storage.objects;
create policy memories_objects_insert_manager on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memories'
    and (
      public.can_write_temp_media_path(name)
      or exists (
        select 1
        from public.memory_posts p
        where p.id::text = split_part(name, '/', 2)
          and p.baby_id::text = split_part(name, '/', 1)
          and public.can_manage_memory_post(p.id)
      )
    )
  );

drop policy if exists memories_objects_update_manager on storage.objects;
create policy memories_objects_update_manager on storage.objects
  for update to authenticated
  using (
    bucket_id = 'memories'
    and (
      public.can_write_temp_media_path(name)
      or exists (
        select 1 from public.memory_media m
        where m.storage_path = name and public.can_manage_memory_post(m.memory_post_id)
      )
      or exists (
        select 1
        from public.memory_posts p
        where p.id::text = split_part(name, '/', 2)
          and p.baby_id::text = split_part(name, '/', 1)
          and public.can_manage_memory_post(p.id)
      )
    )
  )
  with check (
    bucket_id = 'memories'
    and (
      public.can_write_temp_media_path(name)
      or exists (
        select 1 from public.memory_media m
        where m.storage_path = name and public.can_manage_memory_post(m.memory_post_id)
      )
      or exists (
        select 1
        from public.memory_posts p
        where p.id::text = split_part(name, '/', 2)
          and p.baby_id::text = split_part(name, '/', 1)
          and public.can_manage_memory_post(p.id)
      )
    )
  );

drop policy if exists memories_objects_delete_manager on storage.objects;
create policy memories_objects_delete_manager on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memories'
    and (
      public.can_write_temp_media_path(name)
      or exists (
        select 1 from public.memory_media m
        where m.storage_path = name and public.can_manage_memory_post(m.memory_post_id)
      )
      or exists (
        select 1
        from public.memory_posts p
        where p.id::text = split_part(name, '/', 2)
          and p.baby_id::text = split_part(name, '/', 1)
          and public.can_manage_memory_post(p.id)
      )
    )
  );

drop policy if exists diary_media_objects_select_member on storage.objects;
create policy diary_media_objects_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'diary-media'
    and (
      exists (
        select 1
        from public.diary_media m
        where m.storage_path = name
          and public.can_view_diary_entry(m.diary_entry_id)
      )
      or public.can_write_temp_media_path(name)
    )
  );

drop policy if exists diary_media_objects_insert_author_admin on storage.objects;
create policy diary_media_objects_insert_author_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'diary-media'
    and (
      public.can_write_temp_media_path(name)
      or exists (
        select 1
        from public.diary_entries d
        where d.id::text = split_part(name, '/', 2)
          and d.baby_id::text = split_part(name, '/', 1)
          and public.can_manage_diary_entry(d.id)
      )
    )
  );

drop policy if exists diary_media_objects_delete_author_admin on storage.objects;
create policy diary_media_objects_delete_author_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'diary-media'
    and (
      public.can_write_temp_media_path(name)
      or exists (
        select 1 from public.diary_media m
        where m.storage_path = name and public.can_manage_diary_entry(m.diary_entry_id)
      )
      or exists (
        select 1
        from public.diary_entries d
        where d.id::text = split_part(name, '/', 2)
          and d.baby_id::text = split_part(name, '/', 1)
          and public.can_manage_diary_entry(d.id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Orphan temp objects: uploaded > 24h ago and never linked to a media row.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_orphan_temp_media()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  deleted_count integer := 0;
begin
  delete from storage.objects o
  where o.bucket_id in ('memories', 'diary-media')
    and public.is_temp_media_path(o.name)
    and o.created_at < timezone('utc', now()) - interval '24 hours'
    and not exists (
      select 1 from public.memory_media m where m.storage_path = o.name
    )
    and not exists (
      select 1 from public.diary_media d where d.storage_path = o.name
    );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_orphan_temp_media() from public;
grant execute on function public.cleanup_orphan_temp_media() to authenticated;
grant execute on function public.cleanup_orphan_temp_media() to service_role;

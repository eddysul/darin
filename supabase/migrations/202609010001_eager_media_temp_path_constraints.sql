-- Allow eager-upload temp objects to be linked to memory/diary media rows.
--
-- The original table constraints only accepted final paths:
--   {baby_id}/{owner_id}/{file}
-- Eager uploads intentionally use:
--   {baby_id}/temp/{session_id}/{file}
-- until the post/entry row is created. Storage RLS already authorizes these
-- paths through is_temp_media_path; keep the DB constraints in sync.

create or replace function public.is_temp_media_path(p_name text)
returns boolean
language sql
immutable
as $$
  select
    p_name not like '%..%'
    and array_length(string_to_array(p_name, '/'), 1) = 4
    and split_part(p_name, '/', 2) = 'temp'
    and split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and split_part(p_name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and length(split_part(p_name, '/', 4)) > 0;
$$;

revoke all on function public.is_temp_media_path(text) from public;
grant execute on function public.is_temp_media_path(text) to authenticated;

alter table public.memory_media
  drop constraint if exists memory_media_check;
alter table public.memory_media
  add constraint memory_media_check
  check (
    split_part(storage_path, '/', 1) = baby_id::text
    and (
      (
        split_part(storage_path, '/', 2) = memory_post_id::text
        and split_part(storage_path, '/', 3) <> ''
      )
      or public.is_temp_media_path(storage_path)
    )
  );

alter table public.diary_media
  drop constraint if exists diary_media_check;
alter table public.diary_media
  add constraint diary_media_check
  check (
    split_part(storage_path, '/', 1) = baby_id::text
    and (
      (
        split_part(storage_path, '/', 2) = diary_entry_id::text
        and split_part(storage_path, '/', 3) <> ''
      )
      or public.is_temp_media_path(storage_path)
    )
  );

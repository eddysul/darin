-- Profile Settings V1: profile/baby avatar storage paths, nicknames, co-member profile read,
-- baby profile updates for admin+editor, private profile-media bucket.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists nickname text,
  add column if not exists avatar_storage_path text,
  add column if not exists default_relation text;

alter table public.babies
  add column if not exists nickname text,
  add column if not exists avatar_storage_path text;

alter table public.baby_members
  add column if not exists display_name_override text;

-- Extend relationship enum for profile/family settings (safe no-op if present).
do $$ begin
  alter type public.relationship_label add value if not exists '이모';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.relationship_label add value if not exists '삼촌';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.relationship_label add value if not exists '친구';
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: co-member / Memories-friend display read (not public)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_own_or_shared on public.profiles;
create policy profiles_select_own_or_shared on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.baby_members me
      join public.baby_members them
        on them.baby_id = me.baby_id
       and them.status = 'active'
      where me.user_id = auth.uid()
        and me.status = 'active'
        and them.user_id = profiles.id
    )
    or exists (
      select 1
      from public.memory_friends mf
      join public.baby_members bm
        on bm.baby_id = mf.baby_id
       and bm.status = 'active'
      where mf.user_id = auth.uid()
        and mf.status = 'active'
        and bm.user_id = profiles.id
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Babies: admin or editor may update profile fields (not delete)
-- ---------------------------------------------------------------------------
drop policy if exists babies_update_admin on public.babies;
drop policy if exists babies_update_admin_or_editor on public.babies;
create policy babies_update_admin_or_editor on public.babies
  for update to authenticated
  using (public.baby_permission(id) in ('admin', 'editor'))
  with check (public.baby_permission(id) in ('admin', 'editor'));

-- Members may update their own relationship / display override; admins may update any on baby.
drop policy if exists baby_members_update_admin on public.baby_members;
drop policy if exists baby_members_update_admin_or_self on public.baby_members;
create policy baby_members_update_admin_or_self on public.baby_members
  for update to authenticated
  using (
    public.baby_permission(baby_id) = 'admin'
    or user_id = auth.uid()
  )
  with check (
    public.baby_permission(baby_id) = 'admin'
    or user_id = auth.uid()
  );

-- Self-update cannot escalate permission_role (enforced in trigger).
create or replace function public.baby_member_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.permission_role is distinct from old.permission_role
     and public.baby_permission(old.baby_id) is distinct from 'admin' then
    raise exception 'only baby admin can change member roles'
      using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id or new.baby_id is distinct from old.baby_id then
    raise exception 'baby member identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists baby_members_role_guard on public.baby_members;
create trigger baby_members_role_guard
  before update on public.baby_members
  for each row execute function public.baby_member_role_guard();

-- ---------------------------------------------------------------------------
-- Private Storage: profile-media
-- paths: users/{user_id}/avatar.*  |  babies/{baby_id}/avatar.*
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('profile-media', 'profile-media', false, 5242880)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create or replace function public.can_read_profile_media_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) = 'users' then (
      split_part(object_name, '/', 2) = auth.uid()::text
      or exists (
        select 1
        from public.baby_members me
        join public.baby_members them
          on them.baby_id = me.baby_id and them.status = 'active'
        where me.user_id = auth.uid()
          and me.status = 'active'
          and them.user_id::text = split_part(object_name, '/', 2)
      )
      or exists (
        select 1
        from public.memory_friends mf
        join public.baby_members bm
          on bm.baby_id = mf.baby_id and bm.status = 'active'
        where mf.user_id = auth.uid()
          and mf.status = 'active'
          and bm.user_id::text = split_part(object_name, '/', 2)
      )
    )
    when split_part(object_name, '/', 1) = 'babies' then (
      public.is_baby_member(split_part(object_name, '/', 2)::uuid)
      or exists (
        select 1 from public.memory_friends mf
        where mf.user_id = auth.uid()
          and mf.status = 'active'
          and mf.baby_id::text = split_part(object_name, '/', 2)
      )
    )
    else false
  end;
$$;

create or replace function public.can_write_profile_media_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) = 'users' then
      split_part(object_name, '/', 2) = auth.uid()::text
    when split_part(object_name, '/', 1) = 'babies' then
      public.baby_permission(split_part(object_name, '/', 2)::uuid) in ('admin', 'editor')
    else false
  end;
$$;

revoke all on function public.can_read_profile_media_object(text) from public;
revoke all on function public.can_write_profile_media_object(text) from public;
grant execute on function public.can_read_profile_media_object(text) to authenticated;
grant execute on function public.can_write_profile_media_object(text) to authenticated;

drop policy if exists profile_media_select on storage.objects;
create policy profile_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-media' and public.can_read_profile_media_object(name));

drop policy if exists profile_media_insert on storage.objects;
create policy profile_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-media' and public.can_write_profile_media_object(name));

drop policy if exists profile_media_update on storage.objects;
create policy profile_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-media' and public.can_write_profile_media_object(name))
  with check (bucket_id = 'profile-media' and public.can_write_profile_media_object(name));

drop policy if exists profile_media_delete on storage.objects;
create policy profile_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-media' and public.can_write_profile_media_object(name));

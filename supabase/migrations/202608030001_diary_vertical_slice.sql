-- Phase 3B: server-backed Diary vertical slice.
-- Growth Book editor/page state remains local until Phase 3C.

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  entry_date date not null,
  title text,
  body text,
  mood text,
  weather text,
  tags text[] not null default '{}',
  included_in_growth_book boolean not null default false,
  client_generated_id text,
  -- Preserves existing app-only Diary fields without coupling Growth Book pages to this slice.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, baby_id)
);

create unique index if not exists diary_entries_baby_client_generated_unique
  on public.diary_entries (baby_id, client_generated_id)
  where client_generated_id is not null;
create index if not exists diary_entries_baby_date_idx
  on public.diary_entries (baby_id, entry_date desc, created_at desc)
  where deleted_at is null;
create index if not exists diary_entries_author_idx
  on public.diary_entries (author_id, created_at desc);

create table if not exists public.diary_media (
  id uuid primary key default gen_random_uuid(),
  diary_entry_id uuid not null,
  baby_id uuid not null references public.babies (id) on delete cascade,
  storage_path text not null unique,
  media_type text not null default 'image' check (media_type = 'image'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now(),
  foreign key (diary_entry_id, baby_id)
    references public.diary_entries (id, baby_id) on delete cascade,
  check (
    split_part(storage_path, '/', 1) = baby_id::text
    and split_part(storage_path, '/', 2) = diary_entry_id::text
    and split_part(storage_path, '/', 3) <> ''
  )
);

create index if not exists diary_media_entry_idx
  on public.diary_media (diary_entry_id, created_at);

drop trigger if exists diary_entries_set_updated_at on public.diary_entries;
create trigger diary_entries_set_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();

create or replace function public.can_create_diary_entry(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.baby_permission(p_baby_id) in ('admin', 'editor');
$$;

create or replace function public.can_manage_diary_entry(p_diary_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.diary_entries d
    where d.id = p_diary_entry_id
      and d.deleted_at is null
      and (
        d.author_id = auth.uid()
        or public.baby_permission(d.baby_id) = 'admin'
      )
  );
$$;

create or replace function public.can_view_diary_entry(p_diary_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.diary_entries d
    where d.id = p_diary_entry_id
      and d.deleted_at is null
      and public.is_baby_member(d.baby_id)
  );
$$;

revoke all on function public.can_create_diary_entry(uuid) from public;
revoke all on function public.can_manage_diary_entry(uuid) from public;
revoke all on function public.can_view_diary_entry(uuid) from public;
grant execute on function public.can_create_diary_entry(uuid) to authenticated;
grant execute on function public.can_manage_diary_entry(uuid) to authenticated;
grant execute on function public.can_view_diary_entry(uuid) to authenticated;

create or replace function public.diary_entry_identity_unchanged()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.baby_id <> old.baby_id
    or new.author_id <> old.author_id
    or new.client_generated_id is distinct from old.client_generated_id
    or new.created_at <> old.created_at then
    raise exception 'diary entry identity columns are immutable';
  end if;
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted diary entries are immutable';
  end if;
  if old.deleted_at is null and new.deleted_at is not null
    and not public.can_manage_diary_entry(old.id) then
    raise exception 'diary entry delete permission denied';
  end if;
  return new;
end;
$$;

drop trigger if exists diary_entries_identity_unchanged on public.diary_entries;
create trigger diary_entries_identity_unchanged
  before update on public.diary_entries
  for each row execute function public.diary_entry_identity_unchanged();

create or replace function public.soft_delete_diary_entry(p_diary_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_diary_entry(p_diary_entry_id) then
    raise exception 'diary entry not found or delete permission denied';
  end if;
  update public.diary_entries
  set deleted_at = now()
  where id = p_diary_entry_id
    and deleted_at is null;
  if not found then
    raise exception 'diary entry not found or delete permission denied';
  end if;
end;
$$;

revoke all on function public.soft_delete_diary_entry(uuid) from public;
grant execute on function public.soft_delete_diary_entry(uuid) to authenticated;

alter table public.diary_entries enable row level security;
alter table public.diary_media enable row level security;

drop policy if exists diary_entries_select_member on public.diary_entries;
create policy diary_entries_select_member on public.diary_entries
  for select to authenticated
  using (deleted_at is null and public.is_baby_member(baby_id));

drop policy if exists diary_entries_insert_admin_editor on public.diary_entries;
create policy diary_entries_insert_admin_editor on public.diary_entries
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_create_diary_entry(baby_id)
  );

drop policy if exists diary_entries_update_author_admin on public.diary_entries;
create policy diary_entries_update_author_admin on public.diary_entries
  for update to authenticated
  using (
    deleted_at is null
    and (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin')
  )
  with check (
    author_id = auth.uid() or public.baby_permission(baby_id) = 'admin'
  );

drop policy if exists diary_media_select_member on public.diary_media;
create policy diary_media_select_member on public.diary_media
  for select to authenticated
  using (public.can_view_diary_entry(diary_entry_id));

drop policy if exists diary_media_insert_author_admin on public.diary_media;
create policy diary_media_insert_author_admin on public.diary_media
  for insert to authenticated
  with check (public.can_manage_diary_entry(diary_entry_id));

drop policy if exists diary_media_delete_author_admin on public.diary_media;
create policy diary_media_delete_author_admin on public.diary_media
  for delete to authenticated
  using (public.can_manage_diary_entry(diary_entry_id));

grant select, insert, update on table public.diary_entries to authenticated;
grant select, insert, delete on table public.diary_media to authenticated;
grant all on table public.diary_entries to service_role;
grant all on table public.diary_media to service_role;

-- Private object names: {baby_id}/{diary_entry_id}/{media_id}.{extension}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diary-media',
  'diary-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists diary_media_objects_select_member on storage.objects;
create policy diary_media_objects_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'diary-media'
    and exists (
      select 1
      from public.diary_media m
      where m.storage_path = name
        and public.can_view_diary_entry(m.diary_entry_id)
    )
  );

drop policy if exists diary_media_objects_insert_author_admin on storage.objects;
create policy diary_media_objects_insert_author_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'diary-media'
    and exists (
      select 1
      from public.diary_entries d
      where d.id::text = split_part(name, '/', 2)
        and d.baby_id::text = split_part(name, '/', 1)
        and public.can_manage_diary_entry(d.id)
    )
  );

drop policy if exists diary_media_objects_delete_author_admin on storage.objects;
create policy diary_media_objects_delete_author_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'diary-media'
    and exists (
      select 1
      from public.diary_entries d
      where d.id::text = split_part(name, '/', 2)
        and d.baby_id::text = split_part(name, '/', 1)
        and public.can_manage_diary_entry(d.id)
    )
  );

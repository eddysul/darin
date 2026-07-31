-- Private family Memories foundation.
-- Depends on profiles, babies, baby_members, permission_role and set_updated_at().

create table if not exists public.memory_posts (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  caption text,
  privacy_type text not null
    check (privacy_type in ('only_me', 'family_circle', 'tagged_family', 'selected_people')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists memory_posts_baby_created_idx
  on public.memory_posts (baby_id, created_at desc)
  where deleted_at is null;
create index if not exists memory_posts_author_idx
  on public.memory_posts (author_id, created_at desc);

create table if not exists public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts (id) on delete cascade,
  baby_id uuid not null references public.babies (id) on delete cascade,
  storage_path text not null unique,
  media_type text not null default 'image'
    check (media_type in ('image', 'video')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now(),
  check (
    split_part(storage_path, '/', 1) = baby_id::text
    and split_part(storage_path, '/', 2) = memory_post_id::text
    and split_part(storage_path, '/', 3) <> ''
  )
);

create index if not exists memory_media_post_idx
  on public.memory_media (memory_post_id, created_at);

create table if not exists public.memory_tags (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts (id) on delete cascade,
  tag_type text not null
    check (tag_type in ('baby', 'family_member', 'friend_baby', 'manual_guest')),
  baby_id uuid references public.babies (id) on delete cascade,
  tagged_user_id uuid references public.profiles (id) on delete cascade,
  tagged_baby_id uuid references public.babies (id) on delete cascade,
  manual_label text,
  status text not null default 'approved'
    check (status in ('approved', 'pending', 'rejected')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (tag_type = 'baby' and baby_id is not null)
    or (tag_type = 'family_member' and tagged_user_id is not null)
    or (tag_type = 'friend_baby' and tagged_baby_id is not null)
    or (tag_type = 'manual_guest' and nullif(btrim(manual_label), '') is not null)
  )
);

create index if not exists memory_tags_post_idx on public.memory_tags (memory_post_id);
create index if not exists memory_tags_tagged_user_idx
  on public.memory_tags (tagged_user_id, status)
  where tagged_user_id is not null;

create table if not exists public.memory_selected_people (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (memory_post_id, user_id)
);

create index if not exists memory_selected_people_user_idx
  on public.memory_selected_people (user_id, memory_post_id);

create table if not exists public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (nullif(btrim(body), '') is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists memory_comments_post_created_idx
  on public.memory_comments (memory_post_id, created_at)
  where deleted_at is null;

create table if not exists public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  reaction_type text not null check (nullif(btrim(reaction_type), '') is not null),
  created_at timestamptz not null default now(),
  unique (memory_post_id, author_id)
);

create index if not exists memory_reactions_post_idx
  on public.memory_reactions (memory_post_id, created_at);

drop trigger if exists memory_posts_set_updated_at on public.memory_posts;
create trigger memory_posts_set_updated_at
  before update on public.memory_posts
  for each row execute function public.set_updated_at();

drop trigger if exists memory_comments_set_updated_at on public.memory_comments;
create trigger memory_comments_set_updated_at
  before update on public.memory_comments
  for each row execute function public.set_updated_at();

-- Identity columns must not be reassigned through otherwise-valid UPDATE policies.
create or replace function public.memory_post_identity_unchanged()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.baby_id <> old.baby_id
    or new.author_id <> old.author_id
    or new.created_at <> old.created_at then
    raise exception 'memory post identity columns are immutable';
  end if;
  if new.deleted_at is distinct from old.deleted_at
    and not public.can_delete_memory_post(old.id) then
    raise exception 'memory post delete permission denied';
  end if;
  return new;
end;
$$;

drop trigger if exists memory_posts_identity_unchanged on public.memory_posts;
create trigger memory_posts_identity_unchanged
  before update on public.memory_posts
  for each row execute function public.memory_post_identity_unchanged();

create or replace function public.memory_comment_identity_unchanged()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.memory_post_id <> old.memory_post_id
    or new.author_id <> old.author_id
    or new.created_at <> old.created_at then
    raise exception 'memory comment identity columns are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists memory_comments_identity_unchanged on public.memory_comments;
create trigger memory_comments_identity_unchanged
  before update on public.memory_comments
  for each row execute function public.memory_comment_identity_unchanged();

create or replace function public.memory_reaction_identity_unchanged()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.memory_post_id <> old.memory_post_id
    or new.author_id <> old.author_id
    or new.created_at <> old.created_at then
    raise exception 'memory reaction identity columns are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists memory_reactions_identity_unchanged on public.memory_reactions;
create trigger memory_reactions_identity_unchanged
  before update on public.memory_reactions
  for each row execute function public.memory_reaction_identity_unchanged();

-- Central privacy predicate. SECURITY DEFINER avoids recursive RLS evaluation on
-- selected people and tags. Callers receive only a boolean, never hidden rows.
create or replace function public.can_view_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts p
    where p.id = p_memory_post_id
      and p.deleted_at is null
      and (
        p.author_id = auth.uid()
        or (
          p.privacy_type = 'family_circle'
          and public.is_baby_member(p.baby_id)
        )
        or (
          p.privacy_type = 'tagged_family'
          and exists (
            select 1
            from public.memory_tags t
            where t.memory_post_id = p.id
              and t.tag_type = 'family_member'
              and t.status = 'approved'
              and t.tagged_user_id = auth.uid()
          )
        )
        or (
          p.privacy_type = 'selected_people'
          and exists (
            select 1
            from public.memory_selected_people s
            where s.memory_post_id = p.id
              and s.user_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.can_manage_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts p
    where p.id = p_memory_post_id
      and (
        p.author_id = auth.uid()
        or public.baby_permission(p.baby_id) in ('admin', 'editor')
      )
  );
$$;

create or replace function public.can_delete_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts p
    where p.id = p_memory_post_id
      and (
        p.author_id = auth.uid()
        or public.baby_permission(p.baby_id) = 'admin'
      )
  );
$$;

create or replace function public.can_interact_with_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts p
    where p.id = p_memory_post_id
      and public.can_view_memory_post(p.id)
      and public.is_baby_member(p.baby_id)
  );
$$;

revoke all on function public.can_view_memory_post(uuid) from public;
revoke all on function public.can_manage_memory_post(uuid) from public;
revoke all on function public.can_delete_memory_post(uuid) from public;
revoke all on function public.can_interact_with_memory_post(uuid) from public;
grant execute on function public.can_view_memory_post(uuid) to authenticated;
grant execute on function public.can_manage_memory_post(uuid) to authenticated;
grant execute on function public.can_delete_memory_post(uuid) to authenticated;
grant execute on function public.can_interact_with_memory_post(uuid) to authenticated;

create or replace function public.soft_delete_memory_post(p_memory_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if not public.can_delete_memory_post(p_memory_post_id) then
    raise exception 'memory post not found or delete permission denied'
      using errcode = '42501';
  end if;

  update public.memory_posts
  set deleted_at = now()
  where id = p_memory_post_id
    and deleted_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'memory post not found or delete permission denied'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.soft_delete_memory_post(uuid) from public;
grant execute on function public.soft_delete_memory_post(uuid) to authenticated;

alter table public.memory_posts enable row level security;
alter table public.memory_media enable row level security;
alter table public.memory_tags enable row level security;
alter table public.memory_selected_people enable row level security;
alter table public.memory_comments enable row level security;
alter table public.memory_reactions enable row level security;

drop policy if exists memory_posts_select_visible on public.memory_posts;
create policy memory_posts_select_visible on public.memory_posts
  for select to authenticated
  using (
    deleted_at is null
    and (
      author_id = auth.uid()
      or public.can_view_memory_post(id)
    )
  );

drop policy if exists memory_posts_insert_editor on public.memory_posts;
create policy memory_posts_insert_editor on public.memory_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.baby_permission(baby_id) in ('admin', 'editor')
    and deleted_at is null
  );

drop policy if exists memory_posts_update_author_or_editor on public.memory_posts;
create policy memory_posts_update_author_or_editor on public.memory_posts
  for update to authenticated
  using (
    author_id = auth.uid()
    or public.baby_permission(baby_id) in ('admin', 'editor')
  )
  with check (
    author_id = auth.uid()
    or public.baby_permission(baby_id) in ('admin', 'editor')
  );

drop policy if exists memory_posts_delete_author_or_admin on public.memory_posts;
create policy memory_posts_delete_author_or_admin on public.memory_posts
  for delete to authenticated
  using (public.can_delete_memory_post(id));

drop policy if exists memory_media_select_visible on public.memory_media;
create policy memory_media_select_visible on public.memory_media
  for select to authenticated
  using (public.can_view_memory_post(memory_post_id));

drop policy if exists memory_media_insert_manager on public.memory_media;
create policy memory_media_insert_manager on public.memory_media
  for insert to authenticated
  with check (
    public.can_manage_memory_post(memory_post_id)
    and exists (
      select 1 from public.memory_posts p
      where p.id = memory_post_id and p.baby_id = baby_id
    )
  );

drop policy if exists memory_media_delete_manager on public.memory_media;
create policy memory_media_delete_manager on public.memory_media
  for delete to authenticated
  using (public.can_manage_memory_post(memory_post_id));

drop policy if exists memory_tags_select_visible on public.memory_tags;
create policy memory_tags_select_visible on public.memory_tags
  for select to authenticated
  using (public.can_view_memory_post(memory_post_id));

drop policy if exists memory_tags_insert_manager on public.memory_tags;
create policy memory_tags_insert_manager on public.memory_tags
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_manage_memory_post(memory_post_id));

drop policy if exists memory_tags_delete_manager on public.memory_tags;
create policy memory_tags_delete_manager on public.memory_tags
  for delete to authenticated
  using (public.can_manage_memory_post(memory_post_id));

drop policy if exists memory_selected_people_select_visible on public.memory_selected_people;
create policy memory_selected_people_select_visible on public.memory_selected_people
  for select to authenticated
  using (public.can_view_memory_post(memory_post_id));

drop policy if exists memory_selected_people_insert_manager on public.memory_selected_people;
create policy memory_selected_people_insert_manager on public.memory_selected_people
  for insert to authenticated
  with check (public.can_manage_memory_post(memory_post_id));

drop policy if exists memory_selected_people_delete_manager on public.memory_selected_people;
create policy memory_selected_people_delete_manager on public.memory_selected_people
  for delete to authenticated
  using (public.can_manage_memory_post(memory_post_id));

drop policy if exists memory_comments_select_visible on public.memory_comments;
create policy memory_comments_select_visible on public.memory_comments
  for select to authenticated
  using (deleted_at is null and public.can_view_memory_post(memory_post_id));

drop policy if exists memory_comments_insert_member on public.memory_comments;
create policy memory_comments_insert_member on public.memory_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and public.can_interact_with_memory_post(memory_post_id)
  );

drop policy if exists memory_comments_update_author on public.memory_comments;
create policy memory_comments_update_author on public.memory_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists memory_comments_delete_author_or_post_owner on public.memory_comments;
create policy memory_comments_delete_author_or_post_owner on public.memory_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.can_delete_memory_post(memory_post_id)
  );

drop policy if exists memory_reactions_select_visible on public.memory_reactions;
create policy memory_reactions_select_visible on public.memory_reactions
  for select to authenticated
  using (public.can_view_memory_post(memory_post_id));

drop policy if exists memory_reactions_insert_member on public.memory_reactions;
create policy memory_reactions_insert_member on public.memory_reactions
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_interact_with_memory_post(memory_post_id)
  );

drop policy if exists memory_reactions_update_author on public.memory_reactions;
create policy memory_reactions_update_author on public.memory_reactions
  for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and public.can_interact_with_memory_post(memory_post_id)
  );

drop policy if exists memory_reactions_delete_author on public.memory_reactions;
create policy memory_reactions_delete_author on public.memory_reactions
  for delete to authenticated
  using (author_id = auth.uid());

grant select, insert, update, delete on table public.memory_posts to authenticated;
grant select, insert, delete on table public.memory_media to authenticated;
grant select, insert, delete on table public.memory_tags to authenticated;
grant select, insert, delete on table public.memory_selected_people to authenticated;
grant select, insert, update, delete on table public.memory_comments to authenticated;
grant select, insert, update, delete on table public.memory_reactions to authenticated;

grant all on table public.memory_posts to service_role;
grant all on table public.memory_media to service_role;
grant all on table public.memory_tags to service_role;
grant all on table public.memory_selected_people to service_role;
grant all on table public.memory_comments to service_role;
grant all on table public.memory_reactions to service_role;

-- Private Storage bucket. Object names are relative to the bucket:
-- {baby_id}/{memory_post_id}/{media_id}.{extension}
insert into storage.buckets (id, name, public, file_size_limit)
values ('memories', 'memories', false, 26214400)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists memories_objects_select_visible on storage.objects;
create policy memories_objects_select_visible on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memories'
    and exists (
      select 1
      from public.memory_media m
      where m.storage_path = name
        and public.can_view_memory_post(m.memory_post_id)
    )
  );

drop policy if exists memories_objects_insert_manager on storage.objects;
create policy memories_objects_insert_manager on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memories'
    and exists (
      select 1
      from public.memory_posts p
      where p.id::text = split_part(name, '/', 2)
        and p.baby_id::text = split_part(name, '/', 1)
        and public.can_manage_memory_post(p.id)
    )
  );

drop policy if exists memories_objects_update_manager on storage.objects;
create policy memories_objects_update_manager on storage.objects
  for update to authenticated
  using (
    bucket_id = 'memories'
    and exists (
      select 1
      from public.memory_posts p
      where p.id::text = split_part(name, '/', 2)
        and p.baby_id::text = split_part(name, '/', 1)
        and public.can_manage_memory_post(p.id)
    )
  )
  with check (
    bucket_id = 'memories'
    and exists (
      select 1
      from public.memory_posts p
      where p.id::text = split_part(name, '/', 2)
        and p.baby_id::text = split_part(name, '/', 1)
        and public.can_manage_memory_post(p.id)
    )
  );

drop policy if exists memories_objects_delete_manager on storage.objects;
create policy memories_objects_delete_manager on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memories'
    and exists (
      select 1
      from public.memory_posts p
      where p.id::text = split_part(name, '/', 2)
        and p.baby_id::text = split_part(name, '/', 1)
        and public.can_manage_memory_post(p.id)
    )
  );

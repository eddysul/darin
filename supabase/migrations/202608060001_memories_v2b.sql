-- Memories V2B: private friend circle, per-user saves, server baby stickers,
-- and sticker comments. No policy grants public or anonymous access.

-- A dedicated Memories-only friend membership avoids leaking care logs, diary,
-- or growth data through the broader baby_members policies.
create table if not exists public.memory_friends (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, user_id)
);

create index if not exists memory_friends_user_active_idx
  on public.memory_friends (user_id, baby_id) where status = 'active';

drop trigger if exists memory_friends_set_updated_at on public.memory_friends;
create trigger memory_friends_set_updated_at
  before update on public.memory_friends
  for each row execute function public.set_updated_at();

create or replace function public.is_memory_friend(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memory_friends f
    where f.baby_id = p_baby_id
      and f.user_id = auth.uid()
      and f.status = 'active'
  );
$$;

revoke all on function public.is_memory_friend(uuid) from public;
grant execute on function public.is_memory_friend(uuid) to authenticated;

alter table public.memory_friends enable row level security;

drop policy if exists memory_friends_select_self_or_admin on public.memory_friends;
create policy memory_friends_select_self_or_admin on public.memory_friends
  for select to authenticated
  using (user_id = auth.uid() or public.baby_permission(baby_id) = 'admin');

drop policy if exists memory_friends_insert_admin on public.memory_friends;
create policy memory_friends_insert_admin on public.memory_friends
  for insert to authenticated
  with check (public.baby_permission(baby_id) = 'admin' and invited_by = auth.uid());

drop policy if exists memory_friends_update_admin on public.memory_friends;
create policy memory_friends_update_admin on public.memory_friends
  for update to authenticated
  using (public.baby_permission(baby_id) = 'admin')
  with check (public.baby_permission(baby_id) = 'admin');

drop policy if exists memory_friends_delete_admin on public.memory_friends;
create policy memory_friends_delete_admin on public.memory_friends
  for delete to authenticated
  using (public.baby_permission(baby_id) = 'admin');

alter table public.memory_posts drop constraint if exists memory_posts_privacy_type_check;
alter table public.memory_posts add constraint memory_posts_privacy_type_check
  check (privacy_type in ('only_me', 'family_circle', 'friend_circle', 'tagged_family', 'selected_people'));

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
        or (p.privacy_type = 'family_circle' and public.is_baby_member(p.baby_id))
        or (p.privacy_type = 'friend_circle' and public.is_memory_friend(p.baby_id))
        or (
          p.privacy_type = 'tagged_family'
          and exists (
            select 1 from public.memory_tags t
            where t.memory_post_id = p.id
              and t.tag_type = 'family_member'
              and t.status = 'approved'
              and t.tagged_user_id = auth.uid()
          )
        )
        or (
          p.privacy_type = 'selected_people'
          and exists (
            select 1 from public.memory_selected_people s
            where s.memory_post_id = p.id and s.user_id = auth.uid()
          )
        )
      )
  );
$$;

-- Explicitly invited Memories friends may comment/react/save only on posts they can see.
create or replace function public.can_interact_with_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memory_posts p
    where p.id = p_memory_post_id
      and public.can_view_memory_post(p.id)
      and (public.is_baby_member(p.baby_id) or public.is_memory_friend(p.baby_id))
  );
$$;

revoke all on function public.can_view_memory_post(uuid) from public;
revoke all on function public.can_interact_with_memory_post(uuid) from public;
grant execute on function public.can_view_memory_post(uuid) to authenticated;
grant execute on function public.can_interact_with_memory_post(uuid) to authenticated;

create table if not exists public.memory_saves (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts (id) on delete cascade,
  baby_id uuid not null references public.babies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (memory_post_id, user_id)
);

create index if not exists memory_saves_user_baby_idx
  on public.memory_saves (user_id, baby_id, created_at desc);

alter table public.memory_saves enable row level security;

drop policy if exists memory_saves_select_own_visible on public.memory_saves;
create policy memory_saves_select_own_visible on public.memory_saves
  for select to authenticated
  using (user_id = auth.uid() and public.can_view_memory_post(memory_post_id));

drop policy if exists memory_saves_insert_own_visible on public.memory_saves;
create policy memory_saves_insert_own_visible on public.memory_saves
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_interact_with_memory_post(memory_post_id)
    and exists (
      select 1 from public.memory_posts p
      where p.id = memory_post_id and p.baby_id = baby_id
    )
  );

drop policy if exists memory_saves_delete_own on public.memory_saves;
create policy memory_saves_delete_own on public.memory_saves
  for delete to authenticated using (user_id = auth.uid());

create table if not exists public.baby_stickers (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  label text not null check (nullif(btrim(label), '') is not null),
  storage_path text not null unique,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    split_part(storage_path, '/', 1) = baby_id::text
    and split_part(storage_path, '/', 2) = id::text || '.png'
  )
);

create index if not exists baby_stickers_baby_created_idx
  on public.baby_stickers (baby_id, created_at desc) where deleted_at is null;

drop trigger if exists baby_stickers_set_updated_at on public.baby_stickers;
create trigger baby_stickers_set_updated_at
  before update on public.baby_stickers
  for each row execute function public.set_updated_at();

create or replace function public.baby_sticker_identity_unchanged()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.baby_id <> old.baby_id
    or new.created_by is distinct from old.created_by
    or new.storage_path <> old.storage_path
    or new.created_at <> old.created_at then
    raise exception 'baby sticker identity columns are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists baby_stickers_identity_unchanged on public.baby_stickers;
create trigger baby_stickers_identity_unchanged
  before update on public.baby_stickers
  for each row execute function public.baby_sticker_identity_unchanged();

alter table public.memory_comments
  add column if not exists comment_type text not null default 'text',
  add column if not exists sticker_id uuid references public.baby_stickers (id) on delete restrict,
  add column if not exists sticker_label text;

alter table public.memory_comments drop constraint if exists memory_comments_comment_type_check;
alter table public.memory_comments add constraint memory_comments_comment_type_check
  check (comment_type in ('text', 'sticker'));
alter table public.memory_comments drop constraint if exists memory_comments_content_check;
alter table public.memory_comments add constraint memory_comments_content_check check (
  (comment_type = 'text' and sticker_id is null and nullif(btrim(body), '') is not null)
  or
  (comment_type = 'sticker' and sticker_id is not null and nullif(btrim(sticker_label), '') is not null)
);

create index if not exists memory_comments_sticker_idx
  on public.memory_comments (sticker_id) where sticker_id is not null and deleted_at is null;

create or replace function public.can_view_baby_sticker(p_sticker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.baby_stickers s
    where s.id = p_sticker_id
      and (
        (s.deleted_at is null and public.is_baby_member(s.baby_id))
        or exists (
          select 1 from public.memory_comments c
          where c.sticker_id = s.id
            and c.deleted_at is null
            and public.can_view_memory_post(c.memory_post_id)
        )
      )
  );
$$;

create or replace function public.can_use_baby_sticker_on_post(p_sticker_id uuid, p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.baby_stickers s
    join public.memory_posts p on p.id = p_memory_post_id and p.baby_id = s.baby_id
    where s.id = p_sticker_id
      and s.deleted_at is null
      and public.can_interact_with_memory_post(p.id)
  );
$$;

revoke all on function public.can_view_baby_sticker(uuid) from public;
revoke all on function public.can_use_baby_sticker_on_post(uuid, uuid) from public;
grant execute on function public.can_view_baby_sticker(uuid) to authenticated;
grant execute on function public.can_use_baby_sticker_on_post(uuid, uuid) to authenticated;

alter table public.baby_stickers enable row level security;

drop policy if exists baby_stickers_select_visible on public.baby_stickers;
create policy baby_stickers_select_visible on public.baby_stickers
  for select to authenticated using (public.can_view_baby_sticker(id));

drop policy if exists baby_stickers_insert_editor on public.baby_stickers;
create policy baby_stickers_insert_editor on public.baby_stickers
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and deleted_at is null
    and public.baby_permission(baby_id) in ('admin', 'editor')
  );

drop policy if exists baby_stickers_update_editor on public.baby_stickers;
create policy baby_stickers_update_editor on public.baby_stickers
  for update to authenticated
  using (public.baby_permission(baby_id) in ('admin', 'editor'))
  with check (public.baby_permission(baby_id) in ('admin', 'editor'));

drop policy if exists baby_stickers_delete_admin on public.baby_stickers;
create policy baby_stickers_delete_admin on public.baby_stickers
  for delete to authenticated using (public.baby_permission(baby_id) = 'admin');

-- Sticker comments are validated server-side against the post's baby and viewer permissions.
drop policy if exists memory_comments_insert_member on public.memory_comments;
create policy memory_comments_insert_member on public.memory_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and public.can_interact_with_memory_post(memory_post_id)
    and (
      (comment_type = 'text' and sticker_id is null)
      or (comment_type = 'sticker' and public.can_use_baby_sticker_on_post(sticker_id, memory_post_id))
    )
  );

create or replace function public.memory_comment_identity_unchanged()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
    or new.memory_post_id <> old.memory_post_id
    or new.author_id <> old.author_id
    or new.created_at <> old.created_at
    or new.comment_type <> old.comment_type
    or new.sticker_id is distinct from old.sticker_id then
    raise exception 'memory comment identity columns are immutable';
  end if;
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('baby-stickers', 'baby-stickers', false, 10485760, array['image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists baby_sticker_objects_select_visible on storage.objects;
create policy baby_sticker_objects_select_visible on storage.objects
  for select to authenticated
  using (
    bucket_id = 'baby-stickers'
    and exists (
      select 1 from public.baby_stickers s
      where s.storage_path = name and public.can_view_baby_sticker(s.id)
    )
  );

drop policy if exists baby_sticker_objects_insert_editor on storage.objects;
create policy baby_sticker_objects_insert_editor on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'baby-stickers'
    and public.baby_permission((split_part(name, '/', 1))::uuid) in ('admin', 'editor')
  );

drop policy if exists baby_sticker_objects_update_editor on storage.objects;
create policy baby_sticker_objects_update_editor on storage.objects
  for update to authenticated
  using (
    bucket_id = 'baby-stickers'
    and public.baby_permission((split_part(name, '/', 1))::uuid) in ('admin', 'editor')
  )
  with check (
    bucket_id = 'baby-stickers'
    and public.baby_permission((split_part(name, '/', 1))::uuid) in ('admin', 'editor')
  );

drop policy if exists baby_sticker_objects_delete_editor on storage.objects;
create policy baby_sticker_objects_delete_editor on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'baby-stickers'
    and public.baby_permission((split_part(name, '/', 1))::uuid) in ('admin', 'editor')
  );

grant select, insert, update, delete on table public.memory_friends to authenticated;
grant select, insert, delete on table public.memory_saves to authenticated;
grant select, insert, update, delete on table public.baby_stickers to authenticated;
grant all on table public.memory_friends to service_role;
grant all on table public.memory_saves to service_role;
grant all on table public.baby_stickers to service_role;

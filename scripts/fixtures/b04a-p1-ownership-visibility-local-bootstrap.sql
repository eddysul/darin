-- Isolated PostgreSQL fixture for B0.4a-2/B0.4a-3 authorization regressions.
-- Load b04a-p0-local-bootstrap.sql first.

create or replace function public.is_baby_member(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.baby_members as member_row
    where member_row.baby_id = p_baby_id
      and member_row.user_id = auth.uid()
      and member_row.status = 'active'
  );
$$;

create or replace function public.is_memory_friend(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memory_friends as friend_row
    where friend_row.baby_id = p_baby_id
      and friend_row.user_id = auth.uid()
      and friend_row.status = 'active'
  );
$$;

create table public.care_logs (
  id uuid primary key,
  baby_id uuid not null references public.babies(id),
  client_generated_id text,
  category text not null,
  recorded_at timestamptz not null,
  date_key text not null,
  time_local text not null,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.growth_records (
  id uuid primary key,
  baby_id uuid not null references public.babies(id),
  measured_at date not null,
  weight_kg numeric,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diary_entries (
  id uuid primary key,
  baby_id uuid not null references public.babies(id),
  author_id uuid not null references public.profiles(id),
  entry_date date not null,
  body text,
  client_generated_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.memory_posts
  add column privacy_type text not null default 'family_circle',
  add column status text not null default 'published',
  add column caption text,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create table public.memory_tags (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts(id) on delete cascade,
  tag_type text not null,
  baby_id uuid references public.babies(id),
  tagged_user_id uuid references public.profiles(id),
  tagged_baby_id uuid references public.babies(id),
  manual_label text,
  status text not null default 'approved',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.memory_selected_people (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (memory_post_id, user_id)
);

create table public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  comment_type text not null default 'text',
  sticker_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  reaction_type text not null,
  created_at timestamptz not null default now(),
  unique (memory_post_id, author_id)
);

create or replace function public.can_view_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memory_posts as post_row
    where post_row.id = p_memory_post_id
      and post_row.deleted_at is null
      and (
        post_row.author_id = auth.uid()
        or (post_row.privacy_type = 'family_circle' and public.is_baby_member(post_row.baby_id))
        or (
          post_row.privacy_type = 'friend_circle'
          and (public.is_baby_member(post_row.baby_id) or public.is_memory_friend(post_row.baby_id))
        )
        or (
          post_row.privacy_type = 'tagged_family'
          and exists (
            select 1 from public.memory_tags as tag_row
            where tag_row.memory_post_id = post_row.id
              and tag_row.tag_type = 'family_member'
              and tag_row.status = 'approved'
              and tag_row.tagged_user_id = auth.uid()
          )
        )
        or (
          post_row.privacy_type = 'selected_people'
          and exists (
            select 1 from public.memory_selected_people as selected_row
            where selected_row.memory_post_id = post_row.id
              and selected_row.user_id = auth.uid()
          )
        )
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
    select 1 from public.memory_posts as post_row
    where post_row.id = p_memory_post_id
      and public.can_view_memory_post(post_row.id)
      and (public.is_baby_member(post_row.baby_id) or public.is_memory_friend(post_row.baby_id))
  );
$$;

create or replace function public.can_use_baby_sticker_on_post(
  p_sticker_id uuid,
  p_memory_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select p_sticker_id is not null and p_memory_post_id is not null $$;

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
    select 1 from public.diary_entries as diary_row
    where diary_row.id = p_diary_entry_id
      and diary_row.deleted_at is null
      and (
        diary_row.author_id = auth.uid()
        or public.baby_permission(diary_row.baby_id) = 'admin'
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
    select 1 from public.memory_posts as post_row
    where post_row.id = p_memory_post_id
      and (
        post_row.author_id = auth.uid()
        or public.baby_permission(post_row.baby_id) = 'admin'
      )
  );
$$;

create or replace function public.soft_delete_diary_entry(p_diary_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_diary_entry(p_diary_entry_id) then
    raise exception 'diary entry not found or delete permission denied' using errcode = '42501';
  end if;
  update public.diary_entries set deleted_at = now()
  where id = p_diary_entry_id and deleted_at is null;
  if not found then
    raise exception 'diary entry not found or delete permission denied' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.soft_delete_memory_post(p_memory_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_delete_memory_post(p_memory_post_id) then
    raise exception 'memory post not found or delete permission denied' using errcode = '42501';
  end if;
  update public.memory_posts set deleted_at = now()
  where id = p_memory_post_id and deleted_at is null;
  if not found then
    raise exception 'memory post not found or delete permission denied' using errcode = '42501';
  end if;
end;
$$;

alter table public.care_logs enable row level security;
alter table public.growth_records enable row level security;
alter table public.diary_entries enable row level security;
alter table public.memory_posts enable row level security;
alter table public.memory_tags enable row level security;
alter table public.memory_selected_people enable row level security;
alter table public.memory_comments enable row level security;
alter table public.memory_reactions enable row level security;

create policy care_logs_select_member on public.care_logs
  for select to authenticated using (public.is_baby_member(baby_id));
create policy care_logs_insert_editor on public.care_logs
  for insert to authenticated with check (
    public.baby_permission(baby_id) in ('admin', 'editor') and created_by = auth.uid()
  );
create policy care_logs_update_editor on public.care_logs
  for update to authenticated using (public.baby_permission(baby_id) in ('admin', 'editor'))
  with check (public.baby_permission(baby_id) in ('admin', 'editor'));
create policy care_logs_delete_editor on public.care_logs
  for delete to authenticated using (public.baby_permission(baby_id) in ('admin', 'editor'));

create policy growth_records_select_member on public.growth_records
  for select to authenticated using (public.is_baby_member(baby_id));
create policy growth_records_insert_editor on public.growth_records
  for insert to authenticated with check (
    public.baby_permission(baby_id) in ('admin', 'editor') and created_by = auth.uid()
  );
create policy growth_records_update_editor on public.growth_records
  for update to authenticated using (public.baby_permission(baby_id) in ('admin', 'editor'))
  with check (public.baby_permission(baby_id) in ('admin', 'editor'));
create policy growth_records_delete_editor on public.growth_records
  for delete to authenticated using (public.baby_permission(baby_id) in ('admin', 'editor'));

create policy diary_entries_select_member on public.diary_entries
  for select to authenticated using (deleted_at is null and public.is_baby_member(baby_id));
create policy diary_entries_update_author_admin on public.diary_entries
  for update to authenticated using (
    deleted_at is null and (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin')
  ) with check (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin');

create policy memory_posts_select_visible on public.memory_posts
  for select to authenticated using (
    deleted_at is null and (author_id = auth.uid() or public.can_view_memory_post(id))
  );
create policy memory_posts_update_author_or_admin on public.memory_posts
  for update to authenticated using (
    deleted_at is null and (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin')
  ) with check (
    deleted_at is null and (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin')
  );
create policy memory_posts_delete_author_or_admin on public.memory_posts
  for delete to authenticated using (public.can_delete_memory_post(id));

create policy memory_tags_select_visible on public.memory_tags
  for select to authenticated using (public.can_view_memory_post(memory_post_id));
create policy memory_tags_insert_manager on public.memory_tags
  for insert to authenticated with check (
    created_by = auth.uid() and public.can_manage_memory_post(memory_post_id)
  );
create policy memory_tags_delete_manager on public.memory_tags
  for delete to authenticated using (public.can_manage_memory_post(memory_post_id));

create policy memory_selected_people_select_visible on public.memory_selected_people
  for select to authenticated using (public.can_view_memory_post(memory_post_id));
create policy memory_selected_people_insert_manager on public.memory_selected_people
  for insert to authenticated with check (public.can_manage_memory_post(memory_post_id));
create policy memory_selected_people_delete_manager on public.memory_selected_people
  for delete to authenticated using (public.can_manage_memory_post(memory_post_id));

create policy memory_comments_select_visible on public.memory_comments
  for select to authenticated using (deleted_at is null and public.can_view_memory_post(memory_post_id));
create policy memory_comments_insert_member on public.memory_comments
  for insert to authenticated with check (
    author_id = auth.uid() and deleted_at is null and public.can_interact_with_memory_post(memory_post_id)
  );
create policy memory_comments_update_author on public.memory_comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy memory_comments_delete_author_or_post_owner on public.memory_comments
  for delete to authenticated using (
    author_id = auth.uid() or public.can_delete_memory_post(memory_post_id)
  );

create policy memory_reactions_select_visible on public.memory_reactions
  for select to authenticated using (public.can_view_memory_post(memory_post_id));
create policy memory_reactions_insert_member on public.memory_reactions
  for insert to authenticated with check (
    author_id = auth.uid() and public.can_interact_with_memory_post(memory_post_id)
  );
create policy memory_reactions_update_author on public.memory_reactions
  for update to authenticated using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.can_interact_with_memory_post(memory_post_id));
create policy memory_reactions_delete_author on public.memory_reactions
  for delete to authenticated using (author_id = auth.uid());

grant execute on function public.is_baby_member(uuid) to authenticated;
grant execute on function public.is_memory_friend(uuid) to authenticated;
grant execute on function public.can_view_memory_post(uuid) to authenticated;
grant execute on function public.can_interact_with_memory_post(uuid) to authenticated;
grant execute on function public.can_create_diary_entry(uuid) to authenticated;
grant execute on function public.can_manage_diary_entry(uuid) to authenticated;
grant execute on function public.can_delete_memory_post(uuid) to authenticated;
grant execute on function public.soft_delete_diary_entry(uuid) to authenticated;
grant execute on function public.soft_delete_memory_post(uuid) to authenticated;
grant execute on function public.can_use_baby_sticker_on_post(uuid, uuid) to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

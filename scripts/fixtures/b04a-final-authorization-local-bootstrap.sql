-- Isolated fixture for the final B0.4a authorization batch.
-- Load b04a-p0-local-bootstrap.sql first.

create table auth.users (id uuid primary key);

alter table public.profiles
  add column if not exists darin_id text,
  add column if not exists avatar_url text,
  add column if not exists nickname text,
  add column if not exists avatar_storage_path text,
  add column if not exists default_relation text,
  add column if not exists residence_country text,
  add column if not exists guardian_birth_date date,
  add column if not exists preferred_language text default 'ko',
  add column if not exists created_at timestamptz not null default now();

alter table public.babies
  add column if not exists nickname text,
  add column if not exists birth_date date,
  add column if not exists due_date date,
  add column if not exists child_status text not null default 'newborn',
  add column if not exists gender text,
  add column if not exists photo_url text,
  add column if not exists avatar_storage_path text,
  add column if not exists gestational_age_weeks integer,
  add column if not exists birth_weight text,
  add column if not exists special_notes text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.is_baby_member(p_baby_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_members as member_row
    where member_row.baby_id = p_baby_id
      and member_row.user_id = auth.uid()
      and member_row.status = 'active'
  );
$$;

drop policy if exists profiles_select_own_or_shared on public.profiles;
alter table public.profiles enable row level security;
create policy profiles_select_own_or_shared on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1 from public.baby_members me
      join public.baby_members them on them.baby_id = me.baby_id and them.status = 'active'
      where me.user_id = auth.uid() and me.status = 'active' and them.user_id = profiles.id
    )
    or exists (
      select 1 from public.memory_friends mf
      join public.baby_members bm on bm.baby_id = mf.baby_id and bm.status = 'active'
      where mf.user_id = auth.uid() and mf.status = 'active' and bm.user_id = profiles.id
    )
  );

drop policy if exists babies_select_member on public.babies;
alter table public.babies enable row level security;
create policy babies_select_member on public.babies
  for select to authenticated using (public.is_baby_member(id));
drop policy if exists babies_update_admin_or_editor on public.babies;
create policy babies_update_admin_or_editor on public.babies
  for update to authenticated
  using (public.baby_permission(id) in ('admin', 'editor'))
  with check (public.baby_permission(id) in ('admin', 'editor'));

create table public.diary_entries (
  id uuid primary key,
  baby_id uuid not null references public.babies(id),
  author_id uuid not null references public.profiles(id),
  entry_date date not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, baby_id)
);

create table public.care_logs (id uuid primary key, created_by uuid);
create table public.growth_records (id uuid primary key, created_by uuid);
create table public.notification_events (id uuid primary key, actor_id uuid, recipient_id uuid);
create table public.push_tokens (id uuid primary key, user_id uuid);
create table public.notification_settings (user_id uuid primary key);
create table public.contact_requests (id uuid primary key, user_id uuid);

create table public.growth_books (
  id uuid primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  title text,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.growth_book_pages (
  id uuid primary key,
  growth_book_id uuid not null references public.growth_books(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  page_type text not null default 'custom',
  diary_entry_id uuid references public.diary_entries(id) on delete set null,
  page_order integer not null default 0,
  layout_type text,
  content_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.growth_books alter column created_by drop not null;
alter table public.growth_book_pages alter column created_by drop not null;
alter table public.growth_book_pages add constraint growth_book_pages_id_baby_key unique (id, baby_id);
create unique index growth_book_pages_fixture_order on public.growth_book_pages(growth_book_id, page_order);
create table public.growth_book_media (
  id uuid primary key,
  growth_book_id uuid not null references public.growth_books(id) on delete cascade,
  page_id uuid references public.growth_book_pages(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null default 'image',
  width integer,
  height integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.growth_book_comments (
  id uuid primary key,
  growth_book_id uuid not null references public.growth_books(id) on delete cascade,
  page_id uuid references public.growth_book_pages(id) on delete cascade,
  diary_entry_id uuid references public.diary_entries(id) on delete set null,
  baby_id uuid not null references public.babies(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  comment_type text not null default 'page_comment',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Baseline vulnerable identity guards; final migration must replace the
-- NULL-unsafe comparisons after account-deletion makes creators nullable.
create or replace function public.growth_book_identity_guard()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.baby_id <> old.baby_id or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'growth book identity columns are immutable';
  end if;
  return new;
end;
$$;
create trigger growth_books_identity_guard before update on public.growth_books
  for each row execute function public.growth_book_identity_guard();
create or replace function public.growth_book_page_identity_guard()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.growth_book_id <> old.growth_book_id
    or new.baby_id <> old.baby_id or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'growth book page identity columns are immutable';
  end if;
  return new;
end;
$$;
create trigger growth_book_pages_identity_guard before update on public.growth_book_pages
  for each row execute function public.growth_book_page_identity_guard();

create or replace function public.can_view_growth_book(p_growth_book_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.growth_books b
    where b.id = p_growth_book_id and b.deleted_at is null and public.is_baby_member(b.baby_id)
  );
$$;
create or replace function public.can_edit_growth_book(p_growth_book_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.growth_books b
    where b.id = p_growth_book_id and b.deleted_at is null
      and public.baby_permission(b.baby_id) in ('admin', 'editor')
  );
$$;
create or replace function public.can_view_growth_book_page(p_page_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.growth_book_pages p
    join public.growth_books b on b.id = p.growth_book_id
    where p.id = p_page_id and p.deleted_at is null and b.deleted_at is null
      and p.baby_id = b.baby_id and public.is_baby_member(p.baby_id)
  );
$$;

-- Minimal friend-visible memory graph used by the profile projection regression.
alter table public.memory_posts
  add column if not exists privacy_type text not null default 'friend_circle',
  add column if not exists status text not null default 'published',
  add column if not exists created_at timestamptz not null default now();
update public.memory_posts set privacy_type = 'family_circle', status = 'draft';
create or replace function public.has_friend_visible_memory(p_baby_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memory_friends as friend_row
    join public.memory_posts as post_row on post_row.baby_id = friend_row.baby_id
    where friend_row.baby_id = p_baby_id
      and friend_row.user_id = auth.uid()
      and friend_row.status = 'active'
      and post_row.privacy_type = 'friend_circle'
      and post_row.status = 'published'
      and post_row.deleted_at is null
  );
$$;
create or replace function public.is_friend_visible_memory_contributor(p_baby_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_friend_visible_memory(p_baby_id) and exists (
    select 1 from public.memory_posts as post_row
    where post_row.baby_id = p_baby_id
      and post_row.author_id = p_user_id
      and post_row.privacy_type = 'friend_circle'
      and post_row.status = 'published'
      and post_row.deleted_at is null
  );
$$;
revoke all on function public.has_friend_visible_memory(uuid) from public;
revoke all on function public.is_friend_visible_memory_contributor(uuid, uuid) from public;
grant execute on function public.has_friend_visible_memory(uuid) to authenticated;
grant execute on function public.is_friend_visible_memory_contributor(uuid, uuid) to authenticated;

-- Mirror the existing account-deletion RPC's shared-baby anonymization step.
create or replace function public.prepare_account_deletion()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.babies set created_by = null where created_by = auth.uid();
end;
$$;
revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;

alter table public.growth_books enable row level security;
alter table public.growth_book_pages enable row level security;
alter table public.growth_book_media enable row level security;
alter table public.growth_book_comments enable row level security;
create policy growth_books_select_member on public.growth_books for select to authenticated
  using (deleted_at is null and public.is_baby_member(baby_id));
create policy growth_books_insert_editor on public.growth_books for insert to authenticated
  with check (created_by = auth.uid() and public.baby_permission(baby_id) in ('admin', 'editor'));
create policy growth_books_update_editor on public.growth_books for update to authenticated
  using (public.can_edit_growth_book(id)) with check (public.can_edit_growth_book(id));
create policy growth_book_pages_select_member on public.growth_book_pages for select to authenticated
  using (deleted_at is null and public.can_view_growth_book(growth_book_id));
create policy growth_book_pages_insert_editor on public.growth_book_pages for insert to authenticated
  with check (created_by = auth.uid() and public.can_edit_growth_book(growth_book_id));
create policy growth_book_pages_update_editor on public.growth_book_pages for update to authenticated
  using (public.can_edit_growth_book(growth_book_id)) with check (public.can_edit_growth_book(growth_book_id));
create policy growth_book_media_select_member on public.growth_book_media for select to authenticated
  using (public.can_view_growth_book(growth_book_id));
create policy growth_book_media_insert_editor on public.growth_book_media for insert to authenticated
  with check (created_by = auth.uid() and public.can_edit_growth_book(growth_book_id));
create policy growth_book_media_delete_editor on public.growth_book_media for delete to authenticated
  using (public.can_edit_growth_book(growth_book_id));
create policy growth_book_comments_select_member on public.growth_book_comments for select to authenticated
  using (deleted_at is null and public.can_view_growth_book(growth_book_id));
create policy growth_book_comments_insert_member on public.growth_book_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_growth_book(growth_book_id));
create policy growth_book_comments_update_author_admin on public.growth_book_comments for update to authenticated
  using (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin')
  with check (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin');

grant select, insert, update, delete on public.growth_books, public.growth_book_pages,
  public.growth_book_media, public.growth_book_comments to authenticated;

create table public.baby_caution_foods (
  id uuid primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  food_name text not null,
  normalized_food_name text not null,
  source text not null default 'custom',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.baby_caution_foods enable row level security;
create policy baby_caution_foods_select_member on public.baby_caution_foods
  for select to authenticated using (public.is_baby_member(baby_id));
create policy baby_caution_foods_insert_member on public.baby_caution_foods
  for insert to authenticated with check (public.is_baby_member(baby_id) and created_by = auth.uid());
create policy baby_caution_foods_update_member on public.baby_caution_foods
  for update to authenticated using (public.is_baby_member(baby_id)) with check (public.is_baby_member(baby_id));
create policy baby_caution_foods_delete_admin on public.baby_caution_foods
  for delete to authenticated using (public.baby_permission(baby_id) = 'admin');
grant select, insert, update, delete on public.baby_caution_foods to authenticated;

-- Phase 3C: server-backed Growth Book vertical slice.
-- Existing Diary, Memories, care_logs and growth_records policies are intentionally untouched.

create table if not exists public.growth_books (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  title text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'exported')),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists growth_books_one_active_per_baby_idx
  on public.growth_books (baby_id) where deleted_at is null;
create index if not exists growth_books_baby_idx on public.growth_books (baby_id);
create index if not exists growth_books_baby_deleted_idx on public.growth_books (baby_id, deleted_at);

create table if not exists public.growth_book_pages (
  id uuid primary key default gen_random_uuid(),
  growth_book_id uuid not null references public.growth_books (id) on delete cascade,
  baby_id uuid not null references public.babies (id) on delete cascade,
  page_type text not null check (page_type in ('cover', 'diary', 'letter', 'rolling_paper', 'custom')),
  diary_entry_id uuid references public.diary_entries (id) on delete set null,
  page_order integer not null check (page_order >= 0),
  layout_type text,
  content_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, baby_id),
  check (page_type <> 'diary' or diary_entry_id is not null)
);

create unique index if not exists growth_book_pages_order_unique_idx
  on public.growth_book_pages (growth_book_id, page_order) where deleted_at is null;
create unique index if not exists growth_book_pages_diary_unique_idx
  on public.growth_book_pages (growth_book_id, diary_entry_id)
  where diary_entry_id is not null and deleted_at is null;
create index if not exists growth_book_pages_book_order_idx
  on public.growth_book_pages (growth_book_id, page_order);
create index if not exists growth_book_pages_baby_idx on public.growth_book_pages (baby_id);
create index if not exists growth_book_pages_diary_idx on public.growth_book_pages (diary_entry_id);

create table if not exists public.growth_book_media (
  id uuid primary key default gen_random_uuid(),
  growth_book_id uuid not null references public.growth_books (id) on delete cascade,
  page_id uuid references public.growth_book_pages (id) on delete cascade,
  baby_id uuid not null references public.babies (id) on delete cascade,
  storage_path text not null unique,
  media_type text not null default 'image' check (media_type = 'image'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    page_id is not null
    and split_part(storage_path, '/', 1) = baby_id::text
    and split_part(storage_path, '/', 2) = growth_book_id::text
    and split_part(storage_path, '/', 3) = page_id::text
    and split_part(storage_path, '/', 4) <> ''
  )
);

create index if not exists growth_book_media_book_idx on public.growth_book_media (growth_book_id);
create index if not exists growth_book_media_page_idx on public.growth_book_media (page_id);

create table if not exists public.growth_book_comments (
  id uuid primary key default gen_random_uuid(),
  growth_book_id uuid not null references public.growth_books (id) on delete cascade,
  page_id uuid references public.growth_book_pages (id) on delete cascade,
  diary_entry_id uuid references public.diary_entries (id) on delete set null,
  baby_id uuid not null references public.babies (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (nullif(btrim(body), '') is not null),
  comment_type text not null default 'page_comment'
    check (comment_type in ('page_comment', 'rolling_paper', 'letter')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists growth_book_comments_book_idx on public.growth_book_comments (growth_book_id);
create index if not exists growth_book_comments_page_idx on public.growth_book_comments (page_id);

drop trigger if exists growth_books_set_updated_at on public.growth_books;
create trigger growth_books_set_updated_at before update on public.growth_books
  for each row execute function public.set_updated_at();
drop trigger if exists growth_book_pages_set_updated_at on public.growth_book_pages;
create trigger growth_book_pages_set_updated_at before update on public.growth_book_pages
  for each row execute function public.set_updated_at();
drop trigger if exists growth_book_comments_set_updated_at on public.growth_book_comments;
create trigger growth_book_comments_set_updated_at before update on public.growth_book_comments
  for each row execute function public.set_updated_at();

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

revoke all on function public.can_view_growth_book(uuid) from public;
revoke all on function public.can_edit_growth_book(uuid) from public;
revoke all on function public.can_view_growth_book_page(uuid) from public;
grant execute on function public.can_view_growth_book(uuid) to authenticated;
grant execute on function public.can_edit_growth_book(uuid) to authenticated;
grant execute on function public.can_view_growth_book_page(uuid) to authenticated;

create or replace function public.growth_book_identity_guard()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.baby_id <> old.baby_id or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'growth book identity columns are immutable';
  end if;
  if old.deleted_at is not null and new is distinct from old then
    raise exception 'deleted growth books are immutable';
  end if;
  return new;
end;
$$;
drop trigger if exists growth_books_identity_guard on public.growth_books;
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
  if old.deleted_at is not null and new is distinct from old then
    raise exception 'deleted growth book pages are immutable';
  end if;
  return new;
end;
$$;
drop trigger if exists growth_book_pages_identity_guard on public.growth_book_pages;
create trigger growth_book_pages_identity_guard before update on public.growth_book_pages
  for each row execute function public.growth_book_page_identity_guard();

create or replace function public.soft_delete_growth_book(p_growth_book_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.growth_books b where b.id = p_growth_book_id
      and b.deleted_at is null and public.baby_permission(b.baby_id) = 'admin'
  ) then raise exception 'growth book not found or delete permission denied' using errcode = '42501'; end if;
  update public.growth_books set deleted_at = now() where id = p_growth_book_id and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_growth_book_page(p_page_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.growth_book_pages p join public.growth_books b on b.id = p.growth_book_id
    where p.id = p_page_id and p.deleted_at is null and b.deleted_at is null
      and public.baby_permission(p.baby_id) in ('admin', 'editor')
  ) then raise exception 'growth book page not found or delete permission denied' using errcode = '42501'; end if;
  update public.growth_book_pages set deleted_at = now() where id = p_page_id and deleted_at is null;
end;
$$;

revoke all on function public.soft_delete_growth_book(uuid) from public;
revoke all on function public.soft_delete_growth_book_page(uuid) from public;
grant execute on function public.soft_delete_growth_book(uuid) to authenticated;
grant execute on function public.soft_delete_growth_book_page(uuid) to authenticated;

alter table public.growth_books enable row level security;
alter table public.growth_book_pages enable row level security;
alter table public.growth_book_media enable row level security;
alter table public.growth_book_comments enable row level security;

create policy growth_books_select_member on public.growth_books for select to authenticated
  using (deleted_at is null and public.is_baby_member(baby_id));
create policy growth_books_insert_editor on public.growth_books for insert to authenticated
  with check (created_by = auth.uid() and deleted_at is null and public.baby_permission(baby_id) in ('admin', 'editor'));
create policy growth_books_update_editor on public.growth_books for update to authenticated
  using (deleted_at is null and public.baby_permission(baby_id) in ('admin', 'editor'))
  with check (public.baby_permission(baby_id) in ('admin', 'editor'));

create policy growth_book_pages_select_member on public.growth_book_pages for select to authenticated
  using (deleted_at is null and public.can_view_growth_book(growth_book_id));
create policy growth_book_pages_insert_editor on public.growth_book_pages for insert to authenticated
  with check (
    created_by = auth.uid() and deleted_at is null and public.can_edit_growth_book(growth_book_id)
    and exists (select 1 from public.growth_books b where b.id = growth_book_id and b.baby_id = baby_id and b.deleted_at is null)
  );
create policy growth_book_pages_update_editor on public.growth_book_pages for update to authenticated
  using (deleted_at is null and public.can_edit_growth_book(growth_book_id))
  with check (public.can_edit_growth_book(growth_book_id));

create policy growth_book_media_select_member on public.growth_book_media for select to authenticated
  using (public.can_view_growth_book(growth_book_id) and public.can_view_growth_book_page(page_id));
create policy growth_book_media_insert_editor on public.growth_book_media for insert to authenticated
  with check (
    created_by = auth.uid() and public.can_edit_growth_book(growth_book_id)
    and exists (
      select 1 from public.growth_book_pages p where p.id = page_id and p.growth_book_id = growth_book_id
        and p.baby_id = baby_id and p.deleted_at is null
    )
  );
create policy growth_book_media_delete_editor on public.growth_book_media for delete to authenticated
  using (public.can_edit_growth_book(growth_book_id));

create policy growth_book_comments_select_member on public.growth_book_comments for select to authenticated
  using (deleted_at is null and public.can_view_growth_book(growth_book_id));
create policy growth_book_comments_insert_member on public.growth_book_comments for insert to authenticated
  with check (
    author_id = auth.uid() and deleted_at is null and public.can_view_growth_book(growth_book_id)
    and public.is_baby_member(baby_id)
  );
create policy growth_book_comments_update_author_admin on public.growth_book_comments for update to authenticated
  using (deleted_at is null and (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin'))
  with check (author_id = auth.uid() or public.baby_permission(baby_id) = 'admin');

grant select, insert, update on public.growth_books to authenticated;
grant select, insert, update on public.growth_book_pages to authenticated;
grant select, insert, delete on public.growth_book_media to authenticated;
grant select, insert, update on public.growth_book_comments to authenticated;
grant all on public.growth_books, public.growth_book_pages, public.growth_book_media, public.growth_book_comments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('growth-book-media', 'growth-book-media', false, 26214400,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy growth_book_media_objects_select_member on storage.objects for select to authenticated
  using (
    bucket_id = 'growth-book-media' and exists (
      select 1 from public.growth_book_media m where m.storage_path = name
        and public.can_view_growth_book(m.growth_book_id) and public.can_view_growth_book_page(m.page_id)
    )
  );
create policy growth_book_media_objects_insert_editor on storage.objects for insert to authenticated
  with check (
    bucket_id = 'growth-book-media' and exists (
      select 1 from public.growth_book_pages p join public.growth_books b on b.id = p.growth_book_id
      where p.baby_id::text = split_part(name, '/', 1)
        and b.id::text = split_part(name, '/', 2)
        and p.id::text = split_part(name, '/', 3)
        and split_part(name, '/', 4) <> ''
        and p.baby_id = b.baby_id and p.deleted_at is null and b.deleted_at is null
        and public.can_edit_growth_book(b.id)
    )
  );
create policy growth_book_media_objects_delete_editor on storage.objects for delete to authenticated
  using (
    bucket_id = 'growth-book-media' and exists (
      select 1 from public.growth_book_media m where m.storage_path = name
        and public.can_edit_growth_book(m.growth_book_id)
    )
  );

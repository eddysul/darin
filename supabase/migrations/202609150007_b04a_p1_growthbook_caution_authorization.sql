-- B0.4a final authorization batch (Growthbook graph + caution foods).
-- Child access is always derived from the current parent graph.  Existing
-- rows are preserved with NOT VALID graph constraints; new rows are enforced.

do $$ begin
  alter table public.growth_books
    add constraint growth_books_id_baby_key unique (id, baby_id);
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.diary_entries
    add constraint diary_entries_id_baby_key unique (id, baby_id);
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.growth_book_pages
    add constraint growth_book_pages_book_baby_fk
    foreign key (growth_book_id, baby_id)
    references public.growth_books (id, baby_id)
    not valid;
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.growth_book_pages
    add constraint growth_book_pages_diary_baby_fk
    foreign key (diary_entry_id, baby_id)
    references public.diary_entries (id, baby_id)
    not valid;
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.growth_book_media
    add constraint growth_book_media_book_baby_fk
    foreign key (growth_book_id, baby_id)
    references public.growth_books (id, baby_id)
    not valid;
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.growth_book_media
    add constraint growth_book_media_page_baby_fk
    foreign key (page_id, baby_id)
    references public.growth_book_pages (id, baby_id)
    not valid;
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.growth_book_comments
    add constraint growth_book_comments_book_baby_fk
    foreign key (growth_book_id, baby_id)
    references public.growth_books (id, baby_id)
    not valid;
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.growth_book_comments
    add constraint growth_book_comments_diary_baby_fk
    foreign key (diary_entry_id, baby_id)
    references public.diary_entries (id, baby_id)
    not valid;
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.growth_book_comments
    add constraint growth_book_comments_page_baby_fk
    foreign key (page_id, baby_id)
    references public.growth_book_pages (id, baby_id)
    not valid;
exception when duplicate_object or duplicate_table then null;
end $$;

-- Existing Growthbook identity triggers predate nullable creator fields used by
-- account deletion.  Replace their NULL-unsafe comparisons before tightening
-- the child graph so a deleted creator cannot be reattached to another account.
create or replace function public.growth_book_identity_guard()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.baby_id is distinct from old.baby_id
     or (new.created_by is distinct from old.created_by
         and not (new.created_by is null and pg_trigger_depth() > 1))
     or new.created_at is distinct from old.created_at then
    raise exception 'growth book identity columns are immutable' using errcode = '42501';
  end if;
  if old.deleted_at is not null and new is distinct from old
     and not (new.created_by is null and old.created_by is not null and pg_trigger_depth() > 1) then
    raise exception 'deleted growth books are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.growth_book_page_identity_guard()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.growth_book_id is distinct from old.growth_book_id
     or new.baby_id is distinct from old.baby_id
     or (new.created_by is distinct from old.created_by
         and not (new.created_by is null and pg_trigger_depth() > 1))
     or new.created_at is distinct from old.created_at then
    raise exception 'growth book page identity columns are immutable' using errcode = '42501';
  end if;
  if old.deleted_at is not null and new is distinct from old
     and not (new.created_by is null and old.created_by is not null and pg_trigger_depth() > 1) then
    raise exception 'deleted growth book pages are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.growth_book_page_graph_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.growth_book_id is distinct from old.growth_book_id
     or new.baby_id is distinct from old.baby_id
     or new.diary_entry_id is distinct from old.diary_entry_id then
    if not exists (
      select 1 from public.growth_books as book_row
      where book_row.id = new.growth_book_id
        and book_row.baby_id = new.baby_id
        and book_row.deleted_at is null
    ) then
      raise exception 'growth book page parent mismatch' using errcode = '23503';
    end if;
    if new.diary_entry_id is not null and not exists (
      select 1 from public.diary_entries as diary_row
      where diary_row.id = new.diary_entry_id
        and diary_row.baby_id = new.baby_id
        and diary_row.deleted_at is null
    ) then
      raise exception 'growth book page diary parent mismatch' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists growth_book_pages_graph_guard on public.growth_book_pages;
create trigger growth_book_pages_graph_guard
  before insert or update on public.growth_book_pages
  for each row execute function public.growth_book_page_graph_guard();

create or replace function public.growth_book_media_graph_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.page_id is distinct from old.page_id
     or new.growth_book_id is distinct from old.growth_book_id
     or new.baby_id is distinct from old.baby_id then
    if new.page_id is null or not exists (
      select 1
      from public.growth_book_pages as page_row
      join public.growth_books as book_row on book_row.id = page_row.growth_book_id
      where page_row.id = new.page_id
        and page_row.growth_book_id = new.growth_book_id
        and page_row.baby_id = new.baby_id
        and page_row.deleted_at is null
        and book_row.baby_id = new.baby_id
        and book_row.deleted_at is null
    ) then
      raise exception 'growth book media parent mismatch' using errcode = '23503';
    end if;
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.growth_book_id is distinct from old.growth_book_id
    or new.page_id is distinct from old.page_id
    or new.baby_id is distinct from old.baby_id
    or (new.created_by is distinct from old.created_by
        and not (new.created_by is null and pg_trigger_depth() > 1))
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'growth book media identity columns are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists growth_book_media_graph_guard on public.growth_book_media;
create trigger growth_book_media_graph_guard
  before insert or update on public.growth_book_media
  for each row execute function public.growth_book_media_graph_guard();

create or replace function public.growth_book_comment_graph_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.growth_book_id is distinct from old.growth_book_id
     or new.page_id is distinct from old.page_id
     or new.baby_id is distinct from old.baby_id
     or new.diary_entry_id is distinct from old.diary_entry_id then
    if not exists (
      select 1 from public.growth_books as book_row
      where book_row.id = new.growth_book_id
        and book_row.baby_id = new.baby_id
        and book_row.deleted_at is null
    ) then
      raise exception 'growth book comment parent mismatch' using errcode = '23503';
    end if;
    if new.page_id is not null and not exists (
      select 1 from public.growth_book_pages as page_row
      where page_row.id = new.page_id
        and page_row.growth_book_id = new.growth_book_id
        and page_row.baby_id = new.baby_id
        and page_row.deleted_at is null
    ) then
      raise exception 'growth book comment page mismatch' using errcode = '23503';
    end if;
    if new.diary_entry_id is not null and not exists (
      select 1 from public.diary_entries as diary_row
      where diary_row.id = new.diary_entry_id
        and diary_row.baby_id = new.baby_id
        and diary_row.deleted_at is null
    ) then
      raise exception 'growth book comment diary parent mismatch' using errcode = '23503';
    end if;
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.growth_book_id is distinct from old.growth_book_id
    or new.page_id is distinct from old.page_id
    or new.diary_entry_id is distinct from old.diary_entry_id
    or new.baby_id is distinct from old.baby_id
    or (new.author_id is distinct from old.author_id
        and not (new.author_id is null and pg_trigger_depth() > 1))
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'growth book comment identity columns are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists growth_book_comments_graph_guard on public.growth_book_comments;
create trigger growth_book_comments_graph_guard
  before insert or update on public.growth_book_comments
  for each row execute function public.growth_book_comment_graph_guard();

create or replace function public.can_manage_growth_book_comment(
  p_growth_book_id uuid,
  p_baby_id uuid,
  p_author_id uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.growth_books as book_row
    join public.baby_members as member_row
      on member_row.baby_id = book_row.baby_id
     and member_row.user_id = auth.uid()
     and member_row.status = 'active'
    where book_row.id = p_growth_book_id
      and book_row.baby_id = p_baby_id
      and book_row.deleted_at is null
      and (p_author_id = auth.uid() or member_row.permission_role = 'admin'::public.permission_role)
      and member_row.permission_role in ('admin'::public.permission_role, 'editor'::public.permission_role)
  );
$$;
revoke all on function public.can_manage_growth_book_comment(uuid, uuid, uuid) from public;
grant execute on function public.can_manage_growth_book_comment(uuid, uuid, uuid) to authenticated;

create or replace function public.growth_book_diary_parent_valid(
  p_diary_entry_id uuid,
  p_baby_id uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_baby_member(p_baby_id)
    and p_diary_entry_id is not null
    and exists (
    select 1 from public.diary_entries as diary_row
    where diary_row.id = p_diary_entry_id
      and diary_row.baby_id = p_baby_id
      and diary_row.deleted_at is null
  );
$$;
revoke all on function public.growth_book_diary_parent_valid(uuid, uuid) from public;
grant execute on function public.growth_book_diary_parent_valid(uuid, uuid) to authenticated;

drop policy if exists growth_book_pages_select_member on public.growth_book_pages;
create policy growth_book_pages_select_member on public.growth_book_pages for select to authenticated
  using (
    deleted_at is null
    and public.can_view_growth_book(growth_book_id)
    and exists (
      select 1 from public.growth_books as book_row
      where book_row.id = growth_book_pages.growth_book_id
        and book_row.baby_id = growth_book_pages.baby_id
        and book_row.deleted_at is null
    )
    and (diary_entry_id is null or public.growth_book_diary_parent_valid(diary_entry_id, baby_id))
  );

drop policy if exists growth_book_pages_insert_editor on public.growth_book_pages;
create policy growth_book_pages_insert_editor on public.growth_book_pages for insert to authenticated
  with check (
    created_by = auth.uid()
    and deleted_at is null
    and public.can_edit_growth_book(growth_book_id)
    and exists (
      select 1 from public.growth_books as book_row
      where book_row.id = growth_book_pages.growth_book_id
        and book_row.baby_id = growth_book_pages.baby_id
        and book_row.deleted_at is null
    )
    and (diary_entry_id is null or public.growth_book_diary_parent_valid(diary_entry_id, baby_id))
  );

drop policy if exists growth_book_pages_update_editor on public.growth_book_pages;
create policy growth_book_pages_update_editor on public.growth_book_pages for update to authenticated
  using (
    deleted_at is null
    and public.can_edit_growth_book(growth_book_id)
    and exists (
      select 1 from public.growth_books as book_row
      where book_row.id = growth_book_pages.growth_book_id
        and book_row.baby_id = growth_book_pages.baby_id
        and book_row.deleted_at is null
    )
    and (diary_entry_id is null or public.growth_book_diary_parent_valid(diary_entry_id, baby_id))
  )
  with check (
    public.can_edit_growth_book(growth_book_id)
    and (diary_entry_id is null or public.growth_book_diary_parent_valid(diary_entry_id, baby_id))
  );

drop policy if exists growth_book_media_select_member on public.growth_book_media;
create policy growth_book_media_select_member on public.growth_book_media for select to authenticated
  using (
    public.can_view_growth_book(growth_book_id)
    and public.can_view_growth_book_page(page_id)
    and exists (
      select 1 from public.growth_book_pages as page_row
      where page_row.id = growth_book_media.page_id
        and page_row.growth_book_id = growth_book_media.growth_book_id
        and page_row.baby_id = growth_book_media.baby_id
        and page_row.deleted_at is null
    )
  );

drop policy if exists growth_book_media_insert_editor on public.growth_book_media;
create policy growth_book_media_insert_editor on public.growth_book_media for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_edit_growth_book(growth_book_id)
    and exists (
      select 1 from public.growth_book_pages as page_row
      join public.growth_books as book_row on book_row.id = page_row.growth_book_id
      where page_row.id = growth_book_media.page_id
        and page_row.growth_book_id = growth_book_media.growth_book_id
        and page_row.baby_id = growth_book_media.baby_id
        and book_row.baby_id = growth_book_media.baby_id
        and page_row.deleted_at is null
        and book_row.deleted_at is null
    )
  );

drop policy if exists growth_book_media_delete_editor on public.growth_book_media;
create policy growth_book_media_delete_editor on public.growth_book_media for delete to authenticated
  using (
    public.can_edit_growth_book(growth_book_id)
    and exists (
      select 1 from public.growth_book_pages as page_row
      where page_row.id = growth_book_media.page_id
        and page_row.growth_book_id = growth_book_media.growth_book_id
        and page_row.baby_id = growth_book_media.baby_id
        and page_row.deleted_at is null
    )
  );

drop policy if exists growth_book_comments_select_member on public.growth_book_comments;
create policy growth_book_comments_select_member on public.growth_book_comments for select to authenticated
  using (
    deleted_at is null
    and public.can_view_growth_book(growth_book_id)
    and exists (
      select 1 from public.growth_books as book_row
      where book_row.id = growth_book_comments.growth_book_id
        and book_row.baby_id = growth_book_comments.baby_id
        and book_row.deleted_at is null
    )
    and (
      page_id is null or exists (
        select 1 from public.growth_book_pages as page_row
        where page_row.id = growth_book_comments.page_id
          and page_row.growth_book_id = growth_book_comments.growth_book_id
          and page_row.baby_id = growth_book_comments.baby_id
          and page_row.deleted_at is null
      )
    )
    and (diary_entry_id is null or public.growth_book_diary_parent_valid(diary_entry_id, baby_id))
  );

-- Keep soft-deleted comments hidden from ordinary readers while allowing the
-- author/current admin to complete and verify moderation updates.  An UPDATE
-- also needs a SELECT-visible post-image in PostgreSQL RLS; this narrow policy
-- avoids making deleted comments visible to other baby members.
drop policy if exists growth_book_comments_select_moderated on public.growth_book_comments;
create policy growth_book_comments_select_moderated on public.growth_book_comments for select to authenticated
  using (
    deleted_at is not null
    and public.can_manage_growth_book_comment(growth_book_id, baby_id, author_id)
  );

drop policy if exists growth_book_comments_insert_member on public.growth_book_comments;
create policy growth_book_comments_insert_member on public.growth_book_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and public.can_view_growth_book(growth_book_id)
    and public.baby_permission(baby_id) in ('admin'::public.permission_role, 'editor'::public.permission_role)
    and public.is_baby_member(baby_id)
    and exists (
      select 1 from public.growth_books as book_row
      where book_row.id = growth_book_comments.growth_book_id
        and book_row.baby_id = growth_book_comments.baby_id
        and book_row.deleted_at is null
    )
    and (
      page_id is null or exists (
        select 1 from public.growth_book_pages as page_row
        where page_row.id = growth_book_comments.page_id
          and page_row.growth_book_id = growth_book_comments.growth_book_id
          and page_row.baby_id = growth_book_comments.baby_id
          and page_row.deleted_at is null
      )
    )
    and (diary_entry_id is null or public.growth_book_diary_parent_valid(diary_entry_id, baby_id))
  );

drop policy if exists growth_book_comments_update_author_admin on public.growth_book_comments;
create policy growth_book_comments_update_author_admin on public.growth_book_comments for update to authenticated
  using (
    deleted_at is null
    and public.can_manage_growth_book_comment(growth_book_id, baby_id, author_id)
  )
  with check (
    public.can_manage_growth_book_comment(growth_book_id, baby_id, author_id)
  );

create or replace function public.baby_caution_food_identity_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.baby_id is distinct from old.baby_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'caution food identity columns are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists baby_caution_foods_identity_guard on public.baby_caution_foods;
create trigger baby_caution_foods_identity_guard
  before update on public.baby_caution_foods
  for each row execute function public.baby_caution_food_identity_guard();

drop policy if exists baby_caution_foods_select_member on public.baby_caution_foods;
create policy baby_caution_foods_select_member on public.baby_caution_foods
  for select to authenticated using (public.is_baby_member(baby_id));

drop policy if exists baby_caution_foods_insert_member on public.baby_caution_foods;
create policy baby_caution_foods_insert_member on public.baby_caution_foods
  for insert to authenticated with check (
    public.baby_permission(baby_id) in ('admin'::public.permission_role, 'editor'::public.permission_role)
    and created_by = auth.uid()
  );

drop policy if exists baby_caution_foods_update_member on public.baby_caution_foods;
create policy baby_caution_foods_update_member on public.baby_caution_foods
  for update to authenticated
  using (public.baby_permission(baby_id) in ('admin'::public.permission_role, 'editor'::public.permission_role))
  with check (
    public.baby_permission(baby_id) in ('admin'::public.permission_role, 'editor'::public.permission_role)
  );

drop policy if exists baby_caution_foods_delete_admin on public.baby_caution_foods;
create policy baby_caution_foods_delete_admin on public.baby_caution_foods
  for delete to authenticated using (public.baby_permission(baby_id) = 'admin'::public.permission_role);

revoke delete on public.baby_caution_foods from authenticated;
grant select, insert, update, delete on public.baby_caution_foods to authenticated;

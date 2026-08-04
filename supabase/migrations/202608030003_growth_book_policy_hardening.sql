-- Phase 3C hardening found during live RLS/Storage QA.

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
  if old.deleted_at is null and new.deleted_at is not null
    and public.baby_permission(old.baby_id) <> 'admin' then
    raise exception 'growth book delete permission denied' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop policy if exists growth_book_comments_insert_member on public.growth_book_comments;
create policy growth_book_comments_insert_member on public.growth_book_comments for insert to authenticated
  with check (
    author_id = auth.uid() and deleted_at is null
    and exists (
      select 1 from public.growth_books b
      where b.id = growth_book_id and b.baby_id = baby_id and b.deleted_at is null
        and public.is_baby_member(b.baby_id)
    )
    and (
      page_id is null or exists (
        select 1 from public.growth_book_pages p
        where p.id = page_id and p.growth_book_id = growth_book_id
          and p.baby_id = baby_id and p.deleted_at is null
      )
    )
  );

drop policy if exists growth_book_media_objects_delete_editor on storage.objects;
create policy growth_book_media_objects_delete_editor on storage.objects for delete to authenticated
  using (
    bucket_id = 'growth-book-media' and exists (
      select 1 from public.growth_book_pages p join public.growth_books b on b.id = p.growth_book_id
      where p.baby_id::text = split_part(name, '/', 1)
        and b.id::text = split_part(name, '/', 2)
        and p.id::text = split_part(name, '/', 3)
        and p.baby_id = b.baby_id and p.deleted_at is null and b.deleted_at is null
        and public.can_edit_growth_book(b.id)
    )
  );

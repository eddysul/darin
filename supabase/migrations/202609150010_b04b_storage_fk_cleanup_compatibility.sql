-- Preserve B0.4a account-deletion FK cleanup while keeping Storage bindings
-- immutable and protected. This follows deployed 008/009; their history and
-- source remain unchanged.
begin;

create or replace function public.baby_sticker_identity_unchanged()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id or new.baby_id is distinct from old.baby_id
    or (new.created_by is distinct from old.created_by
      and not (new.created_by is null and pg_trigger_depth()>1))
    or new.created_at is distinct from old.created_at then
    raise exception 'baby sticker identity columns are immutable' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_retired_media_attachment()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_bucket text;
begin
  -- Updates that do not move the Storage binding (including FK SET NULL during
  -- account deletion) cannot attach or revive an object and need no recheck.
  if tg_op='UPDATE' and new.storage_path is not distinct from old.storage_path then return new; end if;
  v_bucket := case tg_table_name when 'memory_media' then 'memories' when 'diary_media' then 'diary-media'
    when 'growth_book_media' then 'growth-book-media' when 'baby_stickers' then 'baby-stickers' end;
  perform 1 from storage.objects where bucket_id=v_bucket and name=new.storage_path for update;
  if not found or storage_security.key_retired(v_bucket,new.storage_path) then
    raise exception 'missing or retired media key' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.growth_media_attachment_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner text;
begin
  if tg_op='UPDATE' then
    if new.storage_path is distinct from old.storage_path
      or new.growth_book_id is distinct from old.growth_book_id
      or new.page_id is distinct from old.page_id or new.baby_id is distinct from old.baby_id then
      raise exception 'growth media storage binding is immutable' using errcode='42501';
    end if;
    return new;
  end if;
  perform 1 from growth_book_pages p join growth_books b on b.id=p.growth_book_id
    where p.id=new.page_id and b.id=new.growth_book_id and p.baby_id=new.baby_id
      and b.baby_id=new.baby_id and p.deleted_at is null and b.deleted_at is null
    for share of p,b;
  if not found then raise exception 'growth media parent is deleted or missing' using errcode='42501'; end if;
  select owner_id into v_owner from storage.objects
    where bucket_id='growth-book-media' and name=new.storage_path for update;
  if not found or v_owner is distinct from auth.uid()::text
    or storage_security.key_retired('growth-book-media',new.storage_path) then
    raise exception 'growth upload missing, foreign, or retired' using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function public.baby_sticker_identity_unchanged(),
  public.guard_retired_media_attachment(),public.growth_media_attachment_guard() from public;
commit;

-- Durable deletion intents. No Storage metadata/bytes are deleted by SQL.
begin;
create table public.media_cleanup_queue (
  bucket_id text not null,
  storage_path text not null,
  requested_by uuid,
  state text not null default 'pending' check(state in ('pending','leased','done')),
  lease_id uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(bucket_id,storage_path)
);
alter table public.media_cleanup_queue enable row level security;
revoke all on public.media_cleanup_queue from public,anon,authenticated;

create function storage_security.key_retired(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from media_cleanup_queue where bucket_id=p_bucket and storage_path=p_path);
$$;
revoke all on function storage_security.key_retired(text,text) from public;
grant execute on function storage_security.key_retired(text,text) to authenticated;

-- Central reference check used both when a client asks to retire an upload and
-- immediately before a worker leases it. Keeping this server-owned prevents a
-- currently attached object from ever becoming a deletion intent.
create function storage_security.key_attached(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select case p_bucket
    when 'memories' then exists(select 1 from memory_media m join memory_posts p on p.id=m.memory_post_id
      where m.storage_path=p_path and p.deleted_at is null)
    when 'diary-media' then exists(select 1 from diary_media m join diary_entries d on d.id=m.diary_entry_id
      where m.storage_path=p_path and d.deleted_at is null)
    when 'growth-book-media' then exists(select 1 from growth_book_media m
      join growth_book_pages p on p.id=m.page_id join growth_books b on b.id=m.growth_book_id
      where m.storage_path=p_path and p.deleted_at is null and b.deleted_at is null)
    when 'baby-stickers' then exists(select 1 from baby_stickers where storage_path=p_path and deleted_at is null)
    when 'profile-media' then
      exists(select 1 from profiles where avatar_storage_path=p_path)
      or exists(select 1 from babies where avatar_storage_path=p_path)
    else true
  end;
$$;
revoke all on function storage_security.key_attached(text,text) from public,anon,authenticated;
create policy b04b_retired_insert on storage.objects as restrictive for insert to authenticated
  with check(not storage_security.key_retired(bucket_id,name));
create policy b04b_retired_update on storage.objects as restrictive for update to authenticated
  using(not storage_security.key_retired(bucket_id,name)) with check(not storage_security.key_retired(bucket_id,name));
create policy b04b_retired_select on storage.objects as restrictive for select to authenticated
  using(not storage_security.key_retired(bucket_id,name));

create function public.enqueue_deleted_media()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_bucket text;
begin
  v_bucket := case tg_table_name when 'memory_media' then 'memories' when 'diary_media' then 'diary-media'
    when 'growth_book_media' then 'growth-book-media' when 'baby_stickers' then 'baby-stickers' end;
  -- Defense against legacy malformed cross-scope references. They require
  -- manual preflight resolution, never privileged arbitrary-path deletion.
  if split_part(old.storage_path,'/',1)=old.baby_id::text and storage_key_is_canonical(old.storage_path) then
    perform 1 from storage.objects where bucket_id=v_bucket and name=old.storage_path for update;
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
    values(v_bucket,old.storage_path,auth.uid()) on conflict do nothing;
  end if;
  return old;
end;
$$;
create trigger b04b_delete_memory_media after delete on memory_media for each row execute function enqueue_deleted_media();
create trigger b04b_delete_diary_media after delete on diary_media for each row execute function enqueue_deleted_media();
create trigger b04b_delete_growth_media after delete on growth_book_media for each row execute function enqueue_deleted_media();
create trigger b04b_delete_sticker after delete on baby_stickers for each row execute function enqueue_deleted_media();

create function public.enqueue_deleted_storage_scope()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
  select o.bucket_id,o.name,case when tg_table_name='profiles' then old.id else auth.uid() end
  from storage.objects o
  where storage_key_is_canonical(o.name) and (
    (tg_table_name='profiles' and o.bucket_id='profile-media' and split_part(o.name,'/',1)='users' and split_part(o.name,'/',2)=old.id::text)
    or (tg_table_name='babies' and (
      (o.bucket_id in ('memories','diary-media','growth-book-media','baby-stickers') and split_part(o.name,'/',1)=old.id::text)
      or (o.bucket_id='profile-media' and split_part(o.name,'/',1)='babies' and split_part(o.name,'/',2)=old.id::text)))
  ) on conflict do nothing;
  return old;
end;
$$;
create trigger b04b_delete_baby_storage before delete on babies for each row execute function enqueue_deleted_storage_scope();
create trigger b04b_delete_profile_storage before delete on profiles for each row execute function enqueue_deleted_storage_scope();

-- Includes completed uploads whose DB attachment failed before a child row
-- existed. Parent deletion must not strand those final-path objects forever.
create function public.enqueue_deleted_media_parent()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_bucket text;
begin
  v_bucket:=case tg_table_name when 'memory_posts' then 'memories' when 'diary_entries' then 'diary-media' else 'growth-book-media' end;
  insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
  select o.bucket_id,o.name,auth.uid() from storage.objects o
  where o.bucket_id=v_bucket and storage_key_is_canonical(o.name) and split_part(o.name,'/',1)=old.baby_id::text
    and (split_part(o.name,'/',case when tg_table_name='growth_book_pages' then 3 else 2 end)=old.id::text
      or exists(select 1 from media_temp_claims c where c.bucket_id=o.bucket_id and c.storage_path=o.name and c.resource_id=old.id))
  on conflict do nothing;
  return old;
end;
$$;
revoke all on function public.enqueue_deleted_media_parent() from public;
create trigger b04b_delete_memory_parent before delete on memory_posts for each row execute function enqueue_deleted_media_parent();
create trigger b04b_delete_diary_parent before delete on diary_entries for each row execute function enqueue_deleted_media_parent();
create trigger b04b_delete_book_parent before delete on growth_books for each row execute function enqueue_deleted_media_parent();
create trigger b04b_delete_page_parent before delete on growth_book_pages for each row execute function enqueue_deleted_media_parent();

-- Product deletion is a parent soft-delete. Queue every child object in the
-- same transaction so deletion never depends on a later client callback.
create function public.enqueue_soft_deleted_media_parent()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.deleted_at is not null or new.deleted_at is null then return new; end if;
  if tg_table_name='memory_posts' then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      select 'memories',x.storage_path,auth.uid() from (
        select m.storage_path from memory_media m where m.memory_post_id=old.id
        union select o.name from storage.objects o where o.bucket_id='memories'
          and split_part(o.name,'/',1)=old.baby_id::text and split_part(o.name,'/',2)=old.id::text
        union select o.name from storage.objects o join media_temp_claims c
          on c.bucket_id=o.bucket_id and c.storage_path=o.name
          where o.bucket_id='memories' and c.resource_id=old.id and c.baby_id=old.baby_id
      ) x where public.storage_key_is_canonical(x.storage_path)
      on conflict do nothing;
  elsif tg_table_name='diary_entries' then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      select 'diary-media',x.storage_path,auth.uid() from (
        select m.storage_path from diary_media m where m.diary_entry_id=old.id
        union select o.name from storage.objects o where o.bucket_id='diary-media'
          and split_part(o.name,'/',1)=old.baby_id::text and split_part(o.name,'/',2)=old.id::text
        union select o.name from storage.objects o join media_temp_claims c
          on c.bucket_id=o.bucket_id and c.storage_path=o.name
          where o.bucket_id='diary-media' and c.resource_id=old.id and c.baby_id=old.baby_id
      ) x where public.storage_key_is_canonical(x.storage_path)
      on conflict do nothing;
  elsif tg_table_name='growth_book_pages' then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      select 'growth-book-media',x.storage_path,auth.uid() from (
        select m.storage_path from growth_book_media m where m.page_id=old.id
        union select o.name from storage.objects o where o.bucket_id='growth-book-media'
          and split_part(o.name,'/',1)=old.baby_id::text
          and split_part(o.name,'/',2)=old.growth_book_id::text and split_part(o.name,'/',3)=old.id::text
      ) x where public.storage_key_is_canonical(x.storage_path)
      on conflict do nothing;
  elsif tg_table_name='growth_books' then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      select 'growth-book-media',x.storage_path,auth.uid() from (
        select m.storage_path from growth_book_media m where m.growth_book_id=old.id
        union select o.name from storage.objects o where o.bucket_id='growth-book-media'
          and split_part(o.name,'/',1)=old.baby_id::text and split_part(o.name,'/',2)=old.id::text
      ) x where public.storage_key_is_canonical(x.storage_path)
      on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger b04b_soft_delete_memory_parent after update of deleted_at on memory_posts
  for each row execute function public.enqueue_soft_deleted_media_parent();
create trigger b04b_soft_delete_diary_parent after update of deleted_at on diary_entries
  for each row execute function public.enqueue_soft_deleted_media_parent();
create trigger b04b_soft_delete_book_parent after update of deleted_at on growth_books
  for each row execute function public.enqueue_soft_deleted_media_parent();
create trigger b04b_soft_delete_page_parent after update of deleted_at on growth_book_pages
  for each row execute function public.enqueue_soft_deleted_media_parent();

-- Memories had no deleted-row immutability guard in its baseline schema. Once
-- bytes are queued, restoring the parent would create a live broken reference.
create function public.guard_deleted_memory_restore()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted memory posts are immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger b04b_deleted_memory_immutable before update of deleted_at on memory_posts
  for each row execute function public.guard_deleted_memory_restore();

create function public.guard_retired_media_attachment()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_bucket text;
begin
  v_bucket := case tg_table_name when 'memory_media' then 'memories' when 'diary_media' then 'diary-media'
    when 'growth_book_media' then 'growth-book-media' when 'baby_stickers' then 'baby-stickers' end;
  -- Same lock as attachment and Storage API removal; queued keys never reused.
  perform 1 from storage.objects where bucket_id=v_bucket and name=new.storage_path for update;
  if storage_security.key_retired(v_bucket,new.storage_path) then
    raise exception 'retired media key' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger b04b_retired_memory before insert or update on memory_media for each row execute function guard_retired_media_attachment();
create trigger b04b_retired_diary before insert or update on diary_media for each row execute function guard_retired_media_attachment();
create trigger b04b_retired_growth before insert or update on growth_book_media for each row execute function guard_retired_media_attachment();
create trigger b04b_retired_sticker before insert or update on baby_stickers for each row execute function guard_retired_media_attachment();

create function public.guard_retired_avatar_attachment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.avatar_storage_path is null or new.avatar_storage_path is not distinct from old.avatar_storage_path then
    return new;
  end if;
  perform 1 from storage.objects where bucket_id='profile-media' and name=new.avatar_storage_path for update;
  if not found or storage_security.key_retired('profile-media',new.avatar_storage_path) then
    raise exception 'missing or retired avatar key' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger b04b_retired_profile_avatar before update of avatar_storage_path on profiles
  for each row execute function public.guard_retired_avatar_attachment();
create trigger b04b_retired_baby_avatar before update of avatar_storage_path on babies
  for each row execute function public.guard_retired_avatar_attachment();

create function public.claim_media_cleanup(p_requested_by uuid, p_limit integer default 50)
returns table(bucket_id text,storage_path text,lease_id uuid)
language sql volatile security definer set search_path=public as $$
  with candidates as (
    select q.bucket_id,q.storage_path from media_cleanup_queue q
    where (p_requested_by is null or q.requested_by=p_requested_by)
      and (q.state='pending' or (q.state='leased' and q.lease_until<now()))
      and not storage_security.key_attached(q.bucket_id,q.storage_path)
    order by q.created_at for update skip locked limit greatest(0,least(p_limit,100))
  ) update media_cleanup_queue q set state='leased',lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes'
    from candidates c where q.bucket_id=c.bucket_id and q.storage_path=c.storage_path
    returning q.bucket_id,q.storage_path,q.lease_id;
$$;
create function public.finish_media_cleanup(p_bucket text,p_path text,p_lease uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update media_cleanup_queue set state='done',completed_at=now(),lease_until=null
    where bucket_id=p_bucket and storage_path=p_path and state='leased' and lease_id=p_lease;
  return found;
end;
$$;
create function public.queue_expired_temp_media(p_limit integer default 100)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  insert into media_cleanup_queue(bucket_id,storage_path)
  select o.bucket_id,o.name from storage.objects o
  where o.bucket_id in ('memories','diary-media') and public.is_temp_media_path(o.name)
    and storage_key_is_canonical(o.name) and o.created_at<now()-interval '24 hours'
    and not exists(select 1 from memory_media m where o.bucket_id='memories' and m.storage_path=o.name)
    and not exists(select 1 from diary_media m where o.bucket_id='diary-media' and m.storage_path=o.name)
    and not exists(select 1 from media_cleanup_queue q where q.bucket_id=o.bucket_id and q.storage_path=o.name)
  order by o.created_at limit greatest(0,least(p_limit,100)) for update of o skip locked
  on conflict do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.enqueue_deleted_media(),public.enqueue_deleted_storage_scope(),public.guard_retired_media_attachment(),
  public.enqueue_soft_deleted_media_parent(),public.guard_deleted_memory_restore() from public;
revoke all on function public.claim_media_cleanup(uuid,integer),public.finish_media_cleanup(text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_media_cleanup(uuid,integer),public.finish_media_cleanup(text,text,uuid) to service_role;
revoke all on function public.queue_expired_temp_media(integer) from public,anon,authenticated;
grant execute on function public.queue_expired_temp_media(integer) to service_role;

-- A client may retire only its own still-unattached upload. The server derives
-- authority from current Storage ownership/resource policy and creates a
-- durable intent; clients never delete bytes directly.
create function public.retire_unattached_storage_upload(p_bucket text,p_path text)
returns boolean language plpgsql volatile security definer set search_path=public as $$
declare v_owner text;
begin
  if auth.uid() is null or p_bucket not in ('memories','diary-media','growth-book-media','baby-stickers','profile-media')
    or not public.storage_key_is_canonical(p_path) then return false; end if;
  select owner_id into v_owner from storage.objects where bucket_id=p_bucket and name=p_path for update;
  if not found or v_owner is distinct from auth.uid()::text
    or storage_security.key_attached(p_bucket,p_path)
    or not storage_security.resource_access(p_bucket,p_path,v_owner,'insert') then return false; end if;
  insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
    values(p_bucket,p_path,auth.uid()) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.retire_unattached_storage_upload(text,text) from public,anon;
grant execute on function public.retire_unattached_storage_upload(text,text) to authenticated;

create function public.enqueue_replaced_storage_reference()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_bucket text;
begin
  if old.storage_path is null or old.storage_path is not distinct from new.storage_path then return new; end if;
  v_bucket:=case tg_table_name when 'baby_stickers' then 'baby-stickers' end;
  if v_bucket is not null and public.storage_key_is_canonical(old.storage_path) then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      values(v_bucket,old.storage_path,auth.uid()) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger b04b_replace_sticker_storage after update of storage_path on baby_stickers
  for each row execute function public.enqueue_replaced_storage_reference();

create function public.enqueue_soft_deleted_sticker()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null
    and public.storage_key_is_canonical(old.storage_path) then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      values('baby-stickers',old.storage_path,auth.uid()) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger b04b_soft_delete_sticker after update of deleted_at on baby_stickers
  for each row execute function public.enqueue_soft_deleted_sticker();

create function public.enqueue_replaced_avatar()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.avatar_storage_path is not null and old.avatar_storage_path is distinct from new.avatar_storage_path
    and public.storage_key_is_canonical(old.avatar_storage_path) then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      values('profile-media',old.avatar_storage_path,auth.uid()) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger b04b_replace_profile_avatar after update of avatar_storage_path on profiles
  for each row execute function public.enqueue_replaced_avatar();
create trigger b04b_replace_baby_avatar after update of avatar_storage_path on babies
  for each row execute function public.enqueue_replaced_avatar();
revoke all on function public.guard_retired_avatar_attachment(),public.enqueue_soft_deleted_sticker() from public;
commit;

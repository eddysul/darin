-- B0.4b: resource authorization remains owned by B0.4a.
-- No object moves/deletes. Existing temp paths keep their names and owner_id.
begin;
create schema if not exists storage_security;
revoke all on schema storage_security from public;
grant usage on schema storage_security to authenticated;

-- Sticker assets are immutable Storage objects, but replacing a sticker keeps
-- the logical sticker id so comments continue to reference the same row. The
-- original v2 schema coupled the object filename to the row id and made that
-- binding immutable. B0.4b permits a fresh UUID filename on replacement while
-- preserving every other identity column.
alter table public.baby_stickers drop constraint if exists baby_stickers_check;
alter table public.baby_stickers drop constraint if exists b04b_baby_sticker_storage_path_check;
alter table public.baby_stickers add constraint b04b_baby_sticker_storage_path_check check (
  split_part(storage_path, '/', 1) = baby_id::text
  and split_part(storage_path, '/', 2) ~* '^[0-9a-f-]{36}\.png$'
  and array_length(string_to_array(storage_path, '/'), 1) = 2
);
create or replace function public.baby_sticker_identity_unchanged()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.baby_id <> old.baby_id
    or new.created_by is distinct from old.created_by
    or new.created_at <> old.created_at then
    raise exception 'baby sticker identity columns are immutable';
  end if;
  return new;
end;
$$;

create table public.media_temp_claims (
  bucket_id text not null check (bucket_id in ('memories','diary-media')),
  storage_path text not null,
  baby_id uuid not null,
  resource_id uuid not null,
  uploader_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (bucket_id, storage_path)
);
alter table public.media_temp_claims enable row level security;
revoke all on public.media_temp_claims from public, anon, authenticated;
-- Tombstones intentionally survive resource deletion: a final asset may never
-- become an unlinked uploader-readable temp object again.
insert into public.media_temp_claims(bucket_id,storage_path,baby_id,resource_id,uploader_id)
select 'memories',m.storage_path,m.baby_id,m.memory_post_id,o.owner_id::uuid
from public.memory_media m join storage.objects o on o.bucket_id='memories' and o.name=m.storage_path
where public.is_temp_media_path(m.storage_path) and o.owner_id ~* '^[0-9a-f-]{36}$'
union all
select 'diary-media',m.storage_path,m.baby_id,m.diary_entry_id,o.owner_id::uuid
from public.diary_media m join storage.objects o on o.bucket_id='diary-media' and o.name=m.storage_path
where public.is_temp_media_path(m.storage_path) and o.owner_id ~* '^[0-9a-f-]{36}$';

create function public.storage_key_is_canonical(p_name text)
returns boolean language sql immutable set search_path=public as $$
  select coalesce(length(p_name) between 1 and 512
    and p_name ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*/[A-Za-z0-9_-]+\.(jpg|jpeg|png|heic|heif|webp)$',false);
$$;

create function storage_security.resource_access(p_bucket text, p_name text, p_owner text, p_action text)
returns boolean language plpgsql volatile security definer set search_path=public as $$
declare
  v_resource uuid;
  v_baby uuid;
  v_ready boolean;
  v_claim public.media_temp_claims%rowtype;
begin
  if auth.uid() is null or not public.storage_key_is_canonical(p_name)
    or p_action not in ('read','insert','delete','update') then return false; end if;
  if p_bucket in ('memories','diary-media') then
    if p_action='update' then return false; end if; -- immutable assets: no move/overwrite
    if p_bucket='memories' then
      select memory_post_id,baby_id,upload_status='ready' into v_resource,v_baby,v_ready
      from memory_media where storage_path=p_name;
    else
      select diary_entry_id,baby_id,upload_status='ready' into v_resource,v_baby,v_ready
      from diary_media where storage_path=p_name;
    end if;
    if v_resource is not null then
      if split_part(p_name,'/',1) <> v_baby::text then return false; end if;
      if p_action='read' then
        return coalesce(v_ready and case when p_bucket='memories' then can_view_memory_post(v_resource)
          else can_view_diary_entry(v_resource) end,false);
      end if;
      -- Never overwrite/recreate a referenced object; retry uses a new upload.
      if p_action='insert' then return false; end if;
      return coalesce(case when p_bucket='memories' then can_manage_memory_post(v_resource)
        else can_manage_diary_entry(v_resource) end,false);
    end if;
    select * into v_claim from media_temp_claims where bucket_id=p_bucket and storage_path=p_name;
    if found then
      -- A removed DB reference doesn't revive read or upload authority.
      return p_action='delete' and coalesce(case when p_bucket='memories' then can_manage_memory_post(v_claim.resource_id)
        else can_manage_diary_entry(v_claim.resource_id) end,false);
    end if;
    if public.is_temp_media_path(p_name) then
      v_baby := split_part(p_name,'/',1)::uuid;
      return p_owner=auth.uid()::text
        and coalesce(public.current_baby_write_permission(v_baby) in ('admin','editor'),false)
        and (p_action='insert' or exists(select 1 from storage.objects o
          where o.bucket_id=p_bucket and o.name=p_name and o.created_at>now()-interval '24 hours'));
    end if;
    if array_length(string_to_array(p_name,'/'),1) <> 3 then return false; end if;
    if p_bucket='memories' then
      select id into v_resource from memory_posts where id::text=split_part(p_name,'/',2)
        and baby_id::text=split_part(p_name,'/',1) and deleted_at is null
        for share;
    else
      select id into v_resource from diary_entries where id::text=split_part(p_name,'/',2)
        and baby_id::text=split_part(p_name,'/',1) and deleted_at is null
        for share;
    end if;
    -- Unlinked final upload may only be cleaned up, never read/listed.
    return p_action in ('insert','delete') and coalesce(case when p_bucket='memories'
      then can_manage_memory_post(v_resource) else can_manage_diary_entry(v_resource) end,false);
  elsif p_bucket='profile-media' then
    if array_length(string_to_array(p_name,'/'),1) <> 3
      or split_part(p_name,'/',3) !~ '^(avatar|[0-9a-f-]{36})\.(jpg|jpeg|png|heic|heif|webp)$' then return false; end if;
    if p_action <> 'read' then
      if split_part(p_name,'/',1)='users' then return split_part(p_name,'/',2)=auth.uid()::text; end if;
      if split_part(p_name,'/',1)='babies' then
        return coalesce(public.current_baby_write_permission(split_part(p_name,'/',2)::uuid) in ('admin','editor'),false);
      end if;
      return false;
    end if;
    if split_part(p_name,'/',1)='users' then
      if split_part(p_name,'/',2)=auth.uid()::text then return true; end if;
      return exists(select 1 from list_visible_profile_display(array(select id from profiles where id::text=split_part(p_name,'/',2))) p
        where p.avatar_storage_path=p_name);
    end if;
    return exists(select 1 from babies b where b.id::text=split_part(p_name,'/',2)
      and b.avatar_storage_path=p_name and (is_baby_member(b.id) or has_friend_visible_memory(b.id)));
  elsif p_bucket='growth-book-media' then
    if array_length(string_to_array(p_name,'/'),1)<>4 then return false; end if;
    if p_action='update' then return false; end if;
    if p_action='read' then
      return exists(select 1 from growth_book_media m where m.storage_path=p_name
        and can_view_growth_book(m.growth_book_id) and can_view_growth_book_page(m.page_id));
    end if;
    if p_action='insert' then
      select p.id into v_resource from growth_book_pages p join growth_books b on b.id=p.growth_book_id
        where p.baby_id=b.baby_id and b.baby_id::text=split_part(p_name,'/',1)
        and b.id::text=split_part(p_name,'/',2) and p.id::text=split_part(p_name,'/',3)
        and p.deleted_at is null and b.deleted_at is null and can_view_growth_book_page(p.id)
        and public.current_baby_write_permission(b.baby_id) in ('admin','editor')
        for share of p,b;
      return found;
    end if;
    return exists(select 1 from growth_book_pages p join growth_books b on b.id=p.growth_book_id
      where p.baby_id=b.baby_id and b.baby_id::text=split_part(p_name,'/',1)
      and b.id::text=split_part(p_name,'/',2) and p.id::text=split_part(p_name,'/',3)
      and p.deleted_at is null and b.deleted_at is null and can_view_growth_book_page(p.id)
      and public.current_baby_write_permission(b.baby_id) in ('admin','editor'));
  elsif p_bucket='baby-stickers' then
    if array_length(string_to_array(p_name,'/'),1)<>2 or p_name !~ '\.png$' then return false; end if;
    if p_action='read' then return exists(select 1 from baby_stickers s where s.storage_path=p_name and can_view_baby_sticker(s.id)); end if;
    return exists(select 1 from babies b where b.id::text=split_part(p_name,'/',1)
      and public.current_baby_write_permission(b.id) in ('admin','editor'));
  end if;
  return false;
exception when invalid_text_representation then return false;
end;
$$;
revoke all on function public.storage_key_is_canonical(text) from public;
revoke all on function storage_security.resource_access(text,text,text,text) from public;
grant execute on function public.storage_key_is_canonical(text) to authenticated;
grant execute on function storage_security.resource_access(text,text,text,text) to authenticated;

create function public.verify_owned_storage_upload(p_bucket text,p_path text)
returns boolean language sql volatile security definer set search_path=public as $$
  select exists(select 1 from storage.objects o where o.bucket_id=p_bucket and o.name=p_path
    and storage_security.resource_access(o.bucket_id,o.name,o.owner_id,'insert'));
$$;
revoke all on function public.verify_owned_storage_upload(text,text) from public,anon;
grant execute on function public.verify_owned_storage_upload(text,text) to authenticated;

-- Signing is server-owned. Authenticated clients pass only a typed resource ID;
-- this resolver derives the object key after current parent-resource checks.
create function public.resolve_private_media_for_signing(p_kind text,p_resource_id uuid)
returns table(bucket_id text,storage_path text,expires_in integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then return; end if;
  if p_kind='memory_media' then
    return query select 'memories'::text,m.storage_path,180
      from memory_media m where m.id=p_resource_id and m.upload_status='ready'
      and public.can_view_memory_post(m.memory_post_id) and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='diary_media' then
    return query select 'diary-media'::text,m.storage_path,300
      from diary_media m where m.id=p_resource_id and m.upload_status='ready'
      and public.can_view_diary_entry(m.diary_entry_id) and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='growth_book_media' then
    return query select 'growth-book-media'::text,m.storage_path,300
      from growth_book_media m where m.id=p_resource_id
      and public.can_view_growth_book(m.growth_book_id) and public.can_view_growth_book_page(m.page_id)
      and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='baby_sticker' then
    return query select 'baby-stickers'::text,s.storage_path,180
      from baby_stickers s where s.id=p_resource_id and s.deleted_at is null
      and public.can_view_baby_sticker(s.id) and public.storage_key_is_canonical(s.storage_path);
  elsif p_kind='profile_avatar' then
    return query select 'profile-media'::text,p.avatar_storage_path,180
      from public.list_visible_profile_display(array[p_resource_id]) p
      where p.avatar_storage_path is not null
      and p.avatar_storage_path=concat('users/',p_resource_id::text,'/',split_part(p.avatar_storage_path,'/',3))
      and public.storage_key_is_canonical(p.avatar_storage_path);
  elsif p_kind='baby_avatar' then
    return query select 'profile-media'::text,b.avatar_storage_path,180
      from babies b where b.id=p_resource_id and b.avatar_storage_path is not null
      and b.avatar_storage_path=concat('babies/',b.id::text,'/',split_part(b.avatar_storage_path,'/',3))
      and public.storage_key_is_canonical(b.avatar_storage_path)
      and (public.is_baby_member(b.id) or public.has_friend_visible_memory(b.id));
  end if;
end;
$$;
revoke all on function public.resolve_private_media_for_signing(text,uuid) from public,anon;
grant execute on function public.resolve_private_media_for_signing(text,uuid) to authenticated;

-- Restrictive policies also cover unexpected permissive policies without
-- silently deleting deployment-specific configuration. Baseline grants remain.
create policy b04b_storage_select on storage.objects as restrictive for select to authenticated
  using (false); -- no native download/sign: short-lived signing is Edge-owned
create policy b04b_storage_insert on storage.objects as restrictive for insert to authenticated
  with check (storage_security.resource_access(bucket_id,name,owner_id,'insert'));
create policy b04b_storage_update on storage.objects as restrictive for update to authenticated
  using (storage_security.resource_access(bucket_id,name,owner_id,'update'))
  with check (storage_security.resource_access(bucket_id,name,owner_id,'update'));
create policy b04b_storage_delete on storage.objects as restrictive for delete to authenticated
  using (storage_security.resource_access(bucket_id,name,owner_id,'delete'));

create function public.media_storage_attachment_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_bucket text := case when tg_table_name='memory_media' then 'memories' else 'diary-media' end;
  v_resource uuid;
  v_owner text;
  v_created timestamptz;
  v_claim public.media_temp_claims%rowtype;
begin
  v_resource := case when tg_table_name='memory_media' then (to_jsonb(new)->>'memory_post_id')::uuid else (to_jsonb(new)->>'diary_entry_id')::uuid end;
  if tg_op='UPDATE' and (new.storage_path is distinct from old.storage_path or new.baby_id is distinct from old.baby_id
    or to_jsonb(new)->'memory_post_id' is distinct from to_jsonb(old)->'memory_post_id'
    or to_jsonb(new)->'diary_entry_id' is distinct from to_jsonb(old)->'diary_entry_id') then
    raise exception 'media storage binding is immutable' using errcode='42501';
  end if;
  if tg_op='INSERT' or new.upload_status='ready' then
    if not public.storage_key_is_canonical(new.storage_path) or split_part(new.storage_path,'/',1)<>new.baby_id::text then
      raise exception 'invalid media storage binding' using errcode='42501';
    end if;
    -- Serialize finalization against parent soft-delete. Whichever obtains the
    -- parent lock first either becomes visible to the delete trigger or sees a
    -- deleted parent and fails closed.
    if tg_table_name='memory_media' then
      perform 1 from memory_posts where id=v_resource and baby_id=new.baby_id and deleted_at is null for share;
    else
      perform 1 from diary_entries where id=v_resource and baby_id=new.baby_id and deleted_at is null for share;
    end if;
    if not found then raise exception 'media parent is deleted or missing' using errcode='42501'; end if;
    -- Lock metadata against concurrent API deletion/claim. No direct metadata
    -- mutation: bytes remain exclusively managed by the Storage API.
    select owner_id,created_at into v_owner,v_created from storage.objects
      where bucket_id=v_bucket and name=new.storage_path for update;
    if not found then raise exception 'upload must complete before attachment' using errcode='23514'; end if;
    if public.is_temp_media_path(new.storage_path) then
      if tg_op='INSERT' then
        if auth.uid() is null or v_owner is distinct from auth.uid()::text or v_created < now()-interval '24 hours' then
          raise exception 'temp uploader ownership or lifetime invalid' using errcode='42501';
        end if;
        insert into media_temp_claims(bucket_id,storage_path,baby_id,resource_id,uploader_id)
        values(v_bucket,new.storage_path,new.baby_id,v_resource,auth.uid()) on conflict do nothing;
      end if;
      select * into v_claim from media_temp_claims where bucket_id=v_bucket and storage_path=new.storage_path for update;
      if not found or v_claim.resource_id<>v_resource or v_claim.baby_id<>new.baby_id then
        raise exception 'temp object already bound or unverified' using errcode='42501';
      end if;
    elsif split_part(new.storage_path,'/',2)<>v_resource::text or array_length(string_to_array(new.storage_path,'/'),1)<>3 then
      raise exception 'final path parent mismatch' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.media_storage_attachment_guard() from public;
create trigger b04b_memory_attachment before insert or update on public.memory_media
  for each row execute function public.media_storage_attachment_guard();
create trigger b04b_diary_attachment before insert or update on public.diary_media
  for each row execute function public.media_storage_attachment_guard();

create function public.growth_media_attachment_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner text;
begin
  if tg_op='UPDATE' and (new.storage_path is distinct from old.storage_path
    or new.growth_book_id is distinct from old.growth_book_id
    or new.page_id is distinct from old.page_id or new.baby_id is distinct from old.baby_id) then
    raise exception 'growth media storage binding is immutable' using errcode='42501';
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
revoke all on function public.growth_media_attachment_guard() from public;
create trigger b04b_growth_attachment before insert or update on public.growth_book_media
  for each row execute function public.growth_media_attachment_guard();

-- The old RPC deleted metadata globally without deleting physical bytes.
-- Preserve call compatibility as a no-op; cleanup requires a separately
-- reviewed Storage-API worker with claim/lease semantics, not SQL DELETE.
create or replace function public.cleanup_orphan_temp_media()
returns integer language sql security definer set search_path=public as $$ select 0; $$;
revoke all on function public.cleanup_orphan_temp_media() from public, anon, authenticated;

update storage.buckets set public=false, allowed_mime_types=array['image/jpeg','image/png','image/heic','image/heif','image/webp']
where id in ('memories','profile-media');
commit;

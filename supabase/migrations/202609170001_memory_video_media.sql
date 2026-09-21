-- Memory video (90s): reuse B0.4b private Storage lifecycle.
-- Does not touch notification_events / B0.4c notification security.
begin;

alter table public.memory_media
  add column if not exists duration_ms integer,
  add column if not exists thumbnail_storage_path text;

alter table public.memory_media drop constraint if exists memory_media_duration_check;
alter table public.memory_media add constraint memory_media_duration_check check (
  duration_ms is null or (duration_ms >= 0 and duration_ms <= 90000)
);

alter table public.memory_media drop constraint if exists memory_media_video_duration_check;
alter table public.memory_media add constraint memory_media_video_duration_check check (
  media_type <> 'video' or duration_ms is not null
);

alter table public.memory_media drop constraint if exists memory_media_thumbnail_path_check;
alter table public.memory_media add constraint memory_media_thumbnail_path_check check (
  thumbnail_storage_path is null
  or (
    thumbnail_storage_path is distinct from storage_path
    and split_part(thumbnail_storage_path, '/', 1) = baby_id::text
    and public.storage_key_is_canonical(thumbnail_storage_path)
  )
);

create or replace function public.storage_key_is_canonical(p_name text)
returns boolean language sql immutable set search_path=public as $$
  select coalesce(length(p_name) between 1 and 512
    and p_name ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*/[A-Za-z0-9_-]+\.(jpg|jpeg|png|heic|heif|webp|mp4|mov|m4v)$',false);
$$;

create or replace function public.media_storage_attachment_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_bucket text := case when tg_table_name='memory_media' then 'memories' else 'diary-media' end;
  v_resource uuid;
  v_owner text;
  v_created timestamptz;
  v_claim public.media_temp_claims%rowtype;
  v_thumb text;
  v_size bigint;
begin
  v_resource := case when tg_table_name='memory_media' then (to_jsonb(new)->>'memory_post_id')::uuid else (to_jsonb(new)->>'diary_entry_id')::uuid end;
  if tg_op='UPDATE' and (new.storage_path is distinct from old.storage_path or new.baby_id is distinct from old.baby_id
    or to_jsonb(new)->'memory_post_id' is distinct from to_jsonb(old)->'memory_post_id'
    or to_jsonb(new)->'diary_entry_id' is distinct from to_jsonb(old)->'diary_entry_id'
    or to_jsonb(new)->>'thumbnail_storage_path' is distinct from to_jsonb(old)->>'thumbnail_storage_path') then
    raise exception 'media storage binding is immutable' using errcode='42501';
  end if;
  if tg_op='INSERT' or new.upload_status='ready' then
    if not public.storage_key_is_canonical(new.storage_path) or split_part(new.storage_path,'/',1)<>new.baby_id::text then
      raise exception 'invalid media storage binding' using errcode='42501';
    end if;
    if tg_table_name='memory_media' and new.media_type='video' then
      if new.duration_ms is null or new.duration_ms < 0 or new.duration_ms > 90000 then
        raise exception 'video duration exceeds limit' using errcode='23514';
      end if;
    end if;
    if tg_table_name='memory_media' then
      perform 1 from memory_posts where id=v_resource and baby_id=new.baby_id and deleted_at is null for share;
    else
      perform 1 from diary_entries where id=v_resource and baby_id=new.baby_id and deleted_at is null for share;
    end if;
    if not found then raise exception 'media parent is deleted or missing' using errcode='42501'; end if;
    select owner_id,created_at,coalesce((metadata->>'size')::bigint,0) into v_owner,v_created,v_size from storage.objects
      where bucket_id=v_bucket and name=new.storage_path for update;
    if not found then raise exception 'upload must complete before attachment' using errcode='23514'; end if;
    if tg_table_name='memory_media' and new.media_type='video' and v_size > 104857600 then
      raise exception 'video exceeds storage size limit' using errcode='23514';
    end if;
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
    v_thumb := to_jsonb(new)->>'thumbnail_storage_path';
    if v_thumb is not null then
      if v_bucket<>'memories' or not public.storage_key_is_canonical(v_thumb)
        or split_part(v_thumb,'/',1)<>new.baby_id::text
        or v_thumb !~* '\.(jpg|jpeg|png|webp)$' then
        raise exception 'invalid media storage binding' using errcode='42501';
      end if;
      select owner_id,created_at into v_owner,v_created from storage.objects
        where bucket_id=v_bucket and name=v_thumb for update;
      if not found then raise exception 'upload must complete before attachment' using errcode='23514'; end if;
      if public.is_temp_media_path(v_thumb) then
        if tg_op='INSERT' then
          if auth.uid() is null or v_owner is distinct from auth.uid()::text or v_created < now()-interval '24 hours' then
            raise exception 'temp uploader ownership or lifetime invalid' using errcode='42501';
          end if;
          insert into media_temp_claims(bucket_id,storage_path,baby_id,resource_id,uploader_id)
          values(v_bucket,v_thumb,new.baby_id,v_resource,auth.uid()) on conflict do nothing;
        end if;
        select * into v_claim from media_temp_claims where bucket_id=v_bucket and storage_path=v_thumb for update;
        if not found or v_claim.resource_id<>v_resource or v_claim.baby_id<>new.baby_id then
          raise exception 'temp object already bound or unverified' using errcode='42501';
        end if;
      elsif split_part(v_thumb,'/',2)<>v_resource::text or array_length(string_to_array(v_thumb,'/'),1)<>3 then
        raise exception 'final path parent mismatch' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_deleted_media()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_bucket text;
  v_thumb text;
begin
  v_bucket := case tg_table_name when 'memory_media' then 'memories' when 'diary_media' then 'diary-media'
    when 'growth_book_media' then 'growth-book-media' when 'baby_stickers' then 'baby-stickers' end;
  if split_part(old.storage_path,'/',1)=old.baby_id::text and storage_key_is_canonical(old.storage_path) then
    perform 1 from storage.objects where bucket_id=v_bucket and name=old.storage_path for update;
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
    values(v_bucket,old.storage_path,auth.uid()) on conflict do nothing;
  end if;
  v_thumb := to_jsonb(old)->>'thumbnail_storage_path';
  if v_thumb is not null and split_part(v_thumb,'/',1)=old.baby_id::text and storage_key_is_canonical(v_thumb) then
    perform 1 from storage.objects where bucket_id=v_bucket and name=v_thumb for update;
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
    values(v_bucket,v_thumb,auth.uid()) on conflict do nothing;
  end if;
  return old;
end;
$$;

create or replace function public.enqueue_soft_deleted_media_parent()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.deleted_at is not null or new.deleted_at is null then return new; end if;
  if tg_table_name='memory_posts' then
    insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
      select 'memories',x.storage_path,auth.uid() from (
        select m.storage_path from memory_media m where m.memory_post_id=old.id
        union select m.thumbnail_storage_path from memory_media m
          where m.memory_post_id=old.id and m.thumbnail_storage_path is not null
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

-- Keep the existing three-column signing RPC during this migration. A later
-- forward migration upgrades its return shape after the baby-scoped capability
-- functions exist. This avoids an incompatible CREATE OR REPLACE return-type
-- change when a fresh database applies 202609200002 in timestamp order.

update storage.buckets
  set public=false,
      file_size_limit=104857600,
      allowed_mime_types=array[
        'image/jpeg','image/png','image/heic','image/heif','image/webp',
        'video/mp4','video/quicktime','video/x-m4v'
      ]
where id='memories';

commit;

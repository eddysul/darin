begin read only;
select jsonb_build_object('buckets', coalesce(jsonb_agg(x), '[]')) from (
  select b.id, b.public, b.file_size_limit, b.allowed_mime_types,
    (select count(*) from storage.objects o where o.bucket_id=b.id) object_count
  from storage.buckets b order by b.id
) x;
select jsonb_build_object('policies', jsonb_agg(x)) from (
  select policyname, roles, cmd, qual, with_check from pg_policies
  where schemaname='storage' and tablename='objects' order by policyname
) x;
with refs as (
  select 'memories' bucket, storage_path path, baby_id::text scope from memory_media
  union all select 'diary-media', storage_path, baby_id::text from diary_media
  union all select 'growth-book-media', storage_path, baby_id::text from growth_book_media
  union all select 'baby-stickers', storage_path, baby_id::text from baby_stickers
  union all select 'profile-media', avatar_storage_path, id::text from profiles where avatar_storage_path is not null
  union all select 'profile-media', avatar_storage_path, id::text from babies where avatar_storage_path is not null
), counts as (
  select b.id bucket,
    (select count(*) from storage.objects o where o.bucket_id=b.id and not exists(select 1 from refs r where r.bucket=o.bucket_id and r.path=o.name)) unreferenced,
    (select count(*) from refs r where r.bucket=b.id and not exists(select 1 from storage.objects o where o.bucket_id=r.bucket and o.name=r.path)) missing_objects,
    (select count(*) from storage.objects o where o.bucket_id=b.id and split_part(o.name,'/',2)='temp' and o.created_at < now()-interval '24 hours' and not exists(select 1 from refs r where r.bucket=o.bucket_id and r.path=o.name)) stale_unreferenced_temp,
    (select count(*) from (select path from refs r where r.bucket=b.id group by path having count(*)>1) d) duplicate_refs,
    (select count(*) from (select path from refs r where r.bucket=b.id group by path having count(distinct scope)>1) d) cross_scope_refs,
    (select count(*) from storage.objects o where o.bucket_id=b.id and (o.name like '%..%' or o.name like '%\%%' or o.name like '%\\%' or o.name like '%//%')) suspicious_paths,
    (select count(*) from storage.objects o where o.bucket_id=b.id and split_part(o.name,'/',2)='temp' and nullif(o.owner_id,'') is null) temp_missing_owner
  from storage.buckets b
)
select jsonb_build_object('inventory',jsonb_agg(counts)) from counts;
select jsonb_build_object('history',jsonb_agg(version)) from supabase_migrations.schema_migrations where version >= '202609140001';
select jsonb_build_object('pathCompatibility',jsonb_agg(x)) from (
  select bucket_id, count(*) filter(where name !~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*/[A-Za-z0-9_-]+\.(jpg|jpeg|png|heic|heif|webp)$') noncanonical,
    count(*) filter(where bucket_id='profile-media' and name !~ '^(users|babies)/[0-9a-f-]{36}/avatar\.(jpg|jpeg|png|heic|heif|webp)$') nonstandard_avatar,
    count(*) filter(where metadata->>'mimetype' not in ('image/jpeg','image/png','image/heic','image/heif','image/webp')) nonimage_metadata
  from storage.objects group by bucket_id
) x;
select jsonb_build_object('readiness', jsonb_build_object(
  'memory_not_ready',(select count(*) from memory_media where upload_status<>'ready'),
  'diary_not_ready',(select count(*) from diary_media where upload_status<>'ready'),
  'linked_temp_missing_owner',(select count(*) from storage.objects o where public.is_temp_media_path(o.name)
    and nullif(o.owner_id,'') is null and (
      exists(select 1 from memory_media m where o.bucket_id='memories' and m.storage_path=o.name)
      or exists(select 1 from diary_media m where o.bucket_id='diary-media' and m.storage_path=o.name)))
));
select jsonb_build_object('storageAuthFKs',coalesce(jsonb_agg(pg_get_constraintdef(c.oid)),'[]'))
from pg_constraint c where c.contype='f' and c.conrelid='storage.objects'::regclass and c.confrelid='auth.users'::regclass;
rollback;

-- Finalize Memory video signing after baby-scoped capability enforcement.
-- The drop/create is intentional: PostgreSQL cannot change a table-returning
-- function's result shape with CREATE OR REPLACE.
begin;

drop function if exists public.resolve_private_media_for_signing(text, uuid);
create function public.resolve_private_media_for_signing(p_kind text,p_resource_id uuid)
returns table(bucket_id text,storage_path text,expires_in integer,thumbnail_storage_path text)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then return; end if;
  if p_kind='memory_media' then
    return query select 'memories'::text,m.storage_path,180,m.thumbnail_storage_path
      from memory_media m where m.id=p_resource_id and m.upload_status='ready'
      and public.can_view_memory_post(m.memory_post_id) and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='diary_media' then
    return query select 'diary-media'::text,m.storage_path,300,null::text
      from diary_media m where m.id=p_resource_id and m.upload_status='ready'
      and public.can_view_diary_entry(m.diary_entry_id) and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='growth_book_media' then
    return query select 'growth-book-media'::text,m.storage_path,300,null::text
      from growth_book_media m where m.id=p_resource_id
      and public.can_view_growth_book(m.growth_book_id) and public.can_view_growth_book_page(m.page_id)
      and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='baby_sticker' then
    return query select 'baby-stickers'::text,s.storage_path,180,null::text
      from baby_stickers s where s.id=p_resource_id and s.deleted_at is null
      and public.can_view_baby_sticker(s.id) and public.storage_key_is_canonical(s.storage_path);
  elsif p_kind='profile_avatar' then
    return query select 'profile-media'::text,p.avatar_storage_path,180,null::text
      from public.list_visible_profile_display(array[p_resource_id]) p
      where p.avatar_storage_path is not null
      and p.avatar_storage_path=concat('users/',p_resource_id::text,'/',split_part(p.avatar_storage_path,'/',3))
      and public.storage_key_is_canonical(p.avatar_storage_path);
  elsif p_kind='baby_avatar' then
    return query select 'profile-media'::text,b.avatar_storage_path,180,null::text
      from babies b where b.id=p_resource_id and b.avatar_storage_path is not null
      and b.avatar_storage_path=concat('babies/',b.id::text,'/',split_part(b.avatar_storage_path,'/',3))
      and public.storage_key_is_canonical(b.avatar_storage_path)
      and (public.has_baby_access(b.id,'care.read') or public.has_baby_access(b.id,'moments.read'));
  end if;
end;
$$;

revoke all on function public.resolve_private_media_for_signing(text,uuid) from public,anon;
grant execute on function public.resolve_private_media_for_signing(text,uuid) to authenticated;

commit;

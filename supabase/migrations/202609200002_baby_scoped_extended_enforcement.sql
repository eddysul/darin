-- G2 follow-up: apply baby capabilities to profile/growth-book/caution/Storage
-- boundaries and make last-admin account deletion compatible with creator-only
-- direct baby deletion. Existing signed URLs remain valid until their bounded
-- expiry; every new signing request is reauthorized here.
begin;

drop policy if exists babies_select_member on public.babies;
create policy babies_select_member on public.babies for select to authenticated
  using (public.has_baby_access(id,'care.read'));
drop policy if exists babies_update_admin_or_editor on public.babies;
create policy babies_update_admin_or_editor on public.babies for update to authenticated
  using (public.current_baby_access_for_write(id,'care.write'))
  with check (public.current_baby_access_for_write(id,'care.write'));

create or replace function public.can_view_growth_book(p_growth_book_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.growth_books b where b.id=p_growth_book_id
    and b.deleted_at is null and public.has_baby_access(b.baby_id,'care.read'));
$$;
create or replace function public.can_edit_growth_book(p_growth_book_id uuid)
returns boolean language sql volatile security definer set search_path=public as $$
  select exists(select 1 from public.growth_books b where b.id=p_growth_book_id
    and b.deleted_at is null and public.current_baby_access_for_write(b.baby_id,'care.write'));
$$;
create or replace function public.can_view_growth_book_page(p_page_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.growth_book_pages p join public.growth_books b on b.id=p.growth_book_id
    where p.id=p_page_id and p.deleted_at is null and b.deleted_at is null and p.baby_id=b.baby_id
      and public.has_baby_access(p.baby_id,'care.read'));
$$;

drop policy if exists baby_caution_foods_select_member on public.baby_caution_foods;
create policy baby_caution_foods_select_member on public.baby_caution_foods for select to authenticated
  using (public.has_baby_access(baby_id,'care.read'));
drop policy if exists baby_caution_foods_insert_member on public.baby_caution_foods;
create policy baby_caution_foods_insert_member on public.baby_caution_foods for insert to authenticated
  with check (created_by=auth.uid() and public.current_baby_access_for_write(baby_id,'care.write'));
drop policy if exists baby_caution_foods_update_member on public.baby_caution_foods;
create policy baby_caution_foods_update_member on public.baby_caution_foods for update to authenticated
  using (public.current_baby_access_for_write(baby_id,'care.write'))
  with check (public.current_baby_access_for_write(baby_id,'care.write'));
drop policy if exists baby_caution_foods_delete_admin on public.baby_caution_foods;
create policy baby_caution_foods_delete_admin on public.baby_caution_foods for delete to authenticated
  using (public.current_baby_admin_for_write(baby_id));

create or replace function storage_security.resource_access(p_bucket text,p_name text,p_owner text,p_action text)
returns boolean language plpgsql volatile security definer set search_path=public as $$
declare v_resource uuid; v_baby uuid; v_ready boolean; v_claim public.media_temp_claims%rowtype;
begin
  if auth.uid() is null or not public.storage_key_is_canonical(p_name)
    or p_action not in ('read','insert','delete','update') then return false; end if;
  if p_bucket in ('memories','diary-media') then
    if p_action='update' then return false; end if;
    if p_bucket='memories' then
      select memory_post_id,baby_id,upload_status='ready' into v_resource,v_baby,v_ready
        from memory_media where storage_path=p_name;
    else
      select diary_entry_id,baby_id,upload_status='ready' into v_resource,v_baby,v_ready
        from diary_media where storage_path=p_name;
    end if;
    if v_resource is not null then
      if split_part(p_name,'/',1)<>v_baby::text then return false; end if;
      if p_action='read' then return coalesce(v_ready and case when p_bucket='memories'
        then can_view_memory_post(v_resource) else can_view_diary_entry(v_resource) end,false); end if;
      if p_action='insert' then return false; end if;
      return coalesce(case when p_bucket='memories' then can_manage_memory_post(v_resource)
        else can_manage_diary_entry(v_resource) end,false);
    end if;
    select * into v_claim from media_temp_claims where bucket_id=p_bucket and storage_path=p_name;
    if found then return p_action='delete' and coalesce(case when p_bucket='memories'
      then can_manage_memory_post(v_claim.resource_id) else can_manage_diary_entry(v_claim.resource_id) end,false); end if;
    if public.is_temp_media_path(p_name) then
      v_baby:=split_part(p_name,'/',1)::uuid;
      return p_owner=auth.uid()::text
        and public.current_baby_access_for_write(v_baby,case when p_bucket='memories' then 'moments.write' else 'care.write' end)
        and (p_action='insert' or exists(select 1 from storage.objects o where o.bucket_id=p_bucket
          and o.name=p_name and o.created_at>now()-interval '24 hours'));
    end if;
    if array_length(string_to_array(p_name,'/'),1)<>3 then return false; end if;
    if p_bucket='memories' then
      select id into v_resource from memory_posts where id::text=split_part(p_name,'/',2)
        and baby_id::text=split_part(p_name,'/',1) and deleted_at is null for share;
    else
      select id into v_resource from diary_entries where id::text=split_part(p_name,'/',2)
        and baby_id::text=split_part(p_name,'/',1) and deleted_at is null for share;
    end if;
    return p_action in ('insert','delete') and coalesce(case when p_bucket='memories'
      then can_manage_memory_post(v_resource) else can_manage_diary_entry(v_resource) end,false);
  elsif p_bucket='profile-media' then
    if array_length(string_to_array(p_name,'/'),1)<>3
      or split_part(p_name,'/',3)!~'^(avatar|[0-9a-f-]{36})\.(jpg|jpeg|png|heic|heif|webp)$' then return false; end if;
    if p_action<>'read' then
      if split_part(p_name,'/',1)='users' then return split_part(p_name,'/',2)=auth.uid()::text; end if;
      if split_part(p_name,'/',1)='babies' then
        return public.current_baby_access_for_write(split_part(p_name,'/',2)::uuid,'care.write');
      end if;
      return false;
    end if;
    if split_part(p_name,'/',1)='users' then
      if split_part(p_name,'/',2)=auth.uid()::text then return true; end if;
      return exists(select 1 from list_visible_profile_display(array(select id from profiles
        where id::text=split_part(p_name,'/',2))) p where p.avatar_storage_path=p_name);
    end if;
    return exists(select 1 from babies b where b.id::text=split_part(p_name,'/',2)
      and b.avatar_storage_path=p_name and (public.has_baby_access(b.id,'care.read')
        or public.has_baby_access(b.id,'moments.read')));
  elsif p_bucket='growth-book-media' then
    if array_length(string_to_array(p_name,'/'),1)<>4 or p_action='update' then return false; end if;
    if p_action='read' then return exists(select 1 from growth_book_media m where m.storage_path=p_name
      and can_view_growth_book(m.growth_book_id) and can_view_growth_book_page(m.page_id)); end if;
    if p_action='insert' then
      select p.id into v_resource from growth_book_pages p join growth_books b on b.id=p.growth_book_id
      where p.baby_id=b.baby_id and b.baby_id::text=split_part(p_name,'/',1)
        and b.id::text=split_part(p_name,'/',2) and p.id::text=split_part(p_name,'/',3)
        and p.deleted_at is null and b.deleted_at is null and can_view_growth_book_page(p.id)
        and public.current_baby_access_for_write(b.baby_id,'care.write') for share of p,b;
      return found;
    end if;
    return exists(select 1 from growth_book_pages p join growth_books b on b.id=p.growth_book_id
      where p.baby_id=b.baby_id and b.baby_id::text=split_part(p_name,'/',1)
        and b.id::text=split_part(p_name,'/',2) and p.id::text=split_part(p_name,'/',3)
        and p.deleted_at is null and b.deleted_at is null and can_view_growth_book_page(p.id)
        and public.current_baby_access_for_write(b.baby_id,'care.write'));
  elsif p_bucket='baby-stickers' then
    if array_length(string_to_array(p_name,'/'),1)<>2 or p_name!~'\.png$' then return false; end if;
    if p_action='read' then return exists(select 1 from baby_stickers s where s.storage_path=p_name
      and can_view_baby_sticker(s.id)); end if;
    return exists(select 1 from babies b where b.id::text=split_part(p_name,'/',1)
      and public.current_baby_access_for_write(b.id,'moments.write'));
  end if;
  return false;
exception when invalid_text_representation then return false;
end;
$$;

create or replace function public.resolve_private_media_for_signing(p_kind text,p_resource_id uuid)
returns table(bucket_id text,storage_path text,expires_in integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then return; end if;
  if p_kind='memory_media' then return query select 'memories'::text,m.storage_path,180
    from memory_media m where m.id=p_resource_id and m.upload_status='ready'
      and public.can_view_memory_post(m.memory_post_id) and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='diary_media' then return query select 'diary-media'::text,m.storage_path,300
    from diary_media m where m.id=p_resource_id and m.upload_status='ready'
      and public.can_view_diary_entry(m.diary_entry_id) and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='growth_book_media' then return query select 'growth-book-media'::text,m.storage_path,300
    from growth_book_media m where m.id=p_resource_id and public.can_view_growth_book(m.growth_book_id)
      and public.can_view_growth_book_page(m.page_id) and public.storage_key_is_canonical(m.storage_path);
  elsif p_kind='baby_sticker' then return query select 'baby-stickers'::text,s.storage_path,180
    from baby_stickers s where s.id=p_resource_id and s.deleted_at is null
      and public.can_view_baby_sticker(s.id) and public.storage_key_is_canonical(s.storage_path);
  elsif p_kind='profile_avatar' then return query select 'profile-media'::text,p.avatar_storage_path,180
    from public.list_visible_profile_display(array[p_resource_id]) p where p.avatar_storage_path is not null
      and p.avatar_storage_path=concat('users/',p_resource_id::text,'/',split_part(p.avatar_storage_path,'/',3))
      and public.storage_key_is_canonical(p.avatar_storage_path);
  elsif p_kind='baby_avatar' then return query select 'profile-media'::text,b.avatar_storage_path,180
    from babies b where b.id=p_resource_id and b.avatar_storage_path is not null
      and b.avatar_storage_path=concat('babies/',b.id::text,'/',split_part(b.avatar_storage_path,'/',3))
      and public.storage_key_is_canonical(b.avatar_storage_path)
      and (public.has_baby_access(b.id,'care.read') or public.has_baby_access(b.id,'moments.read'));
  end if;
end;
$$;

revoke all on function storage_security.resource_access(text,text,text,text) from public,anon;
revoke all on function public.resolve_private_media_for_signing(text,uuid) from public,anon;
grant execute on function storage_security.resource_access(text,text,text,text) to authenticated;
grant execute on function public.resolve_private_media_for_signing(text,uuid) to authenticated;

commit;

-- G2: baby-scoped capability model.
--
-- Relationship labels remain display metadata. Authorization is derived from
-- this table plus a current active baby_members or memory_friends row. Legacy
-- roles are backfilled without broadening their existing access.
begin;

create table if not exists public.baby_access_permissions (
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  care_read boolean not null default false,
  care_write boolean not null default false,
  moments_read boolean not null default false,
  moments_write boolean not null default false,
  social_comment boolean not null default false,
  social_react boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (baby_id, user_id),
  constraint baby_access_care_write_requires_read check (not care_write or care_read),
  constraint baby_access_moments_write_requires_read check (not moments_write or moments_read),
  constraint baby_access_comment_requires_moments check (not social_comment or moments_read),
  constraint baby_access_react_requires_moments check (not social_react or moments_read)
);

create index if not exists baby_access_permissions_user_idx
  on public.baby_access_permissions(user_id, baby_id);

drop trigger if exists baby_access_permissions_set_updated_at on public.baby_access_permissions;
create trigger baby_access_permissions_set_updated_at
  before update on public.baby_access_permissions
  for each row execute function public.set_updated_at();

alter table public.baby_access_permissions enable row level security;
revoke all on table public.baby_access_permissions from public, anon, authenticated;
grant select on table public.baby_access_permissions to authenticated;
grant all on table public.baby_access_permissions to service_role;

create or replace function public.is_current_baby_link(p_baby_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_baby_id is not null and p_user_id is not null and (
    exists (
      select 1 from public.baby_members member_row
      where member_row.baby_id = p_baby_id
        and member_row.user_id = p_user_id
        and member_row.status::text is not distinct from 'active'
    )
    or exists (
      select 1 from public.memory_friends friend_row
      where friend_row.baby_id = p_baby_id
        and friend_row.user_id = p_user_id
        and friend_row.status is not distinct from 'active'
    )
  );
$$;

create or replace function public.is_baby_full_admin(p_baby_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_members member_row
    where member_row.baby_id = p_baby_id
      and member_row.user_id = p_user_id
      and member_row.status::text is not distinct from 'active'
      and member_row.permission_role is not distinct from 'admin'::public.permission_role
  );
$$;

create or replace function public.user_has_baby_access(p_baby_id uuid, p_user_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_user_id is null or p_baby_id is null or p_permission not in (
      'care.read','care.write','moments.read','moments.write','social.comment','social.react'
    ) then false
    when public.is_baby_full_admin(p_baby_id, p_user_id) then true
    when not public.is_current_baby_link(p_baby_id, p_user_id) then false
    else coalesce((
      select case p_permission
        when 'care.read' then access_row.care_read
        when 'care.write' then access_row.care_write
        when 'moments.read' then access_row.moments_read
        when 'moments.write' then access_row.moments_write
        when 'social.comment' then access_row.social_comment
        when 'social.react' then access_row.social_react
        else false
      end
      from public.baby_access_permissions access_row
      where access_row.baby_id = p_baby_id and access_row.user_id = p_user_id
    ), false)
  end;
$$;

create or replace function public.has_baby_access(p_baby_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.user_has_baby_access(p_baby_id,auth.uid(),p_permission);
$$;

create or replace function public.is_current_baby_admin(p_baby_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.is_baby_full_admin(p_baby_id,auth.uid());
$$;

create or replace function public.current_baby_access_for_write(p_baby_id uuid, p_permission text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_role public.permission_role;
  v_linked boolean := false;
  v_access public.baby_access_permissions%rowtype;
begin
  if auth.uid() is null or p_baby_id is null or p_permission not in (
    'care.read','care.write','moments.read','moments.write','social.comment','social.react'
  ) then return false; end if;

  select member_row.permission_role into v_role
  from public.baby_members member_row
  where member_row.baby_id = p_baby_id and member_row.user_id = auth.uid()
    and member_row.status::text is not distinct from 'active'
  for update;
  v_linked := found;
  if v_role is not distinct from 'admin'::public.permission_role then return true; end if;

  if not v_linked then
    perform 1 from public.memory_friends friend_row
    where friend_row.baby_id = p_baby_id and friend_row.user_id = auth.uid()
      and friend_row.status is not distinct from 'active'
    for update;
    v_linked := found;
  end if;
  if not v_linked then return false; end if;

  select * into v_access from public.baby_access_permissions access_row
  where access_row.baby_id = p_baby_id and access_row.user_id = auth.uid()
  for update;
  if not found then return false; end if;
  return case p_permission
    when 'care.read' then v_access.care_read
    when 'care.write' then v_access.care_write
    when 'moments.read' then v_access.moments_read
    when 'moments.write' then v_access.moments_write
    when 'social.comment' then v_access.social_comment
    when 'social.react' then v_access.social_react
    else false
  end;
end;
$$;

create or replace function public.current_baby_admin_for_write(p_baby_id uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or p_baby_id is null then return false; end if;
  perform 1 from public.baby_members member_row
  where member_row.baby_id = p_baby_id and member_row.user_id = auth.uid()
    and member_row.status::text is not distinct from 'active'
    and member_row.permission_role is not distinct from 'admin'::public.permission_role
  for update;
  return found;
end;
$$;

revoke all on function public.is_current_baby_link(uuid,uuid) from public, anon, authenticated;
revoke all on function public.is_baby_full_admin(uuid,uuid) from public, anon, authenticated;
revoke all on function public.user_has_baby_access(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.has_baby_access(uuid,text) from public, anon;
revoke all on function public.is_current_baby_admin(uuid) from public, anon;
revoke all on function public.current_baby_access_for_write(uuid,text) from public, anon;
revoke all on function public.current_baby_admin_for_write(uuid) from public, anon;
grant execute on function public.has_baby_access(uuid,text) to authenticated;
grant execute on function public.is_current_baby_admin(uuid) to authenticated;
grant execute on function public.current_baby_access_for_write(uuid,text) to authenticated;
grant execute on function public.current_baby_admin_for_write(uuid) to authenticated;

drop policy if exists baby_access_permissions_select_self_or_admin on public.baby_access_permissions;
create policy baby_access_permissions_select_self_or_admin on public.baby_access_permissions
  for select to authenticated using (
    user_id = auth.uid() or public.is_current_baby_admin(baby_id)
  );

-- Preserve the effective access of existing active rows. A relationship label
-- is intentionally absent from this backfill.
insert into public.baby_access_permissions (
  baby_id,user_id,care_read,care_write,moments_read,moments_write,
  social_comment,social_react,granted_by
)
select member_row.baby_id, member_row.user_id,
  true,
  member_row.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role),
  true,
  member_row.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role),
  member_row.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role),
  member_row.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role),
  null
from public.baby_members member_row
where member_row.status::text is not distinct from 'active'
on conflict (baby_id,user_id) do update set
  care_read = excluded.care_read,
  care_write = excluded.care_write,
  moments_read = excluded.moments_read,
  moments_write = excluded.moments_write,
  social_comment = excluded.social_comment,
  social_react = excluded.social_react;

insert into public.baby_access_permissions (
  baby_id,user_id,care_read,care_write,moments_read,moments_write,
  social_comment,social_react,granted_by
)
select friend_row.baby_id, friend_row.user_id,
  false,false,true,false,true,true,friend_row.invited_by
from public.memory_friends friend_row
where friend_row.status is not distinct from 'active'
on conflict (baby_id,user_id) do update set
  moments_read = true,
  social_comment = true,
  social_react = true;

create or replace function public.refresh_legacy_baby_access(p_baby_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role public.permission_role; v_friend boolean := false;
begin
  select member_row.permission_role into v_role from public.baby_members member_row
  where member_row.baby_id=p_baby_id and member_row.user_id=p_user_id
    and member_row.status::text is not distinct from 'active';
  select exists(select 1 from public.memory_friends friend_row
    where friend_row.baby_id=p_baby_id and friend_row.user_id=p_user_id
      and friend_row.status is not distinct from 'active') into v_friend;
  if v_role is null and not v_friend then
    delete from public.baby_access_permissions where baby_id=p_baby_id and user_id=p_user_id;
    return;
  end if;
  insert into public.baby_access_permissions(
    baby_id,user_id,care_read,care_write,moments_read,moments_write,
    social_comment,social_react,granted_by
  ) values (
    p_baby_id,p_user_id,
    v_role is not null,
    coalesce(v_role in ('admin'::public.permission_role,'editor'::public.permission_role),false),
    v_role is not null or v_friend,
    coalesce(v_role in ('admin'::public.permission_role,'editor'::public.permission_role),false),
    coalesce(v_role in ('admin'::public.permission_role,'editor'::public.permission_role),false) or v_friend,
    coalesce(v_role in ('admin'::public.permission_role,'editor'::public.permission_role),false) or v_friend,
    auth.uid()
  ) on conflict (baby_id,user_id) do update set
    care_read=excluded.care_read, care_write=excluded.care_write,
    moments_read=excluded.moments_read, moments_write=excluded.moments_write,
    social_comment=excluded.social_comment, social_react=excluded.social_react,
    granted_by=excluded.granted_by;
end;
$$;
revoke all on function public.refresh_legacy_baby_access(uuid,uuid) from public, anon, authenticated;

create or replace function public.baby_access_relation_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_baby uuid:=coalesce(new.baby_id,old.baby_id); v_user uuid:=coalesce(new.user_id,old.user_id);
begin
  -- A legacy role transition is an explicit preset change. Ordinary relation
  -- refreshes must not overwrite capability toggles chosen by an admin.
  if tg_table_name='baby_members' then
    if tg_op='UPDATE' and new.permission_role is distinct from old.permission_role then
      delete from public.baby_access_permissions where baby_id=v_baby and user_id=v_user;
    end if;
  end if;
  if not public.is_current_baby_link(v_baby,v_user) then
    delete from public.baby_access_permissions where baby_id=v_baby and user_id=v_user;
  elsif not exists(select 1 from public.baby_access_permissions a where a.baby_id=v_baby and a.user_id=v_user) then
    perform public.refresh_legacy_baby_access(v_baby,v_user);
  elsif tg_op='INSERT' or (tg_op='UPDATE' and new.status::text is not distinct from 'active'
    and old.status::text is distinct from 'active') then
    if tg_table_name='baby_members' then
      update public.baby_access_permissions set
        care_read=true,
        care_write=care_write or new.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role),
        moments_read=true,
        moments_write=moments_write or new.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role),
        social_comment=social_comment or new.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role),
        social_react=social_react or new.permission_role in ('admin'::public.permission_role,'editor'::public.permission_role)
      where baby_id=v_baby and user_id=v_user;
    else
      update public.baby_access_permissions set moments_read=true,social_comment=true,social_react=true
      where baby_id=v_baby and user_id=v_user;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.baby_access_relation_sync() from public, anon, authenticated;

drop trigger if exists baby_members_access_sync on public.baby_members;
create trigger baby_members_access_sync after insert or delete or update of status,permission_role
  on public.baby_members for each row execute function public.baby_access_relation_sync();
drop trigger if exists memory_friends_access_sync on public.memory_friends;
create trigger memory_friends_access_sync after insert or delete or update of status
  on public.memory_friends for each row execute function public.baby_access_relation_sync();

create or replace function public.baby_admin_transition_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_baby uuid:=coalesce(new.baby_id,old.baby_id); v_user uuid:=coalesce(new.user_id,old.user_id);
begin
  -- Serialize all authority transitions for one baby. Without a shared parent
  -- lock, two concurrent Full Admin departures can each observe the other as
  -- active and commit a zero-admin state.
  perform 1 from public.babies b where b.id=v_baby for update;
  if tg_op <> 'DELETE' and new.permission_role is not distinct from 'admin'::public.permission_role
     and (tg_op='INSERT' or old.permission_role is distinct from 'admin'::public.permission_role) then
    if current_setting('darin.admin_grant_approved',true) is distinct from 'true'
       and not (
         new.user_id=auth.uid()
         and exists(select 1 from public.babies b where b.id=new.baby_id and b.created_by=auth.uid())
         and not exists(select 1 from public.baby_members m where m.baby_id=new.baby_id
           and m.status::text is not distinct from 'active'
           and m.permission_role is not distinct from 'admin'::public.permission_role)
       ) then
      raise exception 'Full Admin requires current admin approval' using errcode='42501';
    end if;
  end if;
  if tg_op='DELETE' and old.status::text is not distinct from 'active'
     and old.permission_role is not distinct from 'admin'::public.permission_role
     and exists(select 1 from public.babies b where b.id=v_baby)
     and not exists(select 1 from public.baby_members m where m.baby_id=v_baby and m.user_id<>v_user
       and m.status::text is not distinct from 'active'
       and m.permission_role is not distinct from 'admin'::public.permission_role) then
    raise exception 'Baby must retain an active Full Admin' using errcode='23514';
  end if;
  if tg_op='UPDATE' and old.status::text is not distinct from 'active'
     and old.permission_role is not distinct from 'admin'::public.permission_role
     and (new.status::text is distinct from 'active' or new.permission_role is distinct from 'admin'::public.permission_role)
     and not exists(select 1 from public.baby_members m where m.baby_id=v_baby and m.user_id<>v_user
       and m.status::text is not distinct from 'active'
       and m.permission_role is not distinct from 'admin'::public.permission_role) then
    raise exception 'Baby must retain an active Full Admin' using errcode='23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.baby_admin_transition_guard() from public, anon, authenticated;
drop trigger if exists baby_members_admin_transition_guard on public.baby_members;
create trigger baby_members_admin_transition_guard before insert or update or delete
  on public.baby_members for each row execute function public.baby_admin_transition_guard();

create or replace function public.set_baby_access_permissions(
  p_baby_id uuid,p_user_id uuid,p_care_read boolean,p_care_write boolean,
  p_moments_read boolean,p_moments_write boolean,p_social_comment boolean,p_social_react boolean
)
returns public.baby_access_permissions language plpgsql security definer set search_path=public as $$
declare v_result public.baby_access_permissions;
begin
  if not public.current_baby_admin_for_write(p_baby_id) then
    raise exception 'Only a current Full Admin may change access' using errcode='42501';
  end if;
  perform 1 from public.baby_members m where m.baby_id=p_baby_id and m.user_id=p_user_id
    and m.status::text is not distinct from 'active' for update;
  if not found then
    perform 1 from public.memory_friends f where f.baby_id=p_baby_id and f.user_id=p_user_id
      and f.status is not distinct from 'active' for update;
    if not found then raise exception 'Target is not currently linked to this baby' using errcode='42501'; end if;
  end if;
  if public.is_baby_full_admin(p_baby_id,p_user_id) then
    raise exception 'Full Admin access cannot be reduced by ordinary toggles' using errcode='42501';
  end if;
  if (p_care_write and not p_care_read) or (p_moments_write and not p_moments_read)
     or ((p_social_comment or p_social_react) and not p_moments_read) then
    raise exception 'Invalid permission dependency' using errcode='23514';
  end if;
  insert into public.baby_access_permissions(
    baby_id,user_id,care_read,care_write,moments_read,moments_write,social_comment,social_react,granted_by
  ) values (p_baby_id,p_user_id,p_care_read,p_care_write,p_moments_read,p_moments_write,p_social_comment,p_social_react,auth.uid())
  on conflict (baby_id,user_id) do update set care_read=excluded.care_read,care_write=excluded.care_write,
    moments_read=excluded.moments_read,moments_write=excluded.moments_write,
    social_comment=excluded.social_comment,social_react=excluded.social_react,granted_by=auth.uid()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.promote_baby_full_admin(p_baby_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.current_baby_admin_for_write(p_baby_id) then
    raise exception 'Only a current Full Admin may approve another Full Admin' using errcode='42501';
  end if;
  perform 1 from public.baby_members m where m.baby_id=p_baby_id and m.user_id=p_user_id
    and m.status::text is not distinct from 'active' for update;
  if not found then raise exception 'Only an active family member can become Full Admin' using errcode='42501'; end if;
  perform set_config('darin.admin_grant_approved','true',true);
  update public.baby_members set permission_role='admin'::public.permission_role
    where baby_id=p_baby_id and user_id=p_user_id and status::text is not distinct from 'active';
  update public.baby_access_permissions set care_read=true,care_write=true,moments_read=true,moments_write=true,
    social_comment=true,social_react=true,granted_by=auth.uid()
    where baby_id=p_baby_id and user_id=p_user_id;
  return true;
end;
$$;
revoke all on function public.set_baby_access_permissions(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon;
revoke all on function public.promote_baby_full_admin(uuid,uuid) from public,anon;
grant execute on function public.set_baby_access_permissions(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.promote_baby_full_admin(uuid,uuid) to authenticated;

-- Care read/write boundaries.
create or replace function public.current_baby_write_permission(p_baby_id uuid)
returns public.permission_role language plpgsql volatile security definer set search_path=public as $$
begin
  if public.current_baby_admin_for_write(p_baby_id) then return 'admin'::public.permission_role; end if;
  if public.current_baby_access_for_write(p_baby_id,'care.write') then return 'editor'::public.permission_role; end if;
  return null;
end;
$$;
create or replace function public.can_edit_care_logs(p_baby_id uuid) returns boolean language sql volatile security definer set search_path=public as $$
  select public.current_baby_access_for_write(p_baby_id,'care.write'); $$;
create or replace function public.can_edit_growth_records(p_baby_id uuid) returns boolean language sql volatile security definer set search_path=public as $$
  select public.current_baby_access_for_write(p_baby_id,'care.write'); $$;

drop policy if exists care_logs_select_member on public.care_logs;
create policy care_logs_select_member on public.care_logs for select to authenticated
  using (public.has_baby_access(baby_id,'care.read'));
drop policy if exists growth_records_select_member on public.growth_records;
create policy growth_records_select_member on public.growth_records for select to authenticated
  using (public.has_baby_access(baby_id,'care.read'));
drop policy if exists diary_entries_select_member on public.diary_entries;
create policy diary_entries_select_member on public.diary_entries for select to authenticated
  using (deleted_at is null and public.has_baby_access(baby_id,'care.read'));

create or replace function public.can_create_diary_entry(p_baby_id uuid) returns boolean language sql volatile security definer set search_path=public as $$
  select public.current_baby_access_for_write(p_baby_id,'care.write'); $$;
create or replace function public.can_view_diary_entry(p_diary_entry_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.diary_entries d where d.id=p_diary_entry_id and d.deleted_at is null
    and public.has_baby_access(d.baby_id,'care.read')); $$;

-- Moments visibility and ownership remain distinct from care access.
create or replace function public.can_manage_memory_post(p_memory_post_id uuid)
returns boolean language plpgsql volatile security definer set search_path=public as $$
declare v_post public.memory_posts; v_admin boolean; v_write boolean;
begin
  select * into v_post from public.memory_posts where id=p_memory_post_id;
  if not found or v_post.deleted_at is not null then return false; end if;
  v_admin:=public.current_baby_admin_for_write(v_post.baby_id);
  v_write:=public.current_baby_access_for_write(v_post.baby_id,'moments.write');
  perform 1 from public.memory_posts where id=p_memory_post_id for update;
  return v_admin or (v_write and v_post.author_id=auth.uid());
end;
$$;
create or replace function public.can_delete_memory_post(p_memory_post_id uuid) returns boolean language sql volatile security definer set search_path=public as $$
  select public.can_manage_memory_post(p_memory_post_id); $$;

create or replace function public.can_view_memory_post(p_memory_post_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.memory_posts post_row where post_row.id=p_memory_post_id and post_row.deleted_at is null
      and public.has_baby_access(post_row.baby_id,'moments.read')
      and (
        (post_row.author_id=auth.uid() and public.has_baby_access(post_row.baby_id,'moments.write'))
        or (post_row.status='published' and (
          (post_row.privacy_type='family_circle' and public.is_baby_member(post_row.baby_id))
          or (post_row.privacy_type='friend_circle' and public.is_current_baby_link(post_row.baby_id,auth.uid()))
          or (post_row.privacy_type='only_me' and post_row.author_id=auth.uid())
          or (post_row.privacy_type='tagged_family' and public.is_active_family_tag_recipient(post_row.id,auth.uid()))
          or (post_row.privacy_type='selected_people' and public.is_active_selected_memory_recipient(post_row.id,auth.uid()))
        ))
      )
  );
$$;

create or replace function public.can_socially_access_memory_post(p_memory_post_id uuid,p_permission text)
returns boolean language plpgsql volatile security definer set search_path=public as $$
declare v_post public.memory_posts; v_allowed boolean;
begin
  if p_permission not in ('social.comment','social.react') then return false; end if;
  select * into v_post from public.memory_posts where id=p_memory_post_id;
  if not found then return false; end if;
  v_allowed:=public.current_baby_access_for_write(v_post.baby_id,p_permission);
  if not v_allowed then return false; end if;
  perform 1 from public.memory_posts where id=p_memory_post_id and status='published' and deleted_at is null for update;
  if not found then return false; end if;
  if v_post.privacy_type='family_circle' then return public.is_baby_member(v_post.baby_id); end if;
  if v_post.privacy_type='friend_circle' then return public.is_current_baby_link(v_post.baby_id,auth.uid()); end if;
  if v_post.privacy_type='only_me' then return v_post.author_id=auth.uid(); end if;
  if v_post.privacy_type='tagged_family' then
    if not public.is_baby_member(v_post.baby_id) then return false; end if;
    perform 1 from public.memory_tags t where t.memory_post_id=v_post.id and t.tag_type='family_member'
      and t.status='approved' and t.tagged_user_id=auth.uid() for update;
    return found;
  end if;
  if v_post.privacy_type='selected_people' then
    perform 1 from public.memory_selected_people s where s.memory_post_id=v_post.id and s.user_id=auth.uid() for update;
    return found;
  end if;
  return false;
end;
$$;
create or replace function public.can_comment_memory_post(p_memory_post_id uuid) returns boolean language sql volatile security definer set search_path=public as $$
  select public.can_socially_access_memory_post(p_memory_post_id,'social.comment'); $$;
create or replace function public.can_react_memory_post(p_memory_post_id uuid) returns boolean language sql volatile security definer set search_path=public as $$
  select public.can_socially_access_memory_post(p_memory_post_id,'social.react'); $$;
create or replace function public.can_interact_with_memory_post(p_memory_post_id uuid) returns boolean language sql volatile security definer set search_path=public as $$
  select public.can_comment_memory_post(p_memory_post_id) or public.can_react_memory_post(p_memory_post_id); $$;

create or replace function public.can_assign_memory_recipient_for_write(
  p_memory_post_id uuid,p_user_id uuid,p_allow_friend boolean
)
returns boolean language plpgsql volatile security definer set search_path=public as $$
declare v_post public.memory_posts; v_write boolean; v_admin boolean;
begin
  if auth.uid() is null or p_user_id is null then return false; end if;
  select * into v_post from public.memory_posts where id=p_memory_post_id;
  if not found or v_post.deleted_at is not null then return false; end if;
  v_admin:=public.current_baby_admin_for_write(v_post.baby_id);
  v_write:=public.current_baby_access_for_write(v_post.baby_id,'moments.write');
  perform 1 from public.memory_posts where id=p_memory_post_id and deleted_at is null for update;
  if not found or not (v_admin or (v_write and v_post.author_id=auth.uid())) then return false; end if;
  perform 1 from public.baby_members m where m.baby_id=v_post.baby_id and m.user_id=p_user_id
    and m.status::text is not distinct from 'active' for update;
  if found then
    if public.is_baby_full_admin(v_post.baby_id,p_user_id) then return true; end if;
    perform 1 from public.baby_access_permissions a where a.baby_id=v_post.baby_id
      and a.user_id=p_user_id and a.moments_read for update;
    return found;
  end if;
  if not p_allow_friend then return false; end if;
  perform 1 from public.memory_friends f where f.baby_id=v_post.baby_id and f.user_id=p_user_id
    and f.status is not distinct from 'active' for update;
  if not found then return false; end if;
  perform 1 from public.baby_access_permissions a where a.baby_id=v_post.baby_id
    and a.user_id=p_user_id and a.moments_read for update;
  return found;
end;
$$;

drop policy if exists memory_posts_select_visible on public.memory_posts;
create policy memory_posts_select_visible on public.memory_posts for select to authenticated
  using (public.can_view_memory_post(id));
drop policy if exists memory_posts_insert_editor on public.memory_posts;
create policy memory_posts_insert_editor on public.memory_posts for insert to authenticated with check (
  author_id=auth.uid() and deleted_at is null and public.current_baby_access_for_write(baby_id,'moments.write')
);
drop policy if exists memory_comments_insert_member on public.memory_comments;
create policy memory_comments_insert_member on public.memory_comments for insert to authenticated with check (
  author_id=auth.uid() and deleted_at is null and public.can_comment_memory_post(memory_post_id)
);
drop policy if exists memory_comments_update_author on public.memory_comments;
create policy memory_comments_update_author on public.memory_comments for update to authenticated
  using (author_id=auth.uid() and deleted_at is null and public.can_comment_memory_post(memory_post_id))
  with check (author_id=auth.uid() and deleted_at is null and public.can_comment_memory_post(memory_post_id));
drop policy if exists memory_comments_delete_author_or_post_owner on public.memory_comments;
create policy memory_comments_delete_author_or_post_owner on public.memory_comments for delete to authenticated
  using ((author_id=auth.uid() and public.can_comment_memory_post(memory_post_id)) or public.can_manage_memory_post(memory_post_id));
drop policy if exists memory_reactions_insert_member on public.memory_reactions;
create policy memory_reactions_insert_member on public.memory_reactions for insert to authenticated with check (
  author_id=auth.uid() and public.can_react_memory_post(memory_post_id)
);
drop policy if exists memory_reactions_update_author on public.memory_reactions;
create policy memory_reactions_update_author on public.memory_reactions for update to authenticated
  using (author_id=auth.uid() and public.can_react_memory_post(memory_post_id))
  with check (author_id=auth.uid() and public.can_react_memory_post(memory_post_id));
drop policy if exists memory_reactions_delete_author on public.memory_reactions;
create policy memory_reactions_delete_author on public.memory_reactions for delete to authenticated
  using (author_id=auth.uid() and public.can_react_memory_post(memory_post_id));

revoke all on function public.can_socially_access_memory_post(uuid,text) from public,anon;
revoke all on function public.can_comment_memory_post(uuid) from public,anon;
revoke all on function public.can_react_memory_post(uuid) from public,anon;
revoke all on function public.can_assign_memory_recipient_for_write(uuid,uuid,boolean) from public,anon;
grant execute on function public.can_socially_access_memory_post(uuid,text) to authenticated;
grant execute on function public.can_comment_memory_post(uuid) to authenticated;
grant execute on function public.can_react_memory_post(uuid) to authenticated;
grant execute on function public.can_assign_memory_recipient_for_write(uuid,uuid,boolean) to authenticated;

commit;

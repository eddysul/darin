-- Complete Invite & Share V1 without granting Darin friends any baby-data access.
-- baby_members: family access; memory_friends: one baby's friend-circle Memories;
-- user_friendships: user-to-user relationship only.

revoke insert, update, delete on public.user_friendships from authenticated;
grant select on public.user_friendships to authenticated;

drop policy if exists user_friendships_insert_requester on public.user_friendships;
drop policy if exists user_friendships_update_related on public.user_friendships;

create or replace function public.create_invite_code(
  p_baby_id uuid,
  p_invite_type text,
  p_role text default 'editor',
  p_relation text default '가족',
  p_expires_at timestamptz default null,
  p_max_uses integer default 1
)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_invite public.invite_codes;
  v_relation public.relationship_label;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_invite_type not in ('family', 'baby_friend', 'darin_friend') then
    raise exception 'invalid invite type' using errcode = '22023';
  end if;
  if p_invite_type <> 'darin_friend'
     and (p_baby_id is null or public.baby_permission(p_baby_id) <> 'admin') then
    raise exception 'only baby admin can create baby invites' using errcode = '42501';
  end if;
  if p_invite_type = 'family' and p_role not in ('admin', 'editor') then
    raise exception 'family role must be admin or editor' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invite expiration must be in the future' using errcode = '22023';
  end if;
  if coalesce(p_max_uses, 1) < 1 then
    raise exception 'max uses must be positive' using errcode = '22023';
  end if;

  begin
    v_relation := coalesce(
      nullif(btrim(p_relation), ''),
      case when p_invite_type = 'family' then '가족' else '친구' end
    )::public.relationship_label;
  exception when invalid_text_representation then
    raise exception 'invalid relationship' using errcode = '22023';
  end;

  loop
    v_code := 'DARIN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.invite_codes (
        baby_id, code, created_by, invite_type, permission_role,
        relationship_label, expires_at, max_uses, used_count
      ) values (
        case when p_invite_type = 'darin_friend' then null else p_baby_id end,
        v_code,
        auth.uid(),
        p_invite_type,
        case when p_invite_type = 'family'
          then p_role::public.permission_role
          else 'viewer'::public.permission_role
        end,
        v_relation,
        p_expires_at,
        p_max_uses,
        0
      ) returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      -- Only a generated-code collision is retried.
    end;
  end loop;
end;
$$;

create or replace function public.accept_invite_code(
  p_code text,
  p_display_name text,
  p_nickname text default null,
  p_relation text default '가족'
)
returns table (baby_id uuid, invite_type text, permission_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invite_codes;
  v_friendship public.user_friendships;
  v_relation public.relationship_label;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'display name required' using errcode = '22023';
  end if;

  select * into v_invite
  from public.invite_codes
  where code = upper(btrim(p_code))
  for update;
  if not found then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  if v_invite.created_by = auth.uid() then raise exception 'cannot accept your own invite' using errcode = '22023'; end if;
  if v_invite.revoked_at is not null then raise exception 'invite revoked' using errcode = '22023'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then raise exception 'invite expired' using errcode = '22023'; end if;
  if v_invite.used_count >= v_invite.max_uses then raise exception 'invite already used' using errcode = '22023'; end if;

  begin
    v_relation := coalesce(nullif(btrim(p_relation), ''), v_invite.relationship_label::text)::public.relationship_label;
  exception when invalid_text_representation then
    raise exception 'invalid relationship' using errcode = '22023';
  end;

  update public.profiles
  set display_name = v_name,
      nickname = nullif(btrim(p_nickname), ''),
      default_relation = case
        when v_invite.invite_type = 'family' then v_relation::text
        else default_relation
      end,
      updated_at = now()
  where id = auth.uid();

  if v_invite.invite_type = 'family' then
    if exists (
      select 1 from public.baby_members bm
      where bm.baby_id = v_invite.baby_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    ) then raise exception 'already connected to this baby' using errcode = '23505'; end if;
    insert into public.baby_members (
      baby_id, user_id, permission_role, relationship_label, status, display_name_override
    ) values (
      v_invite.baby_id, auth.uid(), v_invite.permission_role, v_relation, 'active', v_name
    );
  elsif v_invite.invite_type = 'baby_friend' then
    insert into public.memory_friends (baby_id, user_id, invited_by, status)
    values (v_invite.baby_id, auth.uid(), v_invite.created_by, 'active')
    on conflict on constraint memory_friends_baby_id_user_id_key do update
      set status = 'active', invited_by = excluded.invited_by, updated_at = now();
  else
    select * into v_friendship
    from public.user_friendships
    where (requester_id = v_invite.created_by and receiver_id = auth.uid())
       or (requester_id = auth.uid() and receiver_id = v_invite.created_by)
    for update;

    if found and v_friendship.status = 'blocked' then
      raise exception 'friendship is blocked' using errcode = '42501';
    elsif found then
      update public.user_friendships
      set status = 'accepted', accepted_at = now(), blocked_at = null
      where id = v_friendship.id;
    else
      insert into public.user_friendships (
        requester_id, receiver_id, status, accepted_at
      ) values (
        v_invite.created_by, auth.uid(), 'accepted', now()
      );
    end if;
  end if;

  update public.invite_codes
  set used_count = used_count + 1, used_by = auth.uid(), used_at = now()
  where id = v_invite.id;

  return query select
    v_invite.baby_id,
    v_invite.invite_type,
    case when v_invite.invite_type = 'family'
      then v_invite.permission_role::text
      else v_invite.invite_type
    end;
end;
$$;

create or replace function public.list_my_darin_friends()
returns table (
  friendship_id uuid,
  user_id uuid,
  display_name text,
  nickname text,
  status text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id,
    case when f.requester_id = auth.uid() then f.receiver_id else f.requester_id end,
    coalesce(p.display_name, '다린 친구'),
    p.nickname,
    f.status,
    f.accepted_at
  from public.user_friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.receiver_id else f.requester_id end
  where auth.uid() is not null
    and (f.requester_id = auth.uid() or f.receiver_id = auth.uid())
    and f.status = 'accepted'
  order by f.accepted_at desc nulls last, f.created_at desc;
$$;

create or replace function public.list_baby_memory_friends(p_baby_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  nickname text,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.baby_permission(p_baby_id) <> 'admin' then
    raise exception 'only baby admin can list memory friends' using errcode = '42501';
  end if;
  return query
    select mf.id, mf.user_id, coalesce(p.display_name, '친구'), p.nickname, mf.status
    from public.memory_friends mf
    join public.profiles p on p.id = mf.user_id
    where mf.baby_id = p_baby_id and mf.status = 'active'
    order by mf.created_at;
end;
$$;

create or replace function public.add_darin_friend_to_baby(
  p_baby_id uuid,
  p_friend_user_id uuid
)
returns public.memory_friends
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.memory_friends;
begin
  if auth.uid() is null or public.baby_permission(p_baby_id) <> 'admin' then
    raise exception 'only baby admin can invite memory friends' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.user_friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and receiver_id = p_friend_user_id)
        or (receiver_id = auth.uid() and requester_id = p_friend_user_id))
  ) then
    raise exception 'accepted Darin friendship required' using errcode = '42501';
  end if;

  insert into public.memory_friends (baby_id, user_id, invited_by, status)
  values (p_baby_id, p_friend_user_id, auth.uid(), 'active')
  on conflict (baby_id, user_id) do update
    set invited_by = auth.uid(), status = 'active', updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) from public;
revoke all on function public.accept_invite_code(text, text, text, text) from public;
revoke all on function public.list_my_darin_friends() from public;
revoke all on function public.list_baby_memory_friends(uuid) from public;
revoke all on function public.add_darin_friend_to_baby(uuid, uuid) from public;
grant execute on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.accept_invite_code(text, text, text, text) to authenticated;
grant execute on function public.list_my_darin_friends() to authenticated;
grant execute on function public.list_baby_memory_friends(uuid) to authenticated;
grant execute on function public.add_darin_friend_to_baby(uuid, uuid) to authenticated;

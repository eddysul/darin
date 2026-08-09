-- Avoid collision between the table column and the RPC output column named baby_id.
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
  from public.invite_codes ic
  where ic.code = upper(btrim(p_code))
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

  update public.profiles p
  set display_name = v_name,
      nickname = nullif(btrim(p_nickname), ''),
      default_relation = case
        when v_invite.invite_type = 'family' then v_relation::text
        else p.default_relation
      end,
      updated_at = now()
  where p.id = auth.uid();

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
    from public.user_friendships uf
    where (uf.requester_id = v_invite.created_by and uf.receiver_id = auth.uid())
       or (uf.requester_id = auth.uid() and uf.receiver_id = v_invite.created_by)
    for update;

    if found and v_friendship.status = 'blocked' then
      raise exception 'friendship is blocked' using errcode = '42501';
    elsif found then
      update public.user_friendships uf
      set status = 'accepted', accepted_at = now(), blocked_at = null
      where uf.id = v_friendship.id;
    else
      insert into public.user_friendships (
        requester_id, receiver_id, status, accepted_at
      ) values (
        v_invite.created_by, auth.uid(), 'accepted', now()
      );
    end if;
  end if;

  update public.invite_codes ic
  set used_count = ic.used_count + 1, used_by = auth.uid(), used_at = now()
  where ic.id = v_invite.id;

  return query select
    v_invite.baby_id,
    v_invite.invite_type,
    case when v_invite.invite_type = 'family'
      then v_invite.permission_role::text
      else v_invite.invite_type
    end;
end;
$$;

revoke all on function public.accept_invite_code(text, text, text, text) from public;
grant execute on function public.accept_invite_code(text, text, text, text) to authenticated;

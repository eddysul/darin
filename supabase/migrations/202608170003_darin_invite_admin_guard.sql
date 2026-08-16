-- Build 13: reject callers with no baby membership as well as non-admin members.

create or replace function public.send_darin_id_invite_request(
  p_baby_id uuid,
  p_darin_id text,
  p_request_type text,
  p_role text default 'editor',
  p_relation text default '가족'
)
returns table (request_id uuid, recipient_nickname text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver public.profiles;
  v_request public.darin_invite_requests;
  v_role public.permission_role;
  v_relation public.relationship_label;
begin
  if auth.uid() is null
     or public.baby_permission(p_baby_id) is distinct from 'admin'::public.permission_role then
    raise exception 'only baby admin can send requests' using errcode = '42501';
  end if;
  if p_request_type not in ('family', 'friend') then
    raise exception 'invalid request type' using errcode = '22023';
  end if;

  select * into v_receiver
  from public.profiles
  where lower(darin_id) = lower(btrim(p_darin_id));
  if not found then raise exception 'Darin ID not found' using errcode = 'P0002'; end if;
  if v_receiver.id = auth.uid() then raise exception 'cannot invite yourself' using errcode = '22023'; end if;

  if p_request_type = 'family' then
    if p_role not in ('admin', 'editor') then
      raise exception 'invalid family role' using errcode = '22023';
    end if;
    v_role := p_role::public.permission_role;
    v_relation := coalesce(nullif(btrim(p_relation), ''), '가족')::public.relationship_label;
  else
    v_role := 'viewer';
    v_relation := '친구';
  end if;

  if (p_request_type = 'family' and exists (
    select 1 from public.baby_members
    where baby_id = p_baby_id and user_id = v_receiver.id and status = 'active'
  )) or (p_request_type = 'friend' and exists (
    select 1 from public.memory_friends
    where baby_id = p_baby_id and user_id = v_receiver.id and status = 'active'
  )) then
    raise exception 'already connected' using errcode = '23505';
  end if;

  update public.darin_invite_requests
  set status = 'cancelled', responded_at = now()
  where baby_id = p_baby_id
    and sender_id = auth.uid()
    and receiver_id = v_receiver.id
    and request_type = p_request_type
    and status = 'pending'
    and expires_at <= now();

  if exists (
    select 1 from public.darin_invite_requests
    where baby_id = p_baby_id
      and sender_id = auth.uid()
      and receiver_id = v_receiver.id
      and request_type = p_request_type
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception 'invite request already pending' using errcode = '23505';
  end if;

  insert into public.darin_invite_requests (
    baby_id, sender_id, receiver_id, request_type, permission_role,
    relationship_label, expires_at
  ) values (
    p_baby_id, auth.uid(), v_receiver.id, p_request_type, v_role,
    v_relation, now() + interval '30 days'
  ) returning * into v_request;

  insert into public.notification_events (
    recipient_id, actor_id, baby_id, event_type, title, body, data, dedupe_key, status
  ) values (
    v_receiver.id,
    auth.uid(),
    p_baby_id,
    'invite_request',
    case when p_request_type = 'family' then '가족 초대 요청' else '친구 추가 요청' end,
    (select coalesce(display_name, '돌봄 멤버') from public.profiles where id = auth.uid()) || '님이 요청을 보냈어요.',
    jsonb_build_object(
      'requestId', v_request.id,
      'requestType', p_request_type,
      'requestStatus', 'pending',
      'route', 'family'
    ),
    'darin-invite:' || v_request.id::text,
    'pending'
  );

  return query select v_request.id, v_receiver.display_name;
end;
$$;

revoke all on function public.send_darin_id_invite_request(uuid, text, text, text, text) from public;
grant execute on function public.send_darin_id_invite_request(uuid, text, text, text, text) to authenticated;

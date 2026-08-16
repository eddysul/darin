-- Build 13: keep RPC output names while avoiding PL/pgSQL output-column ambiguity.

create or replace function public.respond_darin_id_invite_request(
  p_request_id uuid,
  p_accept boolean
)
returns table (baby_id uuid, request_type text, permission_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.darin_invite_requests;
  v_response_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select request_row.* into v_request
  from public.darin_invite_requests as request_row
  where request_row.id = p_request_id
    and request_row.receiver_id = auth.uid()
    and request_row.status = 'pending'
  for update;
  if not found then raise exception 'invite request unavailable' using errcode = 'P0002'; end if;
  if v_request.expires_at <= now() then
    raise exception 'invite request expired' using errcode = '22023';
  end if;

  v_response_status := case when p_accept then 'accepted' else 'declined' end;
  if p_accept then
    if v_request.request_type = 'family' then
      insert into public.baby_members (
        baby_id, user_id, permission_role, relationship_label, status, display_name_override
      ) values (
        v_request.baby_id, auth.uid(), v_request.permission_role,
        v_request.relationship_label, 'active', null
      ) on conflict on constraint baby_members_baby_id_user_id_key do update
        set permission_role = excluded.permission_role,
            relationship_label = excluded.relationship_label,
            status = 'active';
    else
      insert into public.memory_friends (baby_id, user_id, invited_by, status)
      values (v_request.baby_id, auth.uid(), v_request.sender_id, 'active')
      on conflict on constraint memory_friends_baby_id_user_id_key do update
        set status = 'active', invited_by = excluded.invited_by;
    end if;

    insert into public.notification_events (
      recipient_id, actor_id, baby_id, event_type, title, body, data, dedupe_key, status
    ) values (
      v_request.sender_id,
      auth.uid(),
      v_request.baby_id,
      'family_joined',
      case when v_request.request_type = 'family' then '가족 초대가 수락됐어요' else '친구 요청이 수락됐어요' end,
      case when v_request.request_type = 'family' then '새 공유 멤버가 연결됐어요.' else '친구 공개 순간을 함께 볼 수 있어요.' end,
      jsonb_build_object('requestId', v_request.id, 'requestType', v_request.request_type, 'route', 'family'),
      'darin-invite-response:' || v_request.id::text,
      'pending'
    ) on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  else
    insert into public.notification_events (
      recipient_id, actor_id, baby_id, event_type, title, body, data, dedupe_key, status
    ) values (
      v_request.sender_id,
      auth.uid(),
      v_request.baby_id,
      'invite_declined',
      '초대 요청이 수락되지 않았어요',
      '필요하면 새 초대를 보낼 수 있어요.',
      jsonb_build_object('requestId', v_request.id, 'requestType', v_request.request_type, 'route', 'family'),
      'darin-invite-response:' || v_request.id::text,
      'pending'
    ) on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  update public.darin_invite_requests as request_row
  set status = v_response_status, responded_at = now()
  where request_row.id = v_request.id;

  update public.notification_events as event_row
  set read_at = now(),
      data = jsonb_set(event_row.data, '{requestStatus}', to_jsonb(v_response_status), true)
  where event_row.recipient_id = auth.uid()
    and event_row.event_type = 'invite_request'
    and event_row.data->>'requestId' = v_request.id::text;

  return query select v_request.baby_id, v_request.request_type, v_request.permission_role::text;
end;
$$;

revoke all on function public.respond_darin_id_invite_request(uuid, boolean) from public;
grant execute on function public.respond_darin_id_invite_request(uuid, boolean) to authenticated;

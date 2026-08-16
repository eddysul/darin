-- Build 13 additive hardening for server-authoritative Darin ID requests.
-- Earlier migrations may already be applied in production; do not rewrite them.

alter table public.darin_invite_requests
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.darin_invite_requests
set expires_at = created_at + interval '30 days'
where expires_at is null;

update public.darin_invite_requests
set updated_at = coalesce(responded_at, created_at, now())
where updated_at is null;

alter table public.darin_invite_requests
  alter column expires_at set default (now() + interval '30 days'),
  alter column expires_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists darin_invite_requests_set_updated_at on public.darin_invite_requests;
create trigger darin_invite_requests_set_updated_at
  before update on public.darin_invite_requests
  for each row execute function public.set_updated_at();

-- Preserve existing rows, but validate every newly assigned Darin ID on the server.
create or replace function public.validate_profile_darin_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  if new.darin_id is null or (tg_op = 'UPDATE' and new.darin_id is not distinct from old.darin_id) then
    return new;
  end if;
  if new.darin_id <> btrim(new.darin_id)
     or new.darin_id !~ '^.{2,12}#[0-9]{4}$'
     or position('/' in new.darin_id) > 0
     or length(new.darin_id) - length(replace(new.darin_id, '#', '')) <> 1 then
    raise exception 'invalid Darin ID format' using errcode = '22023';
  end if;
  v_name := split_part(new.darin_id, '#', 1);
  if char_length(v_name) not between 2 and 12 then
    raise exception 'invalid Darin ID format' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_validate_darin_id on public.profiles;
create trigger profiles_validate_darin_id
  before insert or update of darin_id on public.profiles
  for each row execute function public.validate_profile_darin_id();

drop policy if exists darin_invite_requests_select_related on public.darin_invite_requests;
create policy darin_invite_requests_select_related
  on public.darin_invite_requests
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

grant select on table public.darin_invite_requests to authenticated;
revoke insert, update, delete on table public.darin_invite_requests from authenticated;

alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;
alter table public.notification_events
  add constraint notification_events_event_type_check check (event_type in (
    'memory_comment',
    'memory_reaction',
    'growth_book_comment',
    'growth_book_rolling_paper',
    'family_joined',
    'diary_reminder',
    'invite_request',
    'invite_declined',
    'new_shared_log',
    'new_diary',
    'daily_summary',
    'weekly_summary',
    'reminder',
    'event',
    'test'
  ));

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
  if auth.uid() is null or public.baby_permission(p_baby_id) <> 'admin' then
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

  select * into v_request
  from public.darin_invite_requests
  where id = p_request_id
    and receiver_id = auth.uid()
    and status = 'pending'
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
      ) on conflict (baby_id, user_id) do update
        set permission_role = excluded.permission_role,
            relationship_label = excluded.relationship_label,
            status = 'active';
    else
      insert into public.memory_friends (baby_id, user_id, invited_by, status)
      values (v_request.baby_id, auth.uid(), v_request.sender_id, 'active')
      on conflict (baby_id, user_id) do update
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
    -- Stored directly as an in-app event. The push Edge Function is intentionally not invoked.
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

  update public.darin_invite_requests
  set status = v_response_status, responded_at = now()
  where id = v_request.id;

  update public.notification_events
  set read_at = now(),
      data = jsonb_set(data, '{requestStatus}', to_jsonb(v_response_status), true)
  where recipient_id = auth.uid()
    and event_type = 'invite_request'
    and data->>'requestId' = v_request.id::text;

  return query select v_request.baby_id, v_request.request_type, v_request.permission_role::text;
end;
$$;

revoke all on function public.send_darin_id_invite_request(uuid, text, text, text, text) from public;
revoke all on function public.respond_darin_id_invite_request(uuid, boolean) from public;
grant execute on function public.send_darin_id_invite_request(uuid, text, text, text, text) to authenticated;
grant execute on function public.respond_darin_id_invite_request(uuid, boolean) to authenticated;

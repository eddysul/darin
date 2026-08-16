-- Build 13: server-authoritative Darin ID invitations.
-- Apply through the normal production migration workflow; this does not alter invite-code history.

alter table public.profiles add column if not exists darin_id text;
create unique index if not exists profiles_darin_id_lower_uidx on public.profiles (lower(darin_id)) where darin_id is not null;

create table if not exists public.darin_invite_requests (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('family', 'friend')),
  permission_role public.permission_role not null default 'viewer',
  relationship_label public.relationship_label not null default '친구',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(), responded_at timestamptz,
  check (sender_id <> receiver_id)
);
create unique index if not exists darin_invite_requests_pending_uidx on public.darin_invite_requests (baby_id, sender_id, receiver_id, request_type) where status = 'pending';
create index if not exists darin_invite_requests_receiver_idx on public.darin_invite_requests (receiver_id, status, created_at desc);
alter table public.darin_invite_requests enable row level security;
create policy darin_invite_requests_select_related on public.darin_invite_requests for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());

alter table public.notification_events add column if not exists read_at timestamptz;
alter table public.notification_events drop constraint if exists notification_events_event_type_check;
alter table public.notification_events add constraint notification_events_event_type_check check (event_type in ('memory_comment', 'memory_reaction', 'growth_book_comment', 'growth_book_rolling_paper', 'family_joined', 'diary_reminder', 'invite_request', 'test'));

create or replace function public.send_darin_id_invite_request(p_baby_id uuid, p_darin_id text, p_request_type text, p_role text default 'editor', p_relation text default '가족')
returns table (request_id uuid, recipient_nickname text) language plpgsql security definer set search_path = public as $$
declare v_receiver public.profiles; v_request public.darin_invite_requests; v_role public.permission_role; v_relation public.relationship_label;
begin
  if auth.uid() is null or public.baby_permission(p_baby_id) <> 'admin' then raise exception 'only baby admin can send requests' using errcode = '42501'; end if;
  if p_request_type not in ('family', 'friend') then raise exception 'invalid request type' using errcode = '22023'; end if;
  select * into v_receiver from public.profiles where lower(darin_id) = lower(btrim(p_darin_id));
  if not found then raise exception 'Darin ID not found' using errcode = 'P0002'; end if;
  if v_receiver.id = auth.uid() then raise exception 'cannot invite yourself' using errcode = '22023'; end if;
  if p_request_type = 'family' then
    if p_role not in ('admin', 'editor') then raise exception 'invalid family role' using errcode = '22023'; end if;
    v_role := p_role::public.permission_role; v_relation := coalesce(nullif(btrim(p_relation), ''), '가족')::public.relationship_label;
  else v_role := 'viewer'; v_relation := '친구'; end if;
  if (p_request_type = 'family' and exists (select 1 from public.baby_members where baby_id = p_baby_id and user_id = v_receiver.id and status = 'active')) or (p_request_type = 'friend' and exists (select 1 from public.memory_friends where baby_id = p_baby_id and user_id = v_receiver.id and status = 'active')) then raise exception 'already connected' using errcode = '23505'; end if;
  insert into public.darin_invite_requests (baby_id, sender_id, receiver_id, request_type, permission_role, relationship_label) values (p_baby_id, auth.uid(), v_receiver.id, p_request_type, v_role, v_relation)
  on conflict (baby_id, sender_id, receiver_id, request_type) where status = 'pending' do update set created_at = now(), permission_role = excluded.permission_role, relationship_label = excluded.relationship_label returning * into v_request;
  insert into public.notification_events (recipient_id, actor_id, baby_id, event_type, title, body, data, dedupe_key, status) values (v_receiver.id, auth.uid(), p_baby_id, 'invite_request', case when p_request_type = 'family' then '가족 초대 요청' else '친구 추가 요청' end, (select coalesce(display_name, '돌봄 멤버') from public.profiles where id = auth.uid()) || '님이 요청을 보냈어요.', jsonb_build_object('requestId', v_request.id, 'requestType', p_request_type), 'darin-invite:' || v_request.id::text, 'pending')
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do update set created_at = now(), read_at = null, data = excluded.data, title = excluded.title, body = excluded.body;
  return query select v_request.id, v_receiver.display_name;
end; $$;

create or replace function public.respond_darin_id_invite_request(p_request_id uuid, p_accept boolean)
returns table (baby_id uuid, request_type text, permission_role text) language plpgsql security definer set search_path = public as $$
declare v_request public.darin_invite_requests;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into v_request from public.darin_invite_requests where id = p_request_id and receiver_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'invite request unavailable' using errcode = 'P0002'; end if;
  if p_accept then
    if v_request.request_type = 'family' then
      insert into public.baby_members (baby_id, user_id, permission_role, relationship_label, status, display_name_override) values (v_request.baby_id, auth.uid(), v_request.permission_role, v_request.relationship_label, 'active', null) on conflict (baby_id, user_id) do update set permission_role = excluded.permission_role, relationship_label = excluded.relationship_label, status = 'active';
    else
      insert into public.memory_friends (baby_id, user_id, invited_by, status) values (v_request.baby_id, auth.uid(), v_request.sender_id, 'active') on conflict (baby_id, user_id) do update set status = 'active', invited_by = excluded.invited_by;
    end if;
    update public.darin_invite_requests set status = 'accepted', responded_at = now() where id = v_request.id;
    insert into public.notification_events (recipient_id, actor_id, baby_id, event_type, title, body, data, dedupe_key, status) values (v_request.sender_id, auth.uid(), v_request.baby_id, 'family_joined', '요청이 수락되었어요', '공유 멤버 연결이 완료되었어요.', jsonb_build_object('requestId', v_request.id), 'darin-invite-response:' || v_request.id::text, 'pending') on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  else update public.darin_invite_requests set status = 'declined', responded_at = now() where id = v_request.id; end if;
  update public.notification_events set read_at = now() where recipient_id = auth.uid() and data->>'requestId' = v_request.id::text;
  return query select v_request.baby_id, v_request.request_type, v_request.permission_role::text;
end; $$;

revoke all on function public.send_darin_id_invite_request(uuid, text, text, text, text) from public;
revoke all on function public.respond_darin_id_invite_request(uuid, boolean) from public;
grant execute on function public.send_darin_id_invite_request(uuid, text, text, text, text) to authenticated;
grant execute on function public.respond_darin_id_invite_request(uuid, boolean) to authenticated;

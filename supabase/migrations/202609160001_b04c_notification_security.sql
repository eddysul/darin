-- B0.4c: notification delivery ownership, lifecycle and dispatch hardening.
--
-- Client roles keep read-only access to delivery events. Device-token mutation
-- is routed through authenticated SECURITY DEFINER functions so an account
-- switch can atomically move the physical token without trusting a client
-- supplied user id. Provider dispatch is claimed once before leaving Postgres.

alter table public.notification_events
  add column if not exists dispatch_started_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists expires_at timestamptz not null default (now() + interval '15 minutes'),
  add column if not exists suppression_reason text;

alter table public.push_tokens
  add column if not exists installation_secret_hash text;

-- Legacy rows have no server-verifiable installation proof. Disable them once;
-- the owning signed-in device can safely reactivate through the RPC below.
update public.push_tokens
set disabled_at = coalesce(disabled_at, now())
where installation_secret_hash is null;

alter table public.notification_events
  drop constraint if exists notification_events_status_check;
alter table public.notification_events
  add constraint notification_events_status_check check (
    status in ('pending', 'dispatching', 'sent', 'failed', 'skipped')
  );

alter table public.notification_events
  drop constraint if exists notification_events_attempt_count_check;
alter table public.notification_events
  add constraint notification_events_attempt_count_check check (attempt_count between 0 and 1);

create index if not exists notification_events_dispatch_pending_idx
  on public.notification_events (created_at)
  where status = 'pending';

create or replace function public.register_current_push_token(
  p_device_id text,
  p_expo_push_token text,
  p_platform text,
  p_installation_secret text,
  p_app_version text default null,
  p_build_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token_id uuid;
  v_secret_hash text;
  v_conflict_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_device_id), '') is null
     or length(p_device_id) > 200
     or length(coalesce(p_installation_secret, '')) not between 32 and 256
     or p_expo_push_token !~ '^Expo(nent)?PushToken\[[^]]+\]$'
     or length(p_expo_push_token) > 512
     or p_platform not in ('ios', 'android') then
    raise exception 'invalid push token registration' using errcode = '22023';
  end if;
  v_secret_hash := encode(extensions.digest(p_installation_secret, 'sha256'), 'hex');

  -- Serialize both physical-token and local-device claims. A token may belong
  -- to only the account currently registering it on that device.
  perform pg_advisory_xact_lock(hashtextextended(p_expo_push_token, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_device_id, 1));

  perform 1
  from public.push_tokens
  where (expo_push_token = p_expo_push_token or device_id = p_device_id)
    and user_id <> v_user_id
  for update;

  select count(*) into v_conflict_count
  from public.push_tokens
  where (expo_push_token = p_expo_push_token or device_id = p_device_id)
    and user_id <> v_user_id
    and installation_secret_hash is distinct from v_secret_hash;
  if v_conflict_count > 0 then
    raise exception 'push token ownership conflict' using errcode = '42501';
  end if;

  delete from public.push_tokens
  where (expo_push_token = p_expo_push_token or device_id = p_device_id)
    and user_id <> v_user_id
    and installation_secret_hash = v_secret_hash;

  insert into public.push_tokens (
    user_id, device_id, expo_push_token, platform, app_version, build_number,
    installation_secret_hash, last_seen_at, disabled_at
  ) values (
    v_user_id, p_device_id, p_expo_push_token, p_platform,
    nullif(p_app_version, ''), nullif(p_build_number, ''), v_secret_hash, now(), null
  )
  on conflict (user_id, device_id) do update set
    expo_push_token = excluded.expo_push_token,
    platform = excluded.platform,
    app_version = excluded.app_version,
    build_number = excluded.build_number,
    installation_secret_hash = excluded.installation_secret_hash,
    last_seen_at = now(),
    disabled_at = null
  returning id into v_token_id;

  return v_token_id;
end;
$$;

create or replace function public.unregister_current_push_token(p_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_device_id), '') is null or length(p_device_id) > 200 then
    raise exception 'invalid device id' using errcode = '22023';
  end if;

  update public.push_tokens
  set disabled_at = coalesce(disabled_at, now()), last_seen_at = now()
  where user_id = auth.uid() and device_id = p_device_id;
end;
$$;

create or replace function public.claim_notification_event_dispatch(p_event_id uuid)
returns table (event_id uuid, recipient_id uuid)
language sql
security definer
set search_path = public
as $$
  update public.notification_events
  set status = 'dispatching', dispatch_started_at = now(), attempt_count = 1,
      error_message = null, suppression_reason = null
  where id = p_event_id
    and status = 'pending'
    and attempt_count = 0
    and expires_at > now()
  returning id, notification_events.recipient_id;
$$;

revoke all on function public.register_current_push_token(text, text, text, text, text, text) from public;
revoke all on function public.unregister_current_push_token(text) from public;
revoke all on function public.claim_notification_event_dispatch(uuid) from public;
grant execute on function public.register_current_push_token(text, text, text, text, text, text) to authenticated;
grant execute on function public.unregister_current_push_token(text) to authenticated;
grant execute on function public.claim_notification_event_dispatch(uuid) to service_role;

-- Direct writes would let a client choose lifecycle fields. Authenticated users
-- may inspect only their own rows; registration/revocation use the RPCs above.
revoke insert, update, delete on table public.push_tokens from authenticated;
drop policy if exists push_tokens_insert_own on public.push_tokens;
drop policy if exists push_tokens_update_own on public.push_tokens;
drop policy if exists push_tokens_delete_own on public.push_tokens;

-- Existing notification copy is generic, but resource routes should disappear
-- from the inbox once the underlying authorization is gone.
drop policy if exists notification_events_select_recipient on public.notification_events;
create policy notification_events_select_recipient on public.notification_events
  for select to authenticated
  using (
    recipient_id = auth.uid()
    and (
      baby_id is null
      or event_type in ('invite_request', 'family_joined', 'invite_declined', 'test')
      or (
        event_type in ('memory_comment', 'memory_reaction')
        and case
          when coalesce(data->>'memoryPostId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then public.can_view_memory_post((data->>'memoryPostId')::uuid)
          else false
        end
      )
      or (
        event_type not in ('memory_comment', 'memory_reaction')
        and public.is_baby_member(baby_id)
      )
    )
  );

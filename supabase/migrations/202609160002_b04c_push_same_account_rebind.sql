-- B0.4c rollout repair: a TestFlight replacement may retain its Expo token
-- while receiving a new local device ID. Rebind only the authenticated user's
-- existing token row; cross-account reassignment still requires the same
-- installation proof. Keep the implementation in a private RPC and expose
-- the existing client signature through a thin wrapper.
create or replace function public.register_current_push_token_v2(
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

  -- A unique Expo token can belong to this same account under an older local
  -- device ID. Remove only that row before the (user, device) upsert.
  delete from public.push_tokens
  where expo_push_token = p_expo_push_token
    and user_id = v_user_id
    and device_id <> p_device_id;

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

revoke all on function public.register_current_push_token_v2(text, text, text, text, text, text) from public;
revoke all on function public.register_current_push_token_v2(text, text, text, text, text, text) from authenticated;

create or replace function public.register_current_push_token(
  p_device_id text,
  p_expo_push_token text,
  p_platform text,
  p_installation_secret text,
  p_app_version text default null,
  p_build_number text default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.register_current_push_token_v2($1, $2, $3, $4, $5, $6);
$$;

revoke all on function public.register_current_push_token(text, text, text, text, text, text) from public;
grant execute on function public.register_current_push_token(text, text, text, text, text, text) to authenticated;

-- 202609160001 replaces the public registration function during final
-- cutover. Restore the 202609160002 proof-bound same-account rebind wrapper
-- in the same atomic deployment transaction as that cutover.
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

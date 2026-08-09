-- Remote hotfix: generate invite codes without depending on pgcrypto's
-- gen_random_bytes visibility under search_path=public.
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
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_invite_type not in ('family', 'baby_friend', 'darin_friend') then raise exception 'invalid invite type' using errcode = '22023'; end if;
  if p_invite_type <> 'darin_friend' and (p_baby_id is null or public.baby_permission(p_baby_id) <> 'admin') then
    raise exception 'only baby admin can create baby invites' using errcode = '42501';
  end if;
  if p_invite_type = 'family' and p_role not in ('admin', 'editor') then raise exception 'family role must be admin or editor' using errcode = '22023'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'invite expiration must be in the future' using errcode = '22023'; end if;
  if coalesce(p_max_uses, 1) < 1 then raise exception 'max uses must be positive' using errcode = '22023'; end if;
  begin
    v_relation := coalesce(nullif(btrim(p_relation), ''), case when p_invite_type = 'family' then '가족' else '친구' end)::public.relationship_label;
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
        v_code, auth.uid(), p_invite_type,
        case when p_invite_type = 'family' then p_role::public.permission_role else 'viewer'::public.permission_role end,
        v_relation, p_expires_at, p_max_uses, 0
      ) returning * into v_invite;
      return v_invite;
    exception when unique_violation then end;
  end loop;
end;
$$;

revoke all on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) from public;
grant execute on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) to authenticated;

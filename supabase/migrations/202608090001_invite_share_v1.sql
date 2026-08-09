-- Invite & Share V1: server-authoritative family and Memories-only friend invites.
-- This migration intentionally never adds a friend to baby_members.

alter table public.invite_codes
  add column if not exists invite_type text not null default 'family'
    check (invite_type in ('family', 'friend')),
  add column if not exists max_uses integer not null default 1 check (max_uses > 0),
  add column if not exists used_count integer not null default 0 check (used_count >= 0),
  add column if not exists revoked_at timestamptz;

update public.invite_codes
set used_count = case when used_at is null then 0 else 1 end
where used_count is null;

create index if not exists invite_codes_active_code_idx
  on public.invite_codes (code)
  where revoked_at is null;

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
begin
  if auth.uid() is null or public.baby_permission(p_baby_id) <> 'admin' then
    raise exception 'only baby admin can create invites' using errcode = '42501';
  end if;
  if p_invite_type not in ('family', 'friend') then
    raise exception 'invalid invite type' using errcode = '22023';
  end if;
  if p_invite_type = 'family' and p_role not in ('admin', 'editor') then
    raise exception 'family invite role must be admin or editor' using errcode = '22023';
  end if;
  if p_invite_type = 'friend' then p_role := 'friend'; p_relation := coalesce(nullif(btrim(p_relation), ''), '친구'); end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invite expiration must be in the future' using errcode = '22023';
  end if;

  loop
    v_code := 'DARIN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.invite_codes (
        baby_id, code, created_by, invite_type, permission_role, relationship_label,
        expires_at, max_uses, used_count
      ) values (
        p_baby_id, v_code, auth.uid(), p_invite_type,
        case when p_invite_type = 'family' then p_role::public.permission_role else 'viewer'::public.permission_role end,
        p_relation::public.relationship_label, p_expires_at, greatest(coalesce(p_max_uses, 1), 1), 0
      ) returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      -- Regenerate only if the randomly generated code collided.
    end;
  end loop;
end;
$$;

create or replace function public.preview_invite_code(p_code text)
returns table (
  baby_id uuid, baby_name text, inviter_name text, invite_type text,
  role text, relation text, expires_at timestamptz, max_uses integer,
  used_count integer, is_valid boolean, invalid_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.baby_id, b.name, coalesce(p.display_name, '가족'), i.invite_type,
    case when i.invite_type = 'friend' then 'friend' else i.permission_role::text end,
    i.relationship_label::text, i.expires_at, i.max_uses, i.used_count,
    (i.revoked_at is null and (i.expires_at is null or i.expires_at > now()) and i.used_count < i.max_uses) as is_valid,
    case when i.revoked_at is not null then 'revoked'
      when i.expires_at is not null and i.expires_at <= now() then 'expired'
      when i.used_count >= i.max_uses then 'used'
      else null end
  from public.invite_codes i
  join public.babies b on b.id = i.baby_id
  left join public.profiles p on p.id = i.created_by
  where i.code = upper(btrim(p_code));
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
  v_name text := btrim(coalesce(p_display_name, ''));
  v_relation public.relationship_label;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if v_name = '' then raise exception 'display name required' using errcode = '22023'; end if;
  select * into v_invite from public.invite_codes where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  if v_invite.revoked_at is not null then raise exception 'invite revoked' using errcode = '22023'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then raise exception 'invite expired' using errcode = '22023'; end if;
  if v_invite.used_count >= v_invite.max_uses then raise exception 'invite already used' using errcode = '22023'; end if;
  begin v_relation := coalesce(nullif(btrim(p_relation), ''), v_invite.relationship_label::text)::public.relationship_label;
  exception when invalid_text_representation then raise exception 'invalid relationship' using errcode = '22023'; end;

  update public.profiles set display_name = v_name, nickname = nullif(btrim(p_nickname), ''), default_relation = v_relation::text
  where id = auth.uid();

  if v_invite.invite_type = 'family' then
    if exists (select 1 from public.baby_members where baby_id = v_invite.baby_id and user_id = auth.uid() and status = 'active') then
      raise exception 'already connected to this baby' using errcode = '23505';
    end if;
    insert into public.baby_members (baby_id, user_id, permission_role, relationship_label, status, display_name_override)
    values (v_invite.baby_id, auth.uid(), v_invite.permission_role, v_relation, 'active', v_name);
  else
    if exists (select 1 from public.memory_friends where baby_id = v_invite.baby_id and user_id = auth.uid() and status = 'active') then
      raise exception 'already connected as friend' using errcode = '23505';
    end if;
    insert into public.memory_friends (baby_id, user_id, invited_by, status)
    values (v_invite.baby_id, auth.uid(), v_invite.created_by, 'active')
    on conflict (baby_id, user_id) do update set status = 'active', invited_by = excluded.invited_by;
  end if;

  update public.invite_codes
  set used_count = used_count + 1,
      used_by = auth.uid(),
      used_at = now()
  where id = v_invite.id;

  return query select v_invite.baby_id, v_invite.invite_type,
    case when v_invite.invite_type = 'friend' then 'friend' else v_invite.permission_role::text end;
end;
$$;

revoke all on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) from public;
revoke all on function public.preview_invite_code(text) from public;
revoke all on function public.accept_invite_code(text, text, text, text) from public;
grant execute on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.preview_invite_code(text) to authenticated;
grant execute on function public.accept_invite_code(text, text, text, text) to authenticated;

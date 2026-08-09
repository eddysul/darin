-- Darin friendships are user-to-user only. They never grant baby data access.
alter table public.invite_codes drop constraint if exists invite_codes_invite_type_check;
alter table public.invite_codes alter column baby_id drop not null;
update public.invite_codes set invite_type = 'baby_friend' where invite_type = 'friend';
alter table public.invite_codes add constraint invite_codes_invite_type_check
  check (invite_type in ('family', 'baby_friend', 'darin_friend'));

create table if not exists public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked','declined')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  blocked_at timestamptz,
  check (requester_id <> receiver_id)
);
create unique index if not exists user_friendships_pair_idx
  on public.user_friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id));
alter table public.user_friendships enable row level security;
create policy user_friendships_select_related on public.user_friendships for select to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid());
create policy user_friendships_insert_requester on public.user_friendships for insert to authenticated
  with check (requester_id = auth.uid() and receiver_id <> auth.uid());
create policy user_friendships_update_related on public.user_friendships for update to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid())
  with check (requester_id = auth.uid() or receiver_id = auth.uid());

create or replace function public.create_invite_code(
  p_baby_id uuid, p_invite_type text, p_role text default 'editor', p_relation text default '가족',
  p_expires_at timestamptz default null, p_max_uses integer default 1
) returns public.invite_codes language plpgsql security definer set search_path = public as $$
declare v_code text; v_invite public.invite_codes;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_invite_type not in ('family','baby_friend','darin_friend') then raise exception 'invalid invite type' using errcode = '22023'; end if;
  if p_invite_type <> 'darin_friend' and (p_baby_id is null or public.baby_permission(p_baby_id) <> 'admin') then raise exception 'only baby admin can create baby invites' using errcode = '42501'; end if;
  if p_invite_type = 'family' and p_role not in ('admin','editor') then raise exception 'family role must be admin or editor' using errcode = '22023'; end if;
  loop
    v_code := 'DARIN-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10));
    begin
      insert into public.invite_codes (baby_id,code,created_by,invite_type,permission_role,relationship_label,expires_at,max_uses,used_count)
      values (case when p_invite_type = 'darin_friend' then null else p_baby_id end, v_code, auth.uid(), p_invite_type,
        case when p_invite_type='family' then p_role::public.permission_role else 'viewer'::public.permission_role end,
        coalesce(nullif(btrim(p_relation),''),case when p_invite_type='darin_friend' then '친구' else '가족' end)::public.relationship_label,
        p_expires_at,greatest(coalesce(p_max_uses,1),1),0) returning * into v_invite;
      return v_invite;
    exception when unique_violation then end;
  end loop;
end; $$;

create or replace function public.accept_invite_code(p_code text,p_display_name text,p_nickname text default null,p_relation text default '가족')
returns table (baby_id uuid, invite_type text, permission_role text) language plpgsql security definer set search_path = public as $$
declare v public.invite_codes; v_relation public.relationship_label; v_name text:=btrim(coalesce(p_display_name,''));
begin
  if auth.uid() is null or v_name='' then raise exception 'authenticated display name required' using errcode='42501'; end if;
  select * into v from public.invite_codes where code=upper(btrim(p_code)) for update;
  if not found then raise exception 'invalid invite code' using errcode='P0002'; end if;
  if v.revoked_at is not null or (v.expires_at is not null and v.expires_at<=now()) or v.used_count>=v.max_uses then raise exception 'invite unavailable' using errcode='22023'; end if;
  v_relation:=coalesce(nullif(btrim(p_relation),''),v.relationship_label::text)::public.relationship_label;
  update public.profiles set display_name=v_name,nickname=nullif(btrim(p_nickname),''),default_relation=v_relation::text where id=auth.uid();
  if v.invite_type='family' then
    if exists(select 1 from public.baby_members where baby_id=v.baby_id and user_id=auth.uid() and status='active') then raise exception 'already connected' using errcode='23505'; end if;
    insert into public.baby_members(baby_id,user_id,permission_role,relationship_label,status,display_name_override) values(v.baby_id,auth.uid(),v.permission_role,v_relation,'active',v_name);
  elsif v.invite_type='baby_friend' then
    if exists(select 1 from public.memory_friends where baby_id=v.baby_id and user_id=auth.uid() and status='active') then raise exception 'already connected' using errcode='23505'; end if;
    insert into public.memory_friends(baby_id,user_id,invited_by,status) values(v.baby_id,auth.uid(),v.created_by,'active') on conflict(baby_id,user_id) do update set status='active',invited_by=excluded.invited_by;
  else
    insert into public.user_friendships(requester_id,receiver_id,status,accepted_at) values(v.created_by,auth.uid(),'accepted',now())
    on conflict ((least(requester_id,receiver_id)),(greatest(requester_id,receiver_id))) do update set status='accepted',accepted_at=now(),blocked_at=null;
  end if;
  update public.invite_codes set used_count=used_count+1,used_by=auth.uid(),used_at=now() where id=v.id;
  return query select v.baby_id,v.invite_type,case when v.invite_type='family' then v.permission_role::text else v.invite_type end;
end; $$;
grant select,insert,update,delete on public.user_friendships to authenticated;

create or replace function public.preview_invite_code(p_code text)
returns table (baby_id uuid,baby_name text,inviter_name text,invite_type text,role text,relation text,expires_at timestamptz,max_uses integer,used_count integer,is_valid boolean,invalid_reason text)
language sql stable security definer set search_path=public as $$
  select i.baby_id, b.name, coalesce(p.display_name,'다린 사용자'), i.invite_type,
    case when i.invite_type='family' then i.permission_role::text else i.invite_type end,
    i.relationship_label::text,i.expires_at,i.max_uses,i.used_count,
    (i.revoked_at is null and (i.expires_at is null or i.expires_at>now()) and i.used_count<i.max_uses),
    case when i.revoked_at is not null then 'revoked' when i.expires_at is not null and i.expires_at<=now() then 'expired' when i.used_count>=i.max_uses then 'used' else null end
  from public.invite_codes i left join public.babies b on b.id=i.baby_id left join public.profiles p on p.id=i.created_by
  where i.code=upper(btrim(p_code));
$$;
revoke all on function public.preview_invite_code(text) from public;
grant execute on function public.preview_invite_code(text) to authenticated;

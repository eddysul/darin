-- B0.4a P0 authorization hotfix.
--
-- 1. Fail closed when baby_permission returns NULL for a non-member, and
--    revalidate the issuer before accepting an outstanding baby invite.
-- 2. Bind every memory_media row to a post from the same baby. The new
--    composite FK is NOT VALID so existing inconsistent rows do not block the
--    migration, while all new inserts/updates are enforced immediately.

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
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_invite_type not in ('family', 'baby_friend', 'darin_friend') then
    raise exception 'invalid invite type' using errcode = '22023';
  end if;
  if p_invite_type <> 'darin_friend'
     and (
       p_baby_id is null
       or public.baby_permission(p_baby_id)
          is distinct from 'admin'::public.permission_role
     ) then
    raise exception 'only baby admin can create baby invites' using errcode = '42501';
  end if;
  if p_invite_type = 'family' and p_role not in ('admin', 'editor') then
    raise exception 'family role must be admin or editor' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invite expiration must be in the future' using errcode = '22023';
  end if;
  if coalesce(p_max_uses, 1) < 1 then
    raise exception 'max uses must be positive' using errcode = '22023';
  end if;

  begin
    v_relation := coalesce(
      nullif(btrim(p_relation), ''),
      case when p_invite_type = 'family' then '가족' else '친구' end
    )::public.relationship_label;
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
        v_code,
        auth.uid(),
        p_invite_type,
        case when p_invite_type = 'family'
          then p_role::public.permission_role
          else 'viewer'::public.permission_role
        end,
        v_relation,
        p_expires_at,
        p_max_uses,
        0
      ) returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      -- Only a generated-code collision is retried.
    end;
  end loop;
end;
$$;

create or replace function public.list_baby_memory_friends(p_baby_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  nickname text,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or public.baby_permission(p_baby_id)
        is distinct from 'admin'::public.permission_role then
    raise exception 'only baby admin can list memory friends' using errcode = '42501';
  end if;

  return query
    select mf.id, mf.user_id, coalesce(p.display_name, '친구'), p.nickname, mf.status
    from public.memory_friends mf
    join public.profiles p on p.id = mf.user_id
    where mf.baby_id = p_baby_id and mf.status = 'active'
    order by mf.created_at;
end;
$$;

create or replace function public.add_darin_friend_to_baby(
  p_baby_id uuid,
  p_friend_user_id uuid
)
returns public.memory_friends
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memory_friends;
begin
  if auth.uid() is null
     or public.baby_permission(p_baby_id)
        is distinct from 'admin'::public.permission_role then
    raise exception 'only baby admin can invite memory friends' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.user_friendships uf
    where uf.status = 'accepted'
      and (
        (uf.requester_id = auth.uid() and uf.receiver_id = p_friend_user_id)
        or (uf.receiver_id = auth.uid() and uf.requester_id = p_friend_user_id)
      )
  ) then
    raise exception 'accepted Darin friendship required' using errcode = '42501';
  end if;

  insert into public.memory_friends (baby_id, user_id, invited_by, status)
  values (p_baby_id, p_friend_user_id, auth.uid(), 'active')
  on conflict (baby_id, user_id) do update
    set invited_by = auth.uid(), status = 'active', updated_at = now()
  returning * into v_row;

  return v_row;
end;
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
  v_friendship public.user_friendships;
  v_relation public.relationship_label;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'display name required' using errcode = '22023';
  end if;

  select * into v_invite
  from public.invite_codes ic
  where ic.code = upper(btrim(p_code))
  for update;
  if not found then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  if v_invite.created_by = auth.uid() then raise exception 'cannot accept your own invite' using errcode = '22023'; end if;
  if v_invite.revoked_at is not null then raise exception 'invite revoked' using errcode = '22023'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then raise exception 'invite expired' using errcode = '22023'; end if;
  if v_invite.used_count >= v_invite.max_uses then raise exception 'invite already used' using errcode = '22023'; end if;

  -- Bearer invite codes cannot outlive the issuer's authority. This also makes
  -- any code forged through the former NULL fail-open guard unusable.
  if v_invite.invite_type in ('family', 'baby_friend') then
    if v_invite.baby_id is null or v_invite.created_by is null then
      raise exception 'invite issuer no longer has permission' using errcode = '42501';
    end if;

    -- Hold the issuer membership row through the grant. A concurrent removal
    -- or demotion must not race between authorization and membership insert.
    perform 1
    from public.baby_members issuer
    where issuer.baby_id = v_invite.baby_id
      and issuer.user_id = v_invite.created_by
      and issuer.status = 'active'
      and issuer.permission_role = 'admin'::public.permission_role
    for update;
    if not found then
      raise exception 'invite issuer no longer has permission' using errcode = '42501';
    end if;
  end if;

  begin
    v_relation := coalesce(
      nullif(btrim(p_relation), ''),
      v_invite.relationship_label::text
    )::public.relationship_label;
  exception when invalid_text_representation then
    raise exception 'invalid relationship' using errcode = '22023';
  end;

  update public.profiles p
  set display_name = v_name,
      nickname = nullif(btrim(p_nickname), ''),
      default_relation = case
        when v_invite.invite_type = 'family' then v_relation::text
        else p.default_relation
      end,
      updated_at = now()
  where p.id = auth.uid();

  if v_invite.invite_type = 'family' then
    if exists (
      select 1 from public.baby_members bm
      where bm.baby_id = v_invite.baby_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    ) then raise exception 'already connected to this baby' using errcode = '23505'; end if;

    insert into public.baby_members (
      baby_id, user_id, permission_role, relationship_label, status, display_name_override
    ) values (
      v_invite.baby_id, auth.uid(), v_invite.permission_role, v_relation, 'active', v_name
    );
  elsif v_invite.invite_type = 'baby_friend' then
    insert into public.memory_friends (baby_id, user_id, invited_by, status)
    values (v_invite.baby_id, auth.uid(), v_invite.created_by, 'active')
    on conflict on constraint memory_friends_baby_id_user_id_key do update
      set status = 'active', invited_by = excluded.invited_by, updated_at = now();
  else
    select * into v_friendship
    from public.user_friendships uf
    where (uf.requester_id = v_invite.created_by and uf.receiver_id = auth.uid())
       or (uf.requester_id = auth.uid() and uf.receiver_id = v_invite.created_by)
    for update;

    if found and v_friendship.status = 'blocked' then
      raise exception 'friendship is blocked' using errcode = '42501';
    elsif found then
      update public.user_friendships uf
      set status = 'accepted', accepted_at = now(), blocked_at = null
      where uf.id = v_friendship.id;
    else
      insert into public.user_friendships (
        requester_id, receiver_id, status, accepted_at
      ) values (
        v_invite.created_by, auth.uid(), 'accepted', now()
      );
    end if;
  end if;

  update public.invite_codes ic
  set used_count = ic.used_count + 1, used_by = auth.uid(), used_at = now()
  where ic.id = v_invite.id;

  return query select
    v_invite.baby_id,
    v_invite.invite_type,
    case when v_invite.invite_type = 'family'
      then v_invite.permission_role::text
      else v_invite.invite_type
    end;
end;
$$;

revoke all on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) from public;
revoke all on function public.accept_invite_code(text, text, text, text) from public;
revoke all on function public.list_baby_memory_friends(uuid) from public;
revoke all on function public.add_darin_friend_to_baby(uuid, uuid) from public;
grant execute on function public.create_invite_code(uuid, text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.accept_invite_code(text, text, text, text) to authenticated;
grant execute on function public.list_baby_memory_friends(uuid) to authenticated;
grant execute on function public.add_darin_friend_to_baby(uuid, uuid) to authenticated;

-- Hide any historical mismatched row immediately and reject new mismatches at
-- both RLS and relational-integrity boundaries.
create unique index if not exists memory_posts_id_baby_id_uidx
  on public.memory_posts (id, baby_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.memory_media'::regclass
      and c.conname = 'memory_media_post_baby_fkey'
  ) then
    alter table public.memory_media
      add constraint memory_media_post_baby_fkey
      foreign key (memory_post_id, baby_id)
      references public.memory_posts (id, baby_id)
      on delete cascade
      not valid;
  end if;
end;
$$;

drop policy if exists memory_media_select_visible on public.memory_media;
create policy memory_media_select_visible on public.memory_media
  for select to authenticated
  using (
    public.can_view_memory_post(memory_media.memory_post_id)
    and exists (
      select 1
      from public.memory_posts parent_post
      where parent_post.id = memory_media.memory_post_id
        and parent_post.baby_id = memory_media.baby_id
    )
  );

drop policy if exists memory_media_insert_manager on public.memory_media;
create policy memory_media_insert_manager on public.memory_media
  for insert to authenticated
  with check (
    public.can_manage_memory_post(memory_media.memory_post_id)
    and exists (
      select 1
      from public.memory_posts parent_post
      where parent_post.id = memory_media.memory_post_id
        and parent_post.baby_id = memory_media.baby_id
    )
  );

drop policy if exists memory_media_update_manager on public.memory_media;
create policy memory_media_update_manager on public.memory_media
  for update to authenticated
  using (
    public.can_manage_memory_post(memory_media.memory_post_id)
    and exists (
      select 1
      from public.memory_posts parent_post
      where parent_post.id = memory_media.memory_post_id
        and parent_post.baby_id = memory_media.baby_id
    )
  )
  with check (
    public.can_manage_memory_post(memory_media.memory_post_id)
    and exists (
      select 1
      from public.memory_posts parent_post
      where parent_post.id = memory_media.memory_post_id
        and parent_post.baby_id = memory_media.baby_id
    )
  );

drop policy if exists memory_media_delete_manager on public.memory_media;
create policy memory_media_delete_manager on public.memory_media
  for delete to authenticated
  using (
    public.can_manage_memory_post(memory_media.memory_post_id)
    and exists (
      select 1
      from public.memory_posts parent_post
      where parent_post.id = memory_media.memory_post_id
        and parent_post.baby_id = memory_media.baby_id
    )
  );

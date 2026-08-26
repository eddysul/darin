-- Friend-only Memories entry point and least-privilege profile media access.
-- Friends remain outside baby_members and receive no access to care/diary/growth data.

create index if not exists memory_posts_friend_visible_idx
  on public.memory_posts (baby_id, created_at desc)
  where privacy_type = 'friend_circle' and status = 'published' and deleted_at is null;

create or replace function public.can_view_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts p
    where p.id = p_memory_post_id
      and p.deleted_at is null
      and (
        p.author_id = auth.uid()
        or (p.privacy_type = 'family_circle' and public.is_baby_member(p.baby_id))
        or (p.privacy_type = 'friend_circle' and (public.is_baby_member(p.baby_id) or public.is_memory_friend(p.baby_id)))
        or (
          p.privacy_type = 'tagged_family'
          and exists (
            select 1 from public.memory_tags t
            where t.memory_post_id = p.id and t.tag_type = 'family_member'
              and t.status = 'approved' and t.tagged_user_id = auth.uid()
          )
        )
        or (
          p.privacy_type = 'selected_people'
          and exists (
            select 1 from public.memory_selected_people s
            where s.memory_post_id = p.id and s.user_id = auth.uid()
          )
        )
      )
  );
$$;

revoke all on function public.can_view_memory_post(uuid) from public;
grant execute on function public.can_view_memory_post(uuid) to authenticated;

drop policy if exists memory_tags_select_visible on public.memory_tags;
create policy memory_tags_select_visible on public.memory_tags
  for select to authenticated
  using (
    public.can_view_memory_post(memory_post_id)
    and (
      tag_type = 'baby'
      or exists (
        select 1 from public.memory_posts mp
        where mp.id = memory_tags.memory_post_id
          and (public.is_baby_member(mp.baby_id) or mp.author_id = auth.uid())
      )
    )
  );

create or replace function public.has_friend_visible_memory(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_friends mf
    join public.memory_posts mp on mp.baby_id = mf.baby_id
    where mf.baby_id = p_baby_id
      and mf.user_id = auth.uid()
      and mf.status = 'active'
      and mp.privacy_type = 'friend_circle'
      and mp.status = 'published'
      and mp.deleted_at is null
  );
$$;

create or replace function public.is_friend_visible_memory_contributor(p_baby_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_friend_visible_memory(p_baby_id) and (
    exists (
      select 1 from public.memory_posts mp
      where mp.baby_id = p_baby_id
        and mp.author_id = p_user_id
        and mp.privacy_type = 'friend_circle'
        and mp.status = 'published'
        and mp.deleted_at is null
    )
    or exists (
      select 1
      from public.memory_comments mc
      join public.memory_posts mp on mp.id = mc.memory_post_id
      where mp.baby_id = p_baby_id
        and mp.privacy_type = 'friend_circle'
        and mp.status = 'published'
        and mp.deleted_at is null
        and mc.author_id = p_user_id
        and mc.deleted_at is null
    )
    or exists (
      select 1
      from public.memory_reactions mr
      join public.memory_posts mp on mp.id = mr.memory_post_id
      where mp.baby_id = p_baby_id
        and mp.privacy_type = 'friend_circle'
        and mp.status = 'published'
        and mp.deleted_at is null
        and mr.author_id = p_user_id
    )
  );
$$;

create or replace function public.list_my_friend_memory_contexts()
returns table (
  baby_id uuid,
  baby_name text,
  avatar_storage_path text,
  latest_post_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name,
    case when count(mp.id) > 0 then b.avatar_storage_path else null end,
    max(mp.created_at)
  from public.memory_friends mf
  join public.babies b on b.id = mf.baby_id
  left join public.memory_posts mp
    on mp.baby_id = b.id
   and mp.privacy_type = 'friend_circle'
   and mp.status = 'published'
   and mp.deleted_at is null
  where mf.user_id = auth.uid()
    and mf.status = 'active'
  group by b.id, b.name, b.avatar_storage_path
  order by max(mp.created_at) desc nulls last, b.name;
$$;

revoke all on function public.has_friend_visible_memory(uuid) from public;
revoke all on function public.is_friend_visible_memory_contributor(uuid, uuid) from public;
revoke all on function public.list_my_friend_memory_contexts() from public;
grant execute on function public.has_friend_visible_memory(uuid) to authenticated;
grant execute on function public.is_friend_visible_memory_contributor(uuid, uuid) to authenticated;
grant execute on function public.list_my_friend_memory_contexts() to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_own_or_shared on public.profiles;
create policy profiles_select_own_or_shared on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.baby_members me
      join public.baby_members them on them.baby_id = me.baby_id and them.status = 'active'
      where me.user_id = auth.uid() and me.status = 'active' and them.user_id = profiles.id
    )
    or exists (
      select 1 from public.memory_friends mf
      where mf.user_id = auth.uid()
        and mf.status = 'active'
        and public.is_friend_visible_memory_contributor(mf.baby_id, profiles.id)
    )
  );

create or replace function public.can_read_profile_media_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) = 'users' then (
      split_part(object_name, '/', 2) = auth.uid()::text
      or exists (
        select 1 from public.baby_members me
        join public.baby_members them on them.baby_id = me.baby_id and them.status = 'active'
        where me.user_id = auth.uid() and me.status = 'active'
          and them.user_id::text = split_part(object_name, '/', 2)
      )
      or exists (
        select 1 from public.memory_friends mf
        where mf.user_id = auth.uid() and mf.status = 'active'
          and public.is_friend_visible_memory_contributor(
            mf.baby_id, split_part(object_name, '/', 2)::uuid
          )
      )
    )
    when split_part(object_name, '/', 1) = 'babies' then (
      public.is_baby_member(split_part(object_name, '/', 2)::uuid)
      or public.has_friend_visible_memory(split_part(object_name, '/', 2)::uuid)
    )
    else false
  end;
$$;

revoke all on function public.can_read_profile_media_object(text) from public;
grant execute on function public.can_read_profile_media_object(text) to authenticated;

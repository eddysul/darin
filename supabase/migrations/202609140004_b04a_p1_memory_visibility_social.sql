-- B0.4a-3: Memory publication, visibility, tag/grant, and social boundaries.
--
-- Shared content is visible only after publication and only while the caller's
-- relevant family/friend relationship remains current. Draft/failed content is
-- visible only to its current admin/editor author. Direct child-table access is
-- always revalidated through the parent post.

create or replace function public.is_current_memory_friend_for_write(p_baby_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_found boolean := false;
begin
  if auth.uid() is null or p_baby_id is null then
    return false;
  end if;

  select true
  into v_found
  from public.memory_friends as friend_row
  where friend_row.baby_id = p_baby_id
    and friend_row.user_id = auth.uid()
    and friend_row.status is not distinct from 'active'
  for update;

  return coalesce(v_found, false);
end;
$$;

create or replace function public.is_active_family_tag_recipient(
  p_memory_post_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts as post_row
    join public.memory_tags as tag_row
      on tag_row.memory_post_id = post_row.id
    join public.baby_members as member_row
      on member_row.baby_id = post_row.baby_id
     and member_row.user_id = tag_row.tagged_user_id
     and member_row.status::text is not distinct from 'active'
    where post_row.id = p_memory_post_id
      and tag_row.tag_type = 'family_member'
      and tag_row.status = 'approved'
      and tag_row.tagged_user_id = p_user_id
  );
$$;

create or replace function public.is_active_selected_memory_recipient(
  p_memory_post_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts as post_row
    join public.memory_selected_people as selected_row
      on selected_row.memory_post_id = post_row.id
     and selected_row.user_id = p_user_id
    where post_row.id = p_memory_post_id
      and (
        exists (
          select 1
          from public.baby_members as member_row
          where member_row.baby_id = post_row.baby_id
            and member_row.user_id = p_user_id
            and member_row.status::text is not distinct from 'active'
        )
        or exists (
          select 1
          from public.memory_friends as friend_row
          where friend_row.baby_id = post_row.baby_id
            and friend_row.user_id = p_user_id
            and friend_row.status is not distinct from 'active'
        )
      )
  );
$$;

revoke all on function public.is_current_memory_friend_for_write(uuid) from public;
revoke all on function public.is_active_family_tag_recipient(uuid, uuid) from public;
revoke all on function public.is_active_selected_memory_recipient(uuid, uuid) from public;
grant execute on function public.is_current_memory_friend_for_write(uuid) to authenticated;
grant execute on function public.is_active_family_tag_recipient(uuid, uuid) to authenticated;
grant execute on function public.is_active_selected_memory_recipient(uuid, uuid) to authenticated;

create or replace function public.can_view_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts as post_row
    where post_row.id = p_memory_post_id
      and post_row.deleted_at is null
      and (
        (
          post_row.author_id = auth.uid()
          and public.baby_permission(post_row.baby_id)
            in ('admin'::public.permission_role, 'editor'::public.permission_role)
        )
        or (
          post_row.status = 'published'
          and (
            (
              post_row.privacy_type = 'family_circle'
              and public.is_baby_member(post_row.baby_id)
            )
            or (
              post_row.privacy_type = 'friend_circle'
              and (
                public.is_baby_member(post_row.baby_id)
                or public.is_memory_friend(post_row.baby_id)
              )
            )
            or (
              post_row.privacy_type = 'only_me'
              and post_row.author_id = auth.uid()
              and public.baby_permission(post_row.baby_id)
                in ('admin'::public.permission_role, 'editor'::public.permission_role)
            )
            or (
              post_row.privacy_type = 'tagged_family'
              and public.is_active_family_tag_recipient(post_row.id, auth.uid())
            )
            or (
              post_row.privacy_type = 'selected_people'
              and public.is_active_selected_memory_recipient(post_row.id, auth.uid())
            )
          )
        )
      )
  );
$$;

create or replace function public.can_interact_with_memory_post(p_memory_post_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_initial_baby_id uuid;
  v_post public.memory_posts;
  v_permission public.permission_role;
  v_is_friend boolean := false;
begin
  if auth.uid() is null or p_memory_post_id is null then
    return false;
  end if;

  -- Lock order for every social write:
  -- caller membership/friend row -> parent post -> tag/selected entitlement.
  -- Post managers already lock their own membership before changing the post,
  -- so this order also avoids reversing membership/post locks.
  select post_row.baby_id
  into v_initial_baby_id
  from public.memory_posts as post_row
  where post_row.id = p_memory_post_id;
  if not found then
    return false;
  end if;

  v_permission := public.current_baby_write_permission(v_initial_baby_id);
  v_is_friend := public.is_current_memory_friend_for_write(v_initial_baby_id);

  select post_row.*
  into v_post
  from public.memory_posts as post_row
  where post_row.id = p_memory_post_id
  for update;
  if not found
     or v_post.baby_id is distinct from v_initial_baby_id
     or v_post.status is distinct from 'published'
     or v_post.deleted_at is not null then
    return false;
  end if;

  if v_post.author_id = auth.uid()
     and v_permission in ('admin'::public.permission_role, 'editor'::public.permission_role) then
    return true;
  end if;

  if v_post.privacy_type = 'family_circle' then
    return v_permission in ('admin'::public.permission_role, 'editor'::public.permission_role);
  end if;

  if v_post.privacy_type = 'friend_circle' then
    return v_permission in ('admin'::public.permission_role, 'editor'::public.permission_role)
      or v_is_friend;
  end if;

  if v_post.privacy_type = 'only_me' then
    return v_post.author_id = auth.uid()
      and v_permission in ('admin'::public.permission_role, 'editor'::public.permission_role);
  end if;

  if v_post.privacy_type = 'tagged_family' then
    if v_permission not in ('admin'::public.permission_role, 'editor'::public.permission_role) then
      return false;
    end if;
    perform 1
    from public.memory_tags as tag_row
    where tag_row.memory_post_id = v_post.id
      and tag_row.tag_type = 'family_member'
      and tag_row.status = 'approved'
      and tag_row.tagged_user_id = auth.uid()
    for update;
    return found;
  end if;

  if v_post.privacy_type = 'selected_people' then
    if v_permission not in ('admin'::public.permission_role, 'editor'::public.permission_role)
       and not v_is_friend then
      return false;
    end if;
    perform 1
    from public.memory_selected_people as selected_row
    where selected_row.memory_post_id = v_post.id
      and selected_row.user_id = auth.uid()
    for update;
    return found;
  end if;

  return false;
end;
$$;

revoke all on function public.can_view_memory_post(uuid) from public;
revoke all on function public.can_interact_with_memory_post(uuid) from public;
grant execute on function public.can_view_memory_post(uuid) to authenticated;
grant execute on function public.can_interact_with_memory_post(uuid) to authenticated;

drop policy if exists memory_posts_select_visible on public.memory_posts;
create policy memory_posts_select_visible on public.memory_posts
  for select to authenticated
  using (public.can_view_memory_post(id));

drop policy if exists memory_tags_insert_manager on public.memory_tags;
create policy memory_tags_insert_manager on public.memory_tags
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_manage_memory_post(memory_post_id)
    and (
      (
        tag_type = 'baby'
        and baby_id is not null
        and public.is_baby_member(baby_id)
      )
      or (
        tag_type = 'family_member'
        and tagged_user_id is not null
        and exists (
          select 1
          from public.memory_posts as parent_post
          join public.baby_members as recipient
            on recipient.baby_id = parent_post.baby_id
           and recipient.user_id = memory_tags.tagged_user_id
           and recipient.status::text is not distinct from 'active'
          where parent_post.id = memory_tags.memory_post_id
        )
      )
      or tag_type in ('friend_baby', 'manual_guest')
    )
  );

drop policy if exists memory_tags_select_visible on public.memory_tags;
create policy memory_tags_select_visible on public.memory_tags
  for select to authenticated
  using (
    public.can_view_memory_post(memory_post_id)
    and (
      tag_type = 'baby'
      or exists (
        select 1
        from public.memory_posts as parent_post
        where parent_post.id = memory_tags.memory_post_id
          and (
            public.is_baby_member(parent_post.baby_id)
            or public.can_manage_memory_post(parent_post.id)
          )
      )
    )
  );

drop policy if exists memory_selected_people_insert_manager on public.memory_selected_people;
create policy memory_selected_people_insert_manager on public.memory_selected_people
  for insert to authenticated
  with check (
    public.can_manage_memory_post(memory_post_id)
    and exists (
      select 1
      from public.memory_posts as parent_post
      where parent_post.id = memory_selected_people.memory_post_id
        and (
          exists (
            select 1
            from public.baby_members as recipient
            where recipient.baby_id = parent_post.baby_id
              and recipient.user_id = memory_selected_people.user_id
              and recipient.status::text is not distinct from 'active'
          )
          or exists (
            select 1
            from public.memory_friends as recipient_friend
            where recipient_friend.baby_id = parent_post.baby_id
              and recipient_friend.user_id = memory_selected_people.user_id
              and recipient_friend.status is not distinct from 'active'
          )
        )
    )
  );

drop policy if exists memory_comments_insert_member on public.memory_comments;
create policy memory_comments_insert_member on public.memory_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and public.can_interact_with_memory_post(memory_post_id)
    and (
      (comment_type = 'text' and sticker_id is null)
      or (
        comment_type = 'sticker'
        and public.can_use_baby_sticker_on_post(sticker_id, memory_post_id)
      )
    )
  );

drop policy if exists memory_comments_update_author on public.memory_comments;
create policy memory_comments_update_author on public.memory_comments
  for update to authenticated
  using (
    author_id = auth.uid()
    and deleted_at is null
    and public.can_interact_with_memory_post(memory_post_id)
  )
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and public.can_interact_with_memory_post(memory_post_id)
  );

drop policy if exists memory_comments_delete_author_or_post_owner on public.memory_comments;
create policy memory_comments_delete_author_or_post_owner on public.memory_comments
  for delete to authenticated
  using (
    (
      author_id = auth.uid()
      and public.can_interact_with_memory_post(memory_post_id)
    )
    or public.can_delete_memory_post(memory_post_id)
  );

drop policy if exists memory_reactions_insert_member on public.memory_reactions;
create policy memory_reactions_insert_member on public.memory_reactions
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_interact_with_memory_post(memory_post_id)
  );

drop policy if exists memory_reactions_update_author on public.memory_reactions;
create policy memory_reactions_update_author on public.memory_reactions
  for update to authenticated
  using (
    author_id = auth.uid()
    and public.can_interact_with_memory_post(memory_post_id)
  )
  with check (
    author_id = auth.uid()
    and public.can_interact_with_memory_post(memory_post_id)
  );

drop policy if exists memory_reactions_delete_author on public.memory_reactions;
create policy memory_reactions_delete_author on public.memory_reactions
  for delete to authenticated
  using (
    author_id = auth.uid()
    and public.can_interact_with_memory_post(memory_post_id)
  );

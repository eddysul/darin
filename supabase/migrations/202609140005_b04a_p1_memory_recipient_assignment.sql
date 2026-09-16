-- B0.4a-3 follow-up: validate tag/selected recipients through a locked,
-- RLS-independent current-authority boundary.

create or replace function public.can_assign_memory_recipient_for_write(
  p_memory_post_id uuid,
  p_user_id uuid,
  p_allow_friend boolean
)
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
begin
  if auth.uid() is null or p_user_id is null then
    return false;
  end if;

  select post_row.baby_id
    into v_initial_baby_id
  from public.memory_posts as post_row
  where post_row.id = p_memory_post_id;

  if v_initial_baby_id is null then
    return false;
  end if;

  -- Lock caller authority before the parent and recipient relation rows.
  v_permission := public.current_baby_write_permission(v_initial_baby_id);

  select post_row.*
    into v_post
  from public.memory_posts as post_row
  where post_row.id = p_memory_post_id
  for update;

  if not found
     or v_post.baby_id <> v_initial_baby_id
     or v_post.deleted_at is not null
     or not (
       v_permission is not distinct from 'admin'::public.permission_role
       or (
         v_permission is not distinct from 'editor'::public.permission_role
         and v_post.author_id = auth.uid()
       )
     ) then
    return false;
  end if;

  perform 1
  from public.baby_members as recipient
  where recipient.baby_id = v_post.baby_id
    and recipient.user_id = p_user_id
    and recipient.status::text is not distinct from 'active'
  for update;

  if found then
    return true;
  end if;

  if not p_allow_friend then
    return false;
  end if;

  perform 1
  from public.memory_friends as recipient_friend
  where recipient_friend.baby_id = v_post.baby_id
    and recipient_friend.user_id = p_user_id
    and recipient_friend.status is not distinct from 'active'
  for update;

  return found;
end;
$$;

revoke all on function public.can_assign_memory_recipient_for_write(uuid, uuid, boolean) from public;
grant execute on function public.can_assign_memory_recipient_for_write(uuid, uuid, boolean) to authenticated;

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
        and public.can_assign_memory_recipient_for_write(
          memory_post_id,
          tagged_user_id,
          false
        )
      )
      or tag_type in ('friend_baby', 'manual_guest')
    )
  );

drop policy if exists memory_selected_people_insert_manager on public.memory_selected_people;
create policy memory_selected_people_insert_manager on public.memory_selected_people
  for insert to authenticated
  with check (
    public.can_assign_memory_recipient_for_write(
      memory_post_id,
      user_id,
      true
    )
  );

-- B0.4a final authorization batch (profile projection + baby profile fields).
-- Friend-visible profile data is returned only through the explicit display
-- projection below.  The base profile row remains self-only.

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_own_or_shared on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create or replace function public.list_visible_profile_display(p_user_ids uuid[])
returns table (
  user_id uuid,
  display_name text,
  nickname text,
  avatar_storage_path text,
  default_relation text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile_row.id,
    profile_row.display_name,
    profile_row.nickname,
    profile_row.avatar_storage_path,
    profile_row.default_relation
  from public.profiles as profile_row
  where profile_row.id = any(coalesce(p_user_ids, '{}'::uuid[]))
    and (
      profile_row.id = auth.uid()
      or exists (
        select 1
        from public.baby_members as me
        join public.baby_members as them
          on them.baby_id = me.baby_id
         and them.status = 'active'
         and them.user_id = profile_row.id
        where me.user_id = auth.uid()
          and me.status = 'active'
      )
      or exists (
        select 1
        from public.memory_friends as friend_row
        join public.baby_members as member_row
          on member_row.baby_id = friend_row.baby_id
         and member_row.status = 'active'
         and member_row.user_id = profile_row.id
        where friend_row.user_id = auth.uid()
          and friend_row.status = 'active'
          and public.is_friend_visible_memory_contributor(friend_row.baby_id, profile_row.id)
      )
    );
$$;

revoke all on function public.list_visible_profile_display(uuid[]) from public;
grant execute on function public.list_visible_profile_display(uuid[]) to authenticated;

create or replace function public.baby_profile_identity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'baby identity columns are immutable' using errcode = '42501';
  end if;

  -- Account deletion anonymizes the creator through the profile FK's internal
  -- SET NULL update.  Internal FK actions run at trigger depth > 1; direct
  -- client writes, including self-anonymization, remain forbidden.
  if new.created_by is distinct from old.created_by
     and not (new.created_by is null and pg_trigger_depth() > 1) then
    raise exception 'baby identity columns are immutable' using errcode = '42501';
  end if;

  -- Editors may maintain presentation fields only.  Birth/clinical and
  -- lifecycle fields remain administrator-owned authorization state.
  if public.baby_permission(old.id) is distinct from 'admin'::public.permission_role
     and (
       new.birth_date is distinct from old.birth_date
       or new.due_date is distinct from old.due_date
       or new.child_status is distinct from old.child_status
       or new.gender is distinct from old.gender
       or new.gestational_age_weeks is distinct from old.gestational_age_weeks
       or new.birth_weight is distinct from old.birth_weight
     ) then
    raise exception 'only baby admin can change protected profile fields' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The existing account-deletion RPC anonymizes shared-baby creators before
-- auth.users deletion.  Let the profile FK perform that SET NULL transition
-- instead, so the trigger can distinguish trusted FK cleanup from direct SQL.
create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.babies as baby_row
  where exists (
    select 1 from public.baby_members as own_membership
    where own_membership.baby_id = baby_row.id
      and own_membership.user_id = v_user_id
  )
  and not exists (
    select 1 from public.baby_members as other_membership
    where other_membership.baby_id = baby_row.id
      and other_membership.user_id <> v_user_id
      and other_membership.status = 'active'
  );

  update public.care_logs set created_by = null where created_by = v_user_id;
  update public.growth_records set created_by = null where created_by = v_user_id;
  update public.invite_codes set created_by = null where created_by = v_user_id;
  update public.invite_codes set used_by = null where used_by = v_user_id;
  update public.notification_events set actor_id = null where actor_id = v_user_id;
  update public.contact_requests set user_id = null where user_id = v_user_id;

  delete from public.push_tokens where user_id = v_user_id;
  delete from public.notification_settings where user_id = v_user_id;
  delete from public.notification_events where recipient_id = v_user_id;
  delete from public.baby_members where user_id = v_user_id;
end;
$$;
revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;

drop trigger if exists babies_profile_identity_guard on public.babies;
create trigger babies_profile_identity_guard
  before update on public.babies
  for each row execute function public.baby_profile_identity_guard();

drop policy if exists babies_update_admin on public.babies;
drop policy if exists babies_update_admin_or_editor on public.babies;
create policy babies_update_admin_or_editor on public.babies
  for update to authenticated
  using (public.baby_permission(id) in ('admin'::public.permission_role, 'editor'::public.permission_role))
  with check (public.baby_permission(id) in ('admin'::public.permission_role, 'editor'::public.permission_role));

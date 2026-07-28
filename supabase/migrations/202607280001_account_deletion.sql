-- Secure self-service account deletion support.
-- Shared baby data remains available to other active members; babies with no
-- other active member are removed together with their dependent records.

alter table public.growth_records
  alter column created_by drop not null;

alter table public.growth_records
  drop constraint if exists growth_records_created_by_fkey;

alter table public.growth_records
  add constraint growth_records_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

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

  -- A baby that has no other active member belongs only to the deleting user.
  -- Deleting it cascades to logs, growth records, invites and memberships.
  delete from public.babies b
  where exists (
    select 1
    from public.baby_members own_membership
    where own_membership.baby_id = b.id
      and own_membership.user_id = v_user_id
  )
  and not exists (
    select 1
    from public.baby_members other_membership
    where other_membership.baby_id = b.id
      and other_membership.user_id <> v_user_id
      and other_membership.status = 'active'
  );

  -- Preserve shared family records while removing the departing user's identity.
  update public.babies set created_by = null where created_by = v_user_id;
  update public.care_logs set created_by = null where created_by = v_user_id;
  update public.growth_records set created_by = null where created_by = v_user_id;
  update public.invite_codes set created_by = null where created_by = v_user_id;
  update public.invite_codes set used_by = null where used_by = v_user_id;

  delete from public.baby_members where user_id = v_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;

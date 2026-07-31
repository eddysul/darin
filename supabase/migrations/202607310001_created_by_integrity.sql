-- Preserve server-side authorship integrity for member-editable records.
-- Account deletion remains compatible because prepare_account_deletion() is a
-- security-definer function and table owners bypass RLS.

create or replace function public.care_log_creator_unchanged(
  p_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_logs record
    where record.id = p_id
      and record.created_by is not distinct from p_created_by
  );
$$;

create or replace function public.growth_record_creator_unchanged(
  p_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.growth_records record
    where record.id = p_id
      and record.created_by is not distinct from p_created_by
  );
$$;

revoke all on function public.care_log_creator_unchanged(uuid, uuid) from public;
revoke all on function public.growth_record_creator_unchanged(uuid, uuid) from public;
grant execute on function public.care_log_creator_unchanged(uuid, uuid) to authenticated;
grant execute on function public.growth_record_creator_unchanged(uuid, uuid) to authenticated;

drop policy if exists care_logs_insert_editor on public.care_logs;
create policy care_logs_insert_editor on public.care_logs
  for insert to authenticated
  with check (
    public.can_edit_care_logs(baby_id)
    and created_by = auth.uid()
  );

drop policy if exists care_logs_update_editor on public.care_logs;
create policy care_logs_update_editor on public.care_logs
  for update to authenticated
  using (public.can_edit_care_logs(baby_id))
  with check (
    public.can_edit_care_logs(baby_id)
    and public.care_log_creator_unchanged(id, created_by)
  );

drop policy if exists growth_records_update_editor on public.growth_records;
create policy growth_records_update_editor on public.growth_records
  for update to authenticated
  using (public.can_edit_growth_records(baby_id))
  with check (
    public.can_edit_growth_records(baby_id)
    and public.growth_record_creator_unchanged(id, created_by)
  );

-- Account deletion must remove the denormalized actor snapshot as well as the
-- protected relational author id. Otherwise a shared care log would retain the
-- deleted user's id/name inside payload JSON.
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

  update public.babies set created_by = null where created_by = v_user_id;
  update public.care_logs
    set created_by = null,
        payload = payload - 'createdBy'
    where created_by = v_user_id;
  update public.growth_records set created_by = null where created_by = v_user_id;
  update public.invite_codes set created_by = null where created_by = v_user_id;
  update public.invite_codes set used_by = null where used_by = v_user_id;

  delete from public.baby_members where user_id = v_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;

-- Forward-fix for projects where 202607310001_created_by_integrity.sql was
-- skipped while later migrations were applied manually.
--
-- Do not recreate prepare_account_deletion() here: later migration
-- 202608030005_account_policy_safety.sql owns its current, broader definition.

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

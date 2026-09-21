-- Only the baby's recorded creator may delete the entire baby space.
-- Existing FK cascades remove baby-scoped rows, and B0.4b triggers enqueue
-- private Storage objects before the rows disappear. Claims have no FK.
begin;

drop policy if exists babies_delete_admin on public.babies;
drop policy if exists babies_delete_creator on public.babies;
create policy babies_delete_creator on public.babies
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    and public.baby_permission(id) = 'admin'::public.permission_role
  );

-- SECURITY DEFINER account-lifecycle paths bypass RLS. They must not delete
-- an invited/shared baby's space on behalf of a non-creator either. Such an
-- account departure fails closed until another admin takes responsibility.
create or replace function public.guard_created_baby_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.created_by is distinct from auth.uid() then
    raise exception 'Only the baby creator may delete this profile' using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke all on function public.guard_created_baby_delete() from public, anon, authenticated;
drop trigger if exists guard_created_baby_delete on public.babies;
create trigger guard_created_baby_delete before delete on public.babies
  for each row execute function public.guard_created_baby_delete();

create or replace function public.delete_created_baby(p_baby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_creator uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Parent then membership locks serialize a competing role change or delete.
  select b.created_by into v_creator
  from public.babies b where b.id = p_baby_id for update;
  if not found then return false; end if;
  if v_creator is distinct from v_actor then
    raise exception 'Only the baby creator may delete this profile' using errcode = '42501';
  end if;
  perform 1 from public.baby_members m
  where m.baby_id = p_baby_id and m.user_id = v_actor
    and m.status = 'active' and m.permission_role = 'admin'::public.permission_role
  for update;
  if not found then
    raise exception 'Active creator administration is required' using errcode = '42501';
  end if;

  delete from public.babies where id = p_baby_id;
  -- No FK exists for upload claims. Parent/media triggers have already read
  -- their evidence and queued Storage cleanup in this same transaction.
  delete from public.media_temp_claims where baby_id = p_baby_id;
  return true;
end;
$$;

revoke all on function public.delete_created_baby(uuid) from public, anon;
grant execute on function public.delete_created_baby(uuid) to authenticated;

-- Also cover an authorized direct DELETE or account-lifecycle deletion.
create or replace function public.cleanup_deleted_baby_claims()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.media_temp_claims where baby_id = old.id;
  return old;
end;
$$;
revoke all on function public.cleanup_deleted_baby_claims() from public, anon, authenticated;
drop trigger if exists cleanup_deleted_baby_claims on public.babies;
create constraint trigger cleanup_deleted_baby_claims
  after delete on public.babies deferrable initially deferred for each row
  execute function public.cleanup_deleted_baby_claims();

commit;

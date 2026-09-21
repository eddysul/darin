-- G2 lifecycle: creator-only direct deletion remains unchanged, while the
-- account-deletion RPC may remove a baby owned by somebody else only when the
-- deleting account is its proven last current Full Admin.
begin;

create or replace function public.guard_created_baby_delete()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and old.created_by is distinct from auth.uid() then
    if current_setting('darin.account_deletion',true) is distinct from 'true'
      or not public.is_baby_full_admin(old.id,auth.uid())
      or exists(select 1 from public.baby_members m where m.baby_id=old.id and m.user_id<>auth.uid()
        and m.status::text is not distinct from 'active'
        and m.permission_role is not distinct from 'admin'::public.permission_role) then
      raise exception 'Only the baby creator may delete this profile' using errcode='42501';
    end if;
  end if;
  return old;
end;
$$;

create or replace function public.prepare_account_deletion()
returns void language plpgsql security definer set search_path=public as $$
declare v_user_id uuid:=auth.uid(); v_baby_id uuid; v_role public.permission_role; v_creator_orphan boolean;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  for v_baby_id in
    select baby_id from public.baby_members where user_id=v_user_id and status::text is not distinct from 'active'
    union select b.id from public.babies b where b.created_by=v_user_id and not exists(
      select 1 from public.baby_members m where m.baby_id=b.id and m.status::text is not distinct from 'active'
        and m.permission_role is not distinct from 'admin'::public.permission_role)
    order by 1
  loop
    perform 1 from public.babies b where b.id=v_baby_id for update;
    if not found then continue; end if;
    select m.permission_role into v_role from public.baby_members m where m.baby_id=v_baby_id
      and m.user_id=v_user_id and m.status::text is not distinct from 'active' for update;
    select exists(select 1 from public.babies b where b.id=v_baby_id and b.created_by=v_user_id
      and not exists(select 1 from public.baby_members m where m.baby_id=b.id
        and m.status::text is not distinct from 'active'
        and m.permission_role is not distinct from 'admin'::public.permission_role)) into v_creator_orphan;
    if (v_role is not distinct from 'admin'::public.permission_role and not exists(
      select 1 from public.baby_members m where m.baby_id=v_baby_id and m.user_id<>v_user_id
        and m.status::text is not distinct from 'active'
        and m.permission_role is not distinct from 'admin'::public.permission_role)) or (v_role is null and v_creator_orphan) then
      perform set_config('darin.account_deletion','true',true);
      delete from public.babies where id=v_baby_id;
      delete from public.media_temp_claims where baby_id=v_baby_id;
    elsif v_role is not null and not exists(select 1 from public.baby_members m where m.baby_id=v_baby_id
      and m.status::text is not distinct from 'active'
      and m.permission_role is not distinct from 'admin'::public.permission_role) then
      raise exception 'Baby space has no active Full Admin' using errcode='23514';
    end if;
  end loop;

  insert into public.media_cleanup_queue(bucket_id,storage_path,requested_by)
    select o.bucket_id,o.name,v_user_id from storage.objects o where o.owner_id=v_user_id::text
      and o.bucket_id in ('memories','diary-media','growth-book-media','baby-stickers','profile-media')
      and public.storage_key_is_canonical(o.name) and not storage_security.key_attached(o.bucket_id,o.name)
    on conflict do nothing;

  update public.care_logs set created_by=null where created_by=v_user_id;
  update public.growth_records set created_by=null where created_by=v_user_id;
  update public.invite_codes set created_by=null where created_by=v_user_id;
  update public.invite_codes set used_by=null where used_by=v_user_id;
  update public.notification_events set actor_id=null where actor_id=v_user_id;
  update public.contact_requests set user_id=null where user_id=v_user_id;
  update public.media_temp_claims set uploader_id=null where uploader_id=v_user_id;
  delete from public.push_tokens where user_id=v_user_id;
  delete from public.notification_settings where user_id=v_user_id;
  delete from public.notification_events where recipient_id=v_user_id;
  delete from public.memory_friends where user_id=v_user_id;
  delete from public.baby_members where user_id=v_user_id;
  delete from public.baby_access_permissions where user_id=v_user_id;
end;
$$;

revoke all on function public.guard_created_baby_delete() from public,anon,authenticated;
revoke all on function public.prepare_account_deletion() from public,anon;
grant execute on function public.prepare_account_deletion() to authenticated;

commit;

-- Recover a baby orphaned by the former prepare_account_deletion() implementation
-- when the still-authenticated account is its recorded creator. That RPC could
-- remove the last admin membership before Auth deletion failed on a FK.
begin;

create or replace function public.prepare_account_deletion()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_baby_id uuid;
  v_role public.permission_role;
  v_is_legacy_orphan boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  for v_baby_id in
    select baby_id from public.baby_members
    where user_id = v_user_id and status = 'active'
    union
    select b.id from public.babies b
    where b.created_by = v_user_id
      and not exists (
        select 1 from public.baby_members m where m.baby_id = b.id
          and m.status = 'active' and m.permission_role = 'admin'::public.permission_role
      )
    order by 1
  loop
    -- A per-baby lock serializes concurrent departures. Recheck under the lock.
    perform 1 from public.babies b where b.id = v_baby_id for update;
    if not found then continue; end if;
    v_role := null;
    select m.permission_role into v_role from public.baby_members m
    where m.baby_id = v_baby_id and m.user_id = v_user_id and m.status = 'active';
    select exists (
      select 1 from public.babies b where b.id = v_baby_id and b.created_by = v_user_id
        and not exists (
          select 1 from public.baby_members m where m.baby_id = b.id
            and m.status = 'active' and m.permission_role = 'admin'::public.permission_role
        )
    ) into v_is_legacy_orphan;

    if (v_role = 'admin'::public.permission_role and not exists (
      select 1 from public.baby_members m where m.baby_id = v_baby_id
        and m.user_id <> v_user_id and m.status = 'active'
        and m.permission_role = 'admin'::public.permission_role
    )) or (v_role is null and v_is_legacy_orphan) then
      delete from public.babies where id = v_baby_id;
      delete from public.media_temp_claims where baby_id = v_baby_id;
    elsif v_role is not null and v_role <> 'admin'::public.permission_role
      and not exists (
        select 1 from public.baby_members m where m.baby_id = v_baby_id
          and m.status = 'active' and m.permission_role = 'admin'::public.permission_role
      ) then
      raise exception 'Baby space has no active admin' using errcode = '23514';
    end if;
  end loop;

  insert into public.media_cleanup_queue(bucket_id, storage_path, requested_by)
  select o.bucket_id, o.name, v_user_id from storage.objects o
  where o.owner_id = v_user_id::text
    and o.bucket_id in ('memories','diary-media','growth-book-media','baby-stickers','profile-media')
    and public.storage_key_is_canonical(o.name)
    and not storage_security.key_attached(o.bucket_id, o.name)
  on conflict do nothing;

  update public.care_logs set created_by = null where created_by = v_user_id;
  update public.growth_records set created_by = null where created_by = v_user_id;
  update public.invite_codes set created_by = null where created_by = v_user_id;
  update public.invite_codes set used_by = null where used_by = v_user_id;
  update public.notification_events set actor_id = null where actor_id = v_user_id;
  update public.contact_requests set user_id = null where user_id = v_user_id;
  update public.media_temp_claims set uploader_id = null where uploader_id = v_user_id;

  delete from public.push_tokens where user_id = v_user_id;
  delete from public.notification_settings where user_id = v_user_id;
  delete from public.notification_events where recipient_id = v_user_id;
  delete from public.memory_friends where user_id = v_user_id;
  delete from public.baby_members where user_id = v_user_id;
end;
$$;
revoke all on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;

commit;

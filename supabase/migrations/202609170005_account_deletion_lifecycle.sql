-- Account deletion: retain a baby only while another active admin can manage it.
-- The RPC is retriable after an Auth Admin failure; physical media deletion is queued.
begin;

alter table public.baby_caution_foods alter column created_by drop not null;
alter table public.baby_caution_foods drop constraint baby_caution_foods_created_by_fkey;
alter table public.baby_caution_foods
  add constraint baby_caution_foods_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

create or replace function public.baby_caution_food_identity_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.baby_id is distinct from old.baby_id
     or (new.created_by is distinct from old.created_by
         and not (new.created_by is null and pg_trigger_depth() > 1))
     or new.created_at is distinct from old.created_at then
    raise exception 'caution food identity columns are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.baby_caution_food_identity_guard() from public;

-- Claims are private tombstones. Keep them for retained shared media, but do not
-- retain the deleted account's uploader identifier.
alter table public.media_temp_claims alter column uploader_id drop not null;

create or replace function public.prepare_account_deletion()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_baby_id uuid;
  v_role public.permission_role;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Serialize concurrent admin departures for each baby. The second request
  -- sees the first committed membership removal before deciding its lifecycle.
  for v_baby_id in
    select m.baby_id from public.baby_members m
    where m.user_id = v_user_id and m.status = 'active'
    order by m.baby_id
  loop
    perform 1 from public.babies b where b.id = v_baby_id for update;
    if not found then continue; end if;

    select m.permission_role into v_role from public.baby_members m
    where m.baby_id = v_baby_id and m.user_id = v_user_id and m.status = 'active';
    if not found then continue; end if;

    if v_role = 'admin'::public.permission_role then
      if not exists (
        select 1 from public.baby_members m
        where m.baby_id = v_baby_id and m.user_id <> v_user_id
          and m.status = 'active' and m.permission_role = 'admin'::public.permission_role
      ) then
        -- All baby-scoped rows cascade; existing BEFORE DELETE triggers queue
        -- private media paths in this same transaction.
        delete from public.babies where id = v_baby_id;
        -- media_temp_claims deliberately have no FK: remove only this baby's
        -- claims after the deletion triggers have inspected them.
        delete from public.media_temp_claims where baby_id = v_baby_id;
      end if;
    elsif not exists (
      select 1 from public.baby_members m
      where m.baby_id = v_baby_id and m.status = 'active'
        and m.permission_role = 'admin'::public.permission_role
    ) then
      -- Do not make an already corrupt, admin-less baby harder to recover.
      raise exception 'Baby space has no active admin' using errcode = '23514';
    end if;
  end loop;

  -- Retire only unattached private uploads owned by this account. Attached
  -- shared-family media remains available while its baby space is retained.
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

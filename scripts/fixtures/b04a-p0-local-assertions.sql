\set ON_ERROR_STOP on

set role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);

do $$
begin
  perform public.create_invite_code(
    '10000000-0000-4000-8000-000000000001', 'family', 'admin', '가족', null, 1
  );
  raise exception 'outsider create_invite_code unexpectedly succeeded';
exception when insufficient_privilege then
  null;
end;
$$;

insert into public.memory_media (memory_post_id, baby_id, storage_path) values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002/temp/40000000-0000-4000-8000-000000000003/valid.jpg'
);

do $$
begin
  perform * from public.list_baby_memory_friends('10000000-0000-4000-8000-000000000001');
  raise exception 'outsider list_baby_memory_friends unexpectedly succeeded';
exception when insufficient_privilege then
  null;
end;
$$;

do $$
begin
  perform public.add_darin_friend_to_baby(
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003'
  );
  raise exception 'outsider add_darin_friend_to_baby unexpectedly succeeded';
exception when insufficient_privilege then
  null;
end;
$$;

-- A historical cross-baby row must no longer be visible to the attacker who
-- owns its referenced post.
do $$
begin
  if exists (
    select 1 from public.memory_media
    where id = '30000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'historical mismatched memory_media row remains visible';
  end if;
end;
$$;

-- The NOT VALID FK still enforces all new writes.
do $$
begin
  insert into public.memory_media (memory_post_id, baby_id, storage_path) values (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001/temp/40000000-0000-4000-8000-000000000002/new.jpg'
  );
  raise exception 'new mismatched memory_media row unexpectedly succeeded';
exception
  when foreign_key_violation or insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);

-- Existing product behavior remains available to a real current admin.
select (public.create_invite_code(
  '10000000-0000-4000-8000-000000000001', 'baby_friend', 'viewer', '친구', null, 1
)).id is not null as admin_invite_created;
select count(*) = 0 as admin_friend_list_works
from public.list_baby_memory_friends('10000000-0000-4000-8000-000000000001');
select (public.add_darin_friend_to_baby(
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003'
)).id is not null as admin_friend_added;

reset role;
update public.baby_members
set status = 'inactive'
where baby_id = '10000000-0000-4000-8000-000000000001'
  and user_id = '00000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', false);

do $$
begin
  perform * from public.accept_invite_code('DARIN-STALE', 'Receiver', null, '가족');
  raise exception 'invite from a former admin unexpectedly succeeded';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;

do $$
begin
  insert into public.memory_media (memory_post_id, baby_id, storage_path) values (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001/temp/40000000-0000-4000-8000-000000000004/privileged.jpg'
  );
  raise exception 'composite FK did not reject a privileged mismatched insert';
exception when foreign_key_violation then
  null;
end;
$$;

do $$
begin
  if (select used_count from public.invite_codes where code = 'DARIN-STALE') <> 0 then
    raise exception 'rejected invite consumed a use';
  end if;
  if exists (
    select 1 from public.baby_members
    where baby_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'rejected invite granted membership';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.memory_media'::regclass
      and conname = 'memory_media_post_baby_fkey'
      and not convalidated
  ) then
    raise exception 'expected NOT VALID composite FK is missing';
  end if;
end;
$$;

update public.baby_members
set status = 'active'
where baby_id = '10000000-0000-4000-8000-000000000001'
  and user_id = '00000000-0000-4000-8000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', false);
select count(*) = 1 as current_admin_invite_accepted
from public.accept_invite_code('DARIN-STALE', 'Receiver', null, '가족');
reset role;

do $$
begin
  if not exists (
    select 1 from public.baby_members
    where baby_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000004'
      and status = 'active'
      and permission_role = 'editor'
  ) then
    raise exception 'current admin invite did not grant the expected membership';
  end if;
end;
$$;

select 'B0.4a P0 local PostgreSQL assertions passed' as result;

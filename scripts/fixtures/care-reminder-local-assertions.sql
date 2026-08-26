\set ON_ERROR_STOP on

insert into public.profiles (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004');
insert into public.babies (id, name) values
  ('20000000-0000-0000-0000-000000000001', 'baby-a'),
  ('20000000-0000-0000-0000-000000000002', 'baby-b');
insert into public.baby_members (baby_id, user_id, permission_role, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', 'active'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'editor', 'active'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'viewer', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'admin', 'active');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into public.care_reminder_settings (
  baby_id, reminder_type, enabled, interval_minutes, updated_by
) values (
  '20000000-0000-0000-0000-000000000001', 'feeding', true, 15,
  '10000000-0000-0000-0000-000000000001'
), (
  '20000000-0000-0000-0000-000000000002', 'feeding', true, 15,
  '10000000-0000-0000-0000-000000000001'
);
commit;

do $$
begin
  if (select count(*) from public.care_reminder_member_preferences
      where baby_id = '20000000-0000-0000-0000-000000000001' and delivery_enabled) <> 2 then
    raise exception 'admin/editor defaults were not created';
  end if;
  if exists (select 1 from public.care_reminder_member_preferences
      where user_id = '10000000-0000-0000-0000-000000000003') then
    raise exception 'viewer was incorrectly defaulted ON';
  end if;
end;
$$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
insert into public.care_reminder_member_preferences (
  baby_id, user_id, reminder_type, delivery_enabled, timezone, user_modified_at
) values (
  '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
  'feeding', true, 'America/Los_Angeles', now()
);
update public.care_reminder_settings set interval_minutes = 120,
  updated_by = '10000000-0000-0000-0000-000000000003'
where baby_id = '20000000-0000-0000-0000-000000000001';
update public.care_reminder_member_preferences set delivery_enabled = false
where baby_id = '20000000-0000-0000-0000-000000000001'
  and user_id = '10000000-0000-0000-0000-000000000002';
commit;

do $$
begin
  if (select interval_minutes from public.care_reminder_settings
      where baby_id = '20000000-0000-0000-0000-000000000001') <> 15 then
    raise exception 'viewer changed shared setting';
  end if;
  if not (select delivery_enabled from public.care_reminder_member_preferences
      where baby_id = '20000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'viewer changed another member preference';
  end if;
  if (select send_status from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001') <> 'disabled' then
    raise exception 'viewer changed worker-owned state';
  end if;
  if has_table_privilege('authenticated', 'public.care_reminder_state', 'UPDATE') then
    raise exception 'authenticated role unexpectedly has worker-state UPDATE privilege';
  end if;
end;
$$;

insert into public.care_logs (id, baby_id, category, recorded_at, payload) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'formula', now() + interval '30 minutes', '{"duration":"5"}'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'storedMilk', now() + interval '45 minutes', '{}');

do $$
begin
  if (select last_relevant_log_id from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001')
      <> '30000000-0000-0000-0000-000000000002' then
    raise exception 'latest relevant feed was not selected';
  end if;
end;
$$;

delete from public.care_logs where id = '30000000-0000-0000-0000-000000000002';
do $$
begin
  if (select last_relevant_log_id from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001')
      <> '30000000-0000-0000-0000-000000000001' then
    raise exception 'deleting latest feed did not restore previous feed';
  end if;
end;
$$;

do $$
declare v_version bigint;
begin
  select version into v_version from public.care_reminder_state
    where baby_id = '20000000-0000-0000-0000-000000000001';
  insert into public.care_logs (baby_id, category, recorded_at, payload)
    values ('20000000-0000-0000-0000-000000000001', 'pump', now() + interval '2 hours', '{"duration":"20"}');
  if (select version from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001') <> v_version then
    raise exception 'pump changed feeding reminder state';
  end if;
end;
$$;

insert into public.care_logs (baby_id, category, recorded_at, payload)
values ('20000000-0000-0000-0000-000000000002', 'breast', now() - interval '1 day', '{"duration":"invalid"}');
do $$
begin
  if (select send_status from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000002') <> 'overdue_not_scheduled' then
    raise exception 'backdated feed was incorrectly scheduled';
  end if;
end;
$$;

update public.care_reminder_state
set next_due_at = now() - interval '1 minute', send_status = 'scheduled', processing_started_at = null
where baby_id = '20000000-0000-0000-0000-000000000001';
begin;
set local role service_role;
select * from public.claim_due_care_reminders(10);
commit;
do $$
begin
  if (select processing_started_at from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001') is null then
    raise exception 'due reminder was not claimed';
  end if;
end;
$$;

update public.care_reminder_settings set enabled = false,
  updated_by = '10000000-0000-0000-0000-000000000001'
where baby_id = '20000000-0000-0000-0000-000000000001';
do $$
begin
  if exists (select 1 from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001'
      and (send_status <> 'disabled' or next_due_at is not null)) then
    raise exception 'setting OFF did not disable state';
  end if;
end;
$$;

insert into public.notification_events (
  recipient_id, event_type, title, status, delivery_status
) values (
  '10000000-0000-0000-0000-000000000001', 'feeding_reminder', 'feeding', 'skipped', 'skipped_no_token'
);
do $$
declare v_definition text;
begin
  select pg_get_constraintdef(oid) into v_definition from pg_constraint
  where conrelid = 'public.notification_events'::regclass
    and conname = 'notification_events_event_type_check';
  if position('legacy_allowed_no_rows' in v_definition) = 0
    or position('legacy_live' in v_definition) = 0
    or position('feeding_reminder' in v_definition) = 0 then
    raise exception 'notification event types were not preserved: %', v_definition;
  end if;
end;
$$;

-- Sleep uses the end of a completed sleep log (recorded_at + duration), shares
-- the same role defaults, and does not immediately schedule backdated records.
update public.profiles set preferred_language = 'en'
where id = '10000000-0000-0000-0000-000000000001';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into public.care_reminder_settings (
  baby_id, reminder_type, enabled, interval_minutes, included_log_types, updated_by
) values
  ('20000000-0000-0000-0000-000000000001', 'sleep', true, 120, array['sleep'], '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'sleep', true, 120, array['sleep'], '10000000-0000-0000-0000-000000000001');
commit;

insert into public.care_logs (id, baby_id, category, recorded_at, payload) values
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 'sleep', now() + interval '20 minutes', '{"duration":"30"}'),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', 'sleep', now() + interval '40 minutes', '{"duration":"15"}'),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000002', 'sleep', now() - interval '1 day', '{"duration":"invalid"}');

do $$
begin
  if (select last_relevant_log_id from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001' and reminder_type = 'sleep')
      <> '30000000-0000-0000-0000-000000000012' then
    raise exception 'latest sleep end was not selected';
  end if;
  if (select send_status from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000002' and reminder_type = 'sleep')
      <> 'overdue_not_scheduled' then
    raise exception 'backdated sleep was incorrectly scheduled';
  end if;
  if (select count(*) from public.care_reminder_member_preferences
      where baby_id = '20000000-0000-0000-0000-000000000001'
        and reminder_type = 'sleep' and delivery_enabled) <> 2 then
    raise exception 'sleep admin/editor defaults were not created';
  end if;
end;
$$;

delete from public.care_logs where id = '30000000-0000-0000-0000-000000000012';
do $$
begin
  if (select last_relevant_log_id from public.care_reminder_state
      where baby_id = '20000000-0000-0000-0000-000000000001' and reminder_type = 'sleep')
      <> '30000000-0000-0000-0000-000000000011' then
    raise exception 'deleting latest sleep did not restore the previous sleep';
  end if;
end;
$$;

insert into public.notification_events (recipient_id, event_type, title, body)
values ('10000000-0000-0000-0000-000000000001', 'sleep_reminder', 'legacy title', 'legacy body');
do $$
begin
  if not exists (
    select 1 from public.notification_events
    where recipient_id = '10000000-0000-0000-0000-000000000001'
      and event_type = 'sleep_reminder' and title = 'Sleep log reminder'
  ) then
    raise exception 'recipient locale did not localize sleep notification copy';
  end if;
end;
$$;

select 'local care reminder PostgreSQL assertions passed' as result;

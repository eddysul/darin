-- Family-shared care reminders. Build 15 implements feeding only; the schema keeps
-- reminder_type open for a later sleep implementation.

create table if not exists public.care_reminder_settings (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  reminder_type text not null check (reminder_type in ('feeding', 'sleep')),
  enabled boolean not null default false,
  mode text not null default 'custom' check (mode in ('custom', 'age_preset')),
  interval_minutes integer not null default 180 check (interval_minutes between 15 and 720),
  included_log_types text[] not null default array['breast', 'formula', 'storedMilk']::text[],
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, reminder_type),
  check (reminder_type <> 'feeding' or included_log_types <@ array['breast', 'formula', 'storedMilk']::text[])
);

create table if not exists public.care_reminder_member_preferences (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reminder_type text not null check (reminder_type in ('feeding', 'sleep')),
  delivery_enabled boolean not null default false,
  quiet_hours_enabled boolean not null default false,
  quiet_start time,
  quiet_end time,
  timezone text,
  user_modified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, user_id, reminder_type),
  check (not quiet_hours_enabled or (quiet_start is not null and quiet_end is not null))
);

create table if not exists public.care_reminder_state (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  reminder_type text not null check (reminder_type in ('feeding', 'sleep')),
  last_relevant_log_id uuid references public.care_logs (id) on delete set null,
  last_relevant_log_at timestamptz,
  next_due_at timestamptz,
  version bigint not null default 1,
  send_status text not null default 'disabled' check (send_status in (
    'scheduled', 'overdue_not_scheduled', 'sent', 'processed', 'disabled', 'skipped_quiet_hours'
  )),
  last_sent_for_log_id uuid references public.care_logs (id) on delete set null,
  last_sent_at timestamptz,
  processing_started_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (baby_id, reminder_type)
);

-- CREATE TABLE IF NOT EXISTS does not repair a partially-created table. Stop with
-- a useful error before installing policies/functions against an incompatible
-- shape. The forward-fix runbook describes how to repair a failed QA apply.
do $$
declare
  v_table text;
  v_required text[];
  v_missing text[];
begin
  for v_table, v_required in
    select * from (values
      ('care_reminder_settings', array[
        'id', 'baby_id', 'reminder_type', 'enabled', 'mode', 'interval_minutes',
        'included_log_types', 'updated_by', 'created_at', 'updated_at'
      ]::text[]),
      ('care_reminder_member_preferences', array[
        'id', 'baby_id', 'user_id', 'reminder_type', 'delivery_enabled',
        'quiet_hours_enabled', 'quiet_start', 'quiet_end', 'timezone',
        'user_modified_at', 'created_at', 'updated_at'
      ]::text[]),
      ('care_reminder_state', array[
        'id', 'baby_id', 'reminder_type', 'last_relevant_log_id',
        'last_relevant_log_at', 'next_due_at', 'version', 'send_status',
        'last_sent_for_log_id', 'last_sent_at', 'processing_started_at', 'updated_at'
      ]::text[])
    ) expected(table_name, columns)
  loop
    select array_agg(required_column.name order by required_column.name) into v_missing
    from unnest(v_required) as required_column(name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v_table
        and c.column_name = required_column.name
    );
    if v_missing is not null then
      raise exception 'care reminder schema is incomplete: %. Missing columns: %', v_table, v_missing;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.care_reminder_settings'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (baby_id, reminder_type)'
  ) or not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.care_reminder_member_preferences'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (baby_id, user_id, reminder_type)'
  ) or not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.care_reminder_state'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (baby_id, reminder_type)'
  ) then
    raise exception 'care reminder schema is incomplete: required unique constraints are missing';
  end if;
end;
$$;

-- Keep the state status constraint compatible when this migration is re-run
-- over the pre-QA draft schema.
alter table public.care_reminder_state
  drop constraint if exists care_reminder_state_send_status_check;
alter table public.care_reminder_state
  add constraint care_reminder_state_send_status_check check (send_status in (
    'scheduled', 'overdue_not_scheduled', 'sent', 'processed', 'disabled', 'skipped_quiet_hours'
  ));

do $$
begin
  if (select count(*) from pg_constraint where conrelid = 'public.care_reminder_settings'::regclass and contype = 'p') <> 1
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_settings'::regclass and contype = 'f') < 2
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_settings'::regclass and contype = 'c') < 4
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_member_preferences'::regclass and contype = 'p') <> 1
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_member_preferences'::regclass and contype = 'f') < 2
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_member_preferences'::regclass and contype = 'c') < 2
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_state'::regclass and contype = 'p') <> 1
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_state'::regclass and contype = 'f') < 3
    or (select count(*) from pg_constraint where conrelid = 'public.care_reminder_state'::regclass and contype = 'c') < 2
  then
    raise exception 'care reminder schema is incomplete: required primary, foreign-key, or check constraints are missing';
  end if;
end;
$$;

create index if not exists care_reminder_state_due_idx
  on public.care_reminder_state (next_due_at)
  where reminder_type = 'feeding' and send_status = 'scheduled';
create index if not exists care_reminder_member_delivery_idx
  on public.care_reminder_member_preferences (baby_id, reminder_type, user_id)
  where delivery_enabled;

do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'care_reminder_state_due_idx'
      and indexdef like '%(next_due_at)%'
      and indexdef like '%send_status = ''scheduled''%'
  ) or not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'care_reminder_member_delivery_idx'
      and indexdef like '%(baby_id, reminder_type, user_id)%'
      and indexdef like '%delivery_enabled%'
  ) then
    raise exception 'care reminder schema is incomplete: required partial indexes are missing or incompatible';
  end if;
end;
$$;

drop trigger if exists care_reminder_settings_set_updated_at on public.care_reminder_settings;
create trigger care_reminder_settings_set_updated_at before update on public.care_reminder_settings
  for each row execute function public.set_updated_at();
drop trigger if exists care_reminder_member_preferences_set_updated_at on public.care_reminder_member_preferences;
create trigger care_reminder_member_preferences_set_updated_at before update on public.care_reminder_member_preferences
  for each row execute function public.set_updated_at();

alter table public.care_reminder_settings enable row level security;
alter table public.care_reminder_member_preferences enable row level security;
alter table public.care_reminder_state enable row level security;

drop policy if exists care_reminder_settings_select_member on public.care_reminder_settings;
create policy care_reminder_settings_select_member on public.care_reminder_settings
  for select to authenticated using (public.is_baby_member(baby_id));
drop policy if exists care_reminder_settings_insert_editor on public.care_reminder_settings;
create policy care_reminder_settings_insert_editor on public.care_reminder_settings
  for insert to authenticated with check (
    public.baby_permission(baby_id) in ('admin', 'editor') and updated_by = auth.uid()
  );
drop policy if exists care_reminder_settings_update_editor on public.care_reminder_settings;
create policy care_reminder_settings_update_editor on public.care_reminder_settings
  for update to authenticated using (public.baby_permission(baby_id) in ('admin', 'editor'))
  with check (public.baby_permission(baby_id) in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists care_reminder_member_preferences_select_own on public.care_reminder_member_preferences;
create policy care_reminder_member_preferences_select_own on public.care_reminder_member_preferences
  for select to authenticated using (user_id = auth.uid() and public.is_baby_member(baby_id));
drop policy if exists care_reminder_member_preferences_insert_own on public.care_reminder_member_preferences;
create policy care_reminder_member_preferences_insert_own on public.care_reminder_member_preferences
  for insert to authenticated with check (user_id = auth.uid() and public.is_baby_member(baby_id));
drop policy if exists care_reminder_member_preferences_update_own on public.care_reminder_member_preferences;
create policy care_reminder_member_preferences_update_own on public.care_reminder_member_preferences
  for update to authenticated using (user_id = auth.uid() and public.is_baby_member(baby_id))
  with check (user_id = auth.uid() and public.is_baby_member(baby_id));
drop policy if exists care_reminder_member_preferences_delete_own on public.care_reminder_member_preferences;
create policy care_reminder_member_preferences_delete_own on public.care_reminder_member_preferences
  for delete to authenticated using (user_id = auth.uid() and public.is_baby_member(baby_id));

drop policy if exists care_reminder_state_select_member on public.care_reminder_state;
create policy care_reminder_state_select_member on public.care_reminder_state
  for select to authenticated using (public.is_baby_member(baby_id));

grant select, insert, update on table public.care_reminder_settings to authenticated;
grant select, insert, update, delete on table public.care_reminder_member_preferences to authenticated;
grant select on table public.care_reminder_state to authenticated;
grant all on table public.care_reminder_settings to service_role;
grant all on table public.care_reminder_member_preferences to service_role;
grant all on table public.care_reminder_state to service_role;

-- Returns the effective end of a feeding log. Invalid/negative/unreasonably large
-- legacy duration strings are ignored and recorded_at remains authoritative.
create or replace function public.care_reminder_feed_at(p_recorded_at timestamptz, p_payload jsonb)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_payload->>'duration', '') ~ '^([0-9]+([.][0-9]+)?)$'
      and (p_payload->>'duration')::numeric between 0 and 1440
    then p_recorded_at + make_interval(secs => ((p_payload->>'duration')::numeric * 60)::double precision)
    else p_recorded_at
  end;
$$;

create or replace function public.sync_care_reminder_state(
  p_baby_id uuid,
  p_reminder_type text default 'feeding'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting public.care_reminder_settings;
  v_log_id uuid;
  v_feed_at timestamptz;
  v_due_at timestamptz;
  v_status text;
  v_existing public.care_reminder_state;
  v_changed boolean;
begin
  if p_reminder_type <> 'feeding' then return; end if;

  select * into v_setting from public.care_reminder_settings
    where baby_id = p_baby_id and reminder_type = p_reminder_type;
  select * into v_existing from public.care_reminder_state
    where baby_id = p_baby_id and reminder_type = p_reminder_type;

  if v_setting.id is null or not v_setting.enabled then
    insert into public.care_reminder_state (
      baby_id, reminder_type, send_status, version, processing_started_at
    ) values (
      p_baby_id, p_reminder_type, 'disabled', coalesce(v_existing.version, 0) + 1, null
    ) on conflict (baby_id, reminder_type) do update set
      send_status = 'disabled', next_due_at = null, processing_started_at = null,
      version = public.care_reminder_state.version + 1, updated_at = now();
    return;
  end if;

  select log_id, feed_at into v_log_id, v_feed_at
  from (
    select l.id as log_id, public.care_reminder_feed_at(l.recorded_at, l.payload) as feed_at
    from public.care_logs l
    where l.baby_id = p_baby_id and l.category = any(v_setting.included_log_types)
  ) relevant
  order by feed_at desc, log_id desc
  limit 1;

  if v_log_id is null then
    insert into public.care_reminder_state (
      baby_id, reminder_type, send_status, version, processing_started_at
    ) values (
      p_baby_id, p_reminder_type, 'disabled', coalesce(v_existing.version, 0) + 1, null
    ) on conflict (baby_id, reminder_type) do update set
      last_relevant_log_id = null, last_relevant_log_at = null, next_due_at = null,
      send_status = 'disabled', processing_started_at = null,
      version = public.care_reminder_state.version + 1, updated_at = now();
    return;
  end if;

  v_due_at := v_feed_at + make_interval(mins => v_setting.interval_minutes);
  v_status := case when v_due_at <= now() then 'overdue_not_scheduled' else 'scheduled' end;
  v_changed := v_existing.id is null
    or v_existing.last_relevant_log_id is distinct from v_log_id
    or v_existing.last_relevant_log_at is distinct from v_feed_at
    or v_existing.next_due_at is distinct from v_due_at
    or v_existing.send_status = 'disabled';

  if not v_changed then return; end if;

  insert into public.care_reminder_state (
    baby_id, reminder_type, last_relevant_log_id, last_relevant_log_at,
    next_due_at, version, send_status, last_sent_for_log_id, last_sent_at,
    processing_started_at
  ) values (
    p_baby_id, p_reminder_type, v_log_id, v_feed_at, v_due_at,
    coalesce(v_existing.version, 0) + 1, v_status, null, null, null
  ) on conflict (baby_id, reminder_type) do update set
    last_relevant_log_id = excluded.last_relevant_log_id,
    last_relevant_log_at = excluded.last_relevant_log_at,
    next_due_at = excluded.next_due_at,
    version = public.care_reminder_state.version + 1,
    send_status = excluded.send_status,
    last_sent_for_log_id = null,
    last_sent_at = null,
    processing_started_at = null,
    updated_at = now();
end;
$$;

revoke all on function public.care_reminder_feed_at(timestamptz, jsonb) from public;
revoke all on function public.sync_care_reminder_state(uuid, text) from public;
grant execute on function public.care_reminder_feed_at(timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.sync_care_reminder_state(uuid, text) to service_role;

create or replace function public.on_care_log_sync_feeding_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.category in ('breast', 'formula', 'storedMilk') then
      perform public.sync_care_reminder_state(old.baby_id, 'feeding');
    end if;
    return old;
  end if;
  if new.category in ('breast', 'formula', 'storedMilk')
     or (tg_op = 'UPDATE' and old.category in ('breast', 'formula', 'storedMilk')) then
    perform public.sync_care_reminder_state(new.baby_id, 'feeding');
    if tg_op = 'UPDATE' and old.baby_id <> new.baby_id then
      perform public.sync_care_reminder_state(old.baby_id, 'feeding');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists care_logs_sync_feeding_reminder on public.care_logs;
create trigger care_logs_sync_feeding_reminder
  after insert or update or delete on public.care_logs
  for each row execute function public.on_care_log_sync_feeding_reminder();

create or replace function public.on_care_reminder_setting_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reminder_type = 'feeding' and new.enabled then
    insert into public.care_reminder_member_preferences (
      baby_id, user_id, reminder_type, delivery_enabled, timezone
    )
    select new.baby_id, m.user_id, 'feeding', true, null
    from public.baby_members m
    where m.baby_id = new.baby_id and m.status = 'active'
      and m.permission_role in ('admin', 'editor')
    on conflict (baby_id, user_id, reminder_type) do nothing;
  end if;
  perform public.sync_care_reminder_state(new.baby_id, new.reminder_type);
  return new;
end;
$$;

drop trigger if exists care_reminder_settings_changed on public.care_reminder_settings;
create trigger care_reminder_settings_changed
  after insert or update on public.care_reminder_settings
  for each row execute function public.on_care_reminder_setting_changed();

create or replace function public.on_baby_member_care_reminder_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.permission_role in ('admin', 'editor')
     and exists (
       select 1 from public.care_reminder_settings s
       where s.baby_id = new.baby_id and s.reminder_type = 'feeding' and s.enabled
     ) then
    insert into public.care_reminder_member_preferences (
      baby_id, user_id, reminder_type, delivery_enabled, timezone
    ) values (new.baby_id, new.user_id, 'feeding', true, null)
    on conflict (baby_id, user_id, reminder_type) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists baby_members_care_reminder_default on public.baby_members;
create trigger baby_members_care_reminder_default
  after insert or update of status, permission_role on public.baby_members
  for each row execute function public.on_baby_member_care_reminder_default();

-- Worker-only atomic due claim. A stale claim may be retried after five minutes;
-- notification_events dedupe keys remain the final delivery guard.
create or replace function public.claim_due_care_reminders(p_limit integer default 50)
returns setof public.care_reminder_state
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select s.id
    from public.care_reminder_state s
    join public.care_reminder_settings cfg
      on cfg.baby_id = s.baby_id and cfg.reminder_type = s.reminder_type
    where s.reminder_type = 'feeding' and cfg.enabled
      and s.send_status = 'scheduled' and s.next_due_at <= now()
      and (s.processing_started_at is null or s.processing_started_at < now() - interval '5 minutes')
    order by s.next_due_at
    for update of s skip locked
    limit greatest(1, least(p_limit, 200))
  )
  update public.care_reminder_state s
  set processing_started_at = now(), updated_at = now()
  from due where s.id = due.id
  returning s.*;
end;
$$;

revoke all on function public.claim_due_care_reminders(integer) from public;
grant execute on function public.claim_due_care_reminders(integer) to service_role;

-- Recipient-level delivery outcome. The existing generic status column remains
-- unchanged so notification-center clients keep their pending/sent/failed/skipped
-- contract while the worker records an exact care-reminder outcome here.
alter table public.notification_events
  add column if not exists delivery_status text;
alter table public.notification_events
  drop constraint if exists notification_events_delivery_status_check;
alter table public.notification_events
  add constraint notification_events_delivery_status_check check (delivery_status is null or delivery_status in (
    'sent', 'skipped_quiet_hours', 'skipped_no_token',
    'skipped_permission_or_disabled', 'failed_retryable', 'failed_permanent'
  ));

-- Preserve both values allowed by the previous constraint and values already in
-- use. This avoids deleting a production event type merely because no row of that
-- type happened to exist when the migration ran.
do $$
declare
  v_event_types text[];
begin
  select array_agg(distinct event_type order by event_type) into v_event_types
  from (
    select unnest(array[
      'memory_comment', 'memory_reaction', 'growth_book_comment', 'growth_book_rolling_paper',
      'family_joined', 'diary_reminder', 'invite_request', 'invite_declined',
      'new_shared_log', 'new_diary', 'daily_summary', 'weekly_summary',
      'reminder', 'event', 'test', 'feeding_reminder'
    ]::text[]) as event_type
    union
    select event_type from public.notification_events
    union
    select (regexp_matches(
      pg_get_constraintdef(c.oid),
      '''([^'']+)''',
      'g'
    ))[1] as event_type
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'notification_events'
      and c.conname = 'notification_events_event_type_check'
  ) preserved;

  alter table public.notification_events
    drop constraint if exists notification_events_event_type_check;
  execute format(
    'alter table public.notification_events add constraint notification_events_event_type_check check (event_type = any (%L::text[])) not valid',
    v_event_types
  );
  alter table public.notification_events
    validate constraint notification_events_event_type_check;
end;
$$;

-- Avoid recreating reminder state while account deletion cascades through care logs.
-- Keep existing authorization, foreign keys, reminder scheduling, and Storage lifecycle.
begin;

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
  v_existing public.care_reminder_state;
  v_log_id uuid;
  v_log_at timestamptz;
  v_due_at timestamptz;
  v_status text;
  v_changed boolean;
begin
  if p_reminder_type not in ('feeding', 'sleep') then return; end if;

  -- A care_logs DELETE trigger also fires during babies ON DELETE CASCADE.
  -- The parent is already gone then; never recreate reminder state for it.
  -- Hold a key-share lock for a live baby so a concurrent parent deletion
  -- cannot invalidate the FK between this check and the reminder upsert.
  perform 1 from public.babies where id = p_baby_id for key share;
  if not found then return; end if;

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

  select l.id, public.care_reminder_log_at(p_reminder_type, l.recorded_at, l.payload)
    into v_log_id, v_log_at
  from public.care_logs l
  where l.baby_id = p_baby_id
    and (
      (p_reminder_type = 'feeding' and l.category = any(v_setting.included_log_types))
      or (p_reminder_type = 'sleep' and l.category = 'sleep')
    )
  order by public.care_reminder_log_at(p_reminder_type, l.recorded_at, l.payload) desc, l.id desc
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

  v_due_at := v_log_at + make_interval(mins => v_setting.interval_minutes);
  -- Backdated/overdue logs are intentionally never made due immediately.
  v_status := case when v_due_at <= now() then 'overdue_not_scheduled' else 'scheduled' end;
  v_changed := v_existing.id is null
    or v_existing.last_relevant_log_id is distinct from v_log_id
    or v_existing.last_relevant_log_at is distinct from v_log_at
    or v_existing.next_due_at is distinct from v_due_at
    or v_existing.send_status = 'disabled';
  if not v_changed then return; end if;

  insert into public.care_reminder_state (
    baby_id, reminder_type, last_relevant_log_id, last_relevant_log_at,
    next_due_at, version, send_status, last_sent_for_log_id, last_sent_at,
    processing_started_at
  ) values (
    p_baby_id, p_reminder_type, v_log_id, v_log_at, v_due_at,
    coalesce(v_existing.version, 0) + 1, v_status, null, null, null
  ) on conflict (baby_id, reminder_type) do update set
    last_relevant_log_id = excluded.last_relevant_log_id,
    last_relevant_log_at = excluded.last_relevant_log_at,
    next_due_at = excluded.next_due_at,
    version = public.care_reminder_state.version + 1,
    send_status = excluded.send_status,
    last_sent_for_log_id = null, last_sent_at = null,
    processing_started_at = null, updated_at = now();
end;
$$;

-- CREATE OR REPLACE preserves the existing service-only execution privileges.
commit;

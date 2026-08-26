-- Build 17 release candidate: extend the existing family-shared care reminder
-- pipeline to sleep logs and localize DB-created notification-center events.
-- Apply to QA first. Production requires a separate approval.

alter table public.profiles drop constraint if exists profiles_preferred_language_check;
alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language in ('system', 'ko', 'en', 'ja', 'es', 'zh-CN'));

drop index if exists public.care_reminder_state_due_idx;
create index care_reminder_state_due_idx
  on public.care_reminder_state (next_due_at)
  where reminder_type in ('feeding', 'sleep') and send_status = 'scheduled';

create or replace function public.care_reminder_log_at(
  p_reminder_type text,
  p_recorded_at timestamptz,
  p_payload jsonb
)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case
    when p_reminder_type in ('feeding', 'sleep')
      and coalesce(p_payload->>'duration', '') ~ '^([0-9]+([.][0-9]+)?)$'
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
  v_existing public.care_reminder_state;
  v_log_id uuid;
  v_log_at timestamptz;
  v_due_at timestamptz;
  v_status text;
  v_changed boolean;
begin
  if p_reminder_type not in ('feeding', 'sleep') then return; end if;

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

revoke all on function public.care_reminder_log_at(text, timestamptz, jsonb) from public;
revoke all on function public.sync_care_reminder_state(uuid, text) from public;
grant execute on function public.care_reminder_log_at(text, timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.sync_care_reminder_state(uuid, text) to service_role;

create or replace function public.on_care_log_sync_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  foreach v_type in array array['feeding', 'sleep']::text[] loop
    if tg_op = 'DELETE' then
      if (v_type = 'feeding' and old.category in ('breast', 'formula', 'storedMilk'))
        or (v_type = 'sleep' and old.category = 'sleep') then
        perform public.sync_care_reminder_state(old.baby_id, v_type);
      end if;
    elsif (v_type = 'feeding' and (new.category in ('breast', 'formula', 'storedMilk')
          or (tg_op = 'UPDATE' and old.category in ('breast', 'formula', 'storedMilk'))))
       or (v_type = 'sleep' and (new.category = 'sleep'
          or (tg_op = 'UPDATE' and old.category = 'sleep'))) then
      perform public.sync_care_reminder_state(new.baby_id, v_type);
      if tg_op = 'UPDATE' and old.baby_id <> new.baby_id then
        perform public.sync_care_reminder_state(old.baby_id, v_type);
      end if;
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists care_logs_sync_feeding_reminder on public.care_logs;
drop trigger if exists care_logs_sync_care_reminders on public.care_logs;
create trigger care_logs_sync_care_reminders
  after insert or update or delete on public.care_logs
  for each row execute function public.on_care_log_sync_reminders();

create or replace function public.on_care_reminder_setting_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reminder_type in ('feeding', 'sleep') and new.enabled then
    insert into public.care_reminder_member_preferences (
      baby_id, user_id, reminder_type, delivery_enabled, timezone
    )
    select new.baby_id, m.user_id, new.reminder_type, true, null
    from public.baby_members m
    where m.baby_id = new.baby_id and m.status = 'active'
      and m.permission_role in ('admin', 'editor')
    on conflict (baby_id, user_id, reminder_type) do nothing;
  end if;
  perform public.sync_care_reminder_state(new.baby_id, new.reminder_type);
  return new;
end;
$$;

create or replace function public.on_baby_member_care_reminder_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.permission_role in ('admin', 'editor') then
    insert into public.care_reminder_member_preferences (
      baby_id, user_id, reminder_type, delivery_enabled, timezone
    )
    select new.baby_id, new.user_id, s.reminder_type, true, null
    from public.care_reminder_settings s
    where s.baby_id = new.baby_id and s.reminder_type in ('feeding', 'sleep') and s.enabled
    on conflict (baby_id, user_id, reminder_type) do nothing;
  end if;
  return new;
end;
$$;

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
    where s.reminder_type in ('feeding', 'sleep') and cfg.enabled
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

do $$
declare
  v_event_types text[];
begin
  select array_agg(distinct event_type order by event_type) into v_event_types
  from (
    select unnest(array['memory_comment','memory_reaction','growth_book_comment','growth_book_rolling_paper',
      'family_joined','diary_reminder','invite_request','invite_declined','new_shared_log','new_diary',
      'daily_summary','weekly_summary','reminder','event','test','feeding_reminder','sleep_reminder']::text[]) event_type
    union select event_type from public.notification_events
    union select (regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g'))[1]
    from pg_constraint c
    where c.conrelid = 'public.notification_events'::regclass
      and c.conname = 'notification_events_event_type_check'
  ) preserved
  -- Avoid treating the quoted PostgreSQL array literal from a previously
  -- generated ANY ('{...}'::text[]) constraint as one event type on re-run.
  where event_type is not null
    and event_type !~ '^\{.*\}$';
  alter table public.notification_events drop constraint if exists notification_events_event_type_check;
  execute format('alter table public.notification_events add constraint notification_events_event_type_check check (event_type = any (%L::text[])) not valid', v_event_types);
  alter table public.notification_events validate constraint notification_events_event_type_check;
end;
$$;

-- DB/RPC-created notification-center events pass through this trigger. Edge
-- Functions still localize push copy independently so hidden-preview handling
-- remains recipient-specific.
create or replace function public.localize_notification_event_copy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locale text;
  v_copy jsonb;
begin
  select case when preferred_language in ('ko','en','ja','es','zh-CN') then preferred_language else 'ko' end
    into v_locale from public.profiles where id = new.recipient_id;
  v_locale := coalesce(v_locale, 'ko');
  v_copy := jsonb_build_object(
    'ko', jsonb_build_object(
      'invite_request', jsonb_build_array('새 공유 요청','새 가족 또는 친구 공유 요청이 도착했어요.'),
      'family_joined', jsonb_build_array('공유 요청이 수락됐어요','요청한 사용자가 공유에 참여했어요.'),
      'invite_declined', jsonb_build_array('공유 요청이 수락되지 않았어요','필요하면 새 요청을 보낼 수 있어요.'),
      'memory_comment', jsonb_build_array('새 댓글','공유한 추억에 새 댓글이 달렸어요.'),
      'memory_reaction', jsonb_build_array('새 반응','공유한 추억에 새 반응이 도착했어요.'),
      'feeding_reminder', jsonb_build_array('수유 기록 리마인더','수유 기록을 확인해볼 시간이에요. 마지막 기록을 기준으로 한 참고 알림이에요.'),
      'sleep_reminder', jsonb_build_array('수면 기록 리마인더','수면 기록을 확인해볼 시간이에요. 마지막 기록을 기준으로 한 참고 알림이에요.')
    ),
    'en', jsonb_build_object(
      'invite_request', jsonb_build_array('New sharing request','A new family or friend sharing request arrived.'),
      'family_joined', jsonb_build_array('Sharing request accepted','The invited person joined the shared space.'),
      'invite_declined', jsonb_build_array('Sharing request not accepted','You can send a new request if needed.'),
      'memory_comment', jsonb_build_array('New comment','Someone commented on a shared memory.'),
      'memory_reaction', jsonb_build_array('New reaction','A shared memory received a new reaction.'),
      'feeding_reminder', jsonb_build_array('Feeding log reminder','It may be time to review the feeding log. This is a reference reminder based on the last log.'),
      'sleep_reminder', jsonb_build_array('Sleep log reminder','It may be time to review the sleep log. This is a reference reminder based on the last log.')
    ),
    'ja', jsonb_build_object(
      'invite_request', jsonb_build_array('新しい共有リクエスト','家族または友だちから共有リクエストが届きました。'),
      'family_joined', jsonb_build_array('共有リクエストが承認されました','招待したユーザーが共有に参加しました。'),
      'invite_declined', jsonb_build_array('共有リクエストは承認されませんでした','必要に応じて新しいリクエストを送れます。'),
      'memory_comment', jsonb_build_array('新しいコメント','共有した思い出にコメントが届きました。'),
      'memory_reaction', jsonb_build_array('新しいリアクション','共有した思い出にリアクションが届きました。'),
      'feeding_reminder', jsonb_build_array('授乳記録のお知らせ','授乳記録を確認する時間です。最後の記録を基準にした参考通知です。'),
      'sleep_reminder', jsonb_build_array('睡眠記録のお知らせ','睡眠記録を確認する時間です。最後の記録を基準にした参考通知です。')
    ),
    'es', jsonb_build_object(
      'invite_request', jsonb_build_array('Nueva solicitud para compartir','Llegó una solicitud de un familiar o amigo.'),
      'family_joined', jsonb_build_array('Solicitud compartida aceptada','La persona invitada se unió al espacio compartido.'),
      'invite_declined', jsonb_build_array('Solicitud no aceptada','Puedes enviar otra solicitud si lo necesitas.'),
      'memory_comment', jsonb_build_array('Nuevo comentario','Hay un comentario nuevo en un recuerdo compartido.'),
      'memory_reaction', jsonb_build_array('Nueva reacción','Un recuerdo compartido recibió una reacción.'),
      'feeding_reminder', jsonb_build_array('Recordatorio de alimentación','Puede ser un buen momento para revisar el registro. Es un aviso orientativo basado en el último registro.'),
      'sleep_reminder', jsonb_build_array('Recordatorio de sueño','Puede ser un buen momento para revisar el registro. Es un aviso orientativo basado en el último registro.')
    ),
    'zh-CN', jsonb_build_object(
      'invite_request', jsonb_build_array('新的共享请求','收到了家人或朋友的共享请求。'),
      'family_joined', jsonb_build_array('共享请求已接受','受邀用户已加入共享空间。'),
      'invite_declined', jsonb_build_array('共享请求未被接受','如有需要，可以重新发送请求。'),
      'memory_comment', jsonb_build_array('新评论','共享回忆收到了新评论。'),
      'memory_reaction', jsonb_build_array('新互动','共享回忆收到了新互动。'),
      'feeding_reminder', jsonb_build_array('喂养记录提醒','可以查看一下喂养记录。这是根据上次记录提供的参考提醒。'),
      'sleep_reminder', jsonb_build_array('睡眠记录提醒','可以查看一下睡眠记录。这是根据上次记录提供的参考提醒。')
    )
  ) -> v_locale -> new.event_type;
  if v_copy is not null then
    new.title := v_copy->>0;
    new.body := v_copy->>1;
  end if;
  return new;
end;
$$;

drop trigger if exists notification_events_localize_copy on public.notification_events;
create trigger notification_events_localize_copy
  before insert on public.notification_events
  for each row execute function public.localize_notification_event_copy();

revoke all on function public.localize_notification_event_copy() from public;

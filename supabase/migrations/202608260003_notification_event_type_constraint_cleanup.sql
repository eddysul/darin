-- Forward-fix for Build 17 notification event type constraint parsing.
--
-- Earlier Build 17 migrations preserved a prior check constraint by extracting
-- quoted values from pg_get_constraintdef(). Once the constraint had been
-- rewritten as ANY ('{...}'::text[]), that extraction could retain the entire
-- PostgreSQL array literal as one additional allowed event type. No rows are
-- changed here. Canonical app event types and every type already used by an
-- existing row are preserved before the constraint is replaced and validated.

do $$
declare
  v_event_types text[];
begin
  select array_agg(distinct event_type order by event_type)
    into v_event_types
  from (
    select unnest(array[
      'memory_comment', 'memory_reaction', 'growth_book_comment', 'growth_book_rolling_paper',
      'family_joined', 'diary_reminder', 'invite_request', 'invite_declined',
      'new_shared_log', 'new_diary', 'daily_summary', 'weekly_summary',
      'reminder', 'event', 'test', 'feeding_reminder', 'sleep_reminder'
    ]::text[]) as event_type
    union
    select event_type
    from public.notification_events
  ) preserved
  where event_type is not null
    and event_type !~ '^\{.*\}$';

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

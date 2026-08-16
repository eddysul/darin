-- Build 13: complete the in-app Notification Center event contract.

alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check check (event_type in (
    'memory_comment',
    'memory_reaction',
    'growth_book_comment',
    'growth_book_rolling_paper',
    'family_joined',
    'diary_reminder',
    'invite_request',
    'new_shared_log',
    'new_diary',
    'daily_summary',
    'weekly_summary',
    'reminder',
    'event',
    'test'
  ));

create or replace function public.mark_notification_event_read(p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notification_events
  set read_at = coalesce(read_at, now())
  where id = p_event_id
    and recipient_id = auth.uid();
$$;

revoke all on function public.mark_notification_event_read(uuid) from public;
grant execute on function public.mark_notification_event_read(uuid) to authenticated;

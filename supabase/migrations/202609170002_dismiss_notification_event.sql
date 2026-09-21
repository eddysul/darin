-- Recipient inbox dismiss. Does not change B0.4c delivery ownership or dispatch.
create or replace function public.dismiss_notification_event(p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.notification_events
  where id = p_event_id
    and recipient_id = auth.uid();
$$;

revoke all on function public.dismiss_notification_event(uuid) from public;
grant execute on function public.dismiss_notification_event(uuid) to authenticated;

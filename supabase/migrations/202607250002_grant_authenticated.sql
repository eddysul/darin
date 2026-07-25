-- Fix: tables were created without grants for the authenticated role.
-- Without these, RLS policies never run — PostgREST returns 42501 permission denied.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.babies to authenticated;
grant select, insert, update, delete on table public.baby_members to authenticated;
grant select, insert, update, delete on table public.invite_codes to authenticated;
grant select, insert, update, delete on table public.care_logs to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.is_baby_member(uuid) to authenticated;
grant execute on function public.baby_permission(uuid) to authenticated;
grant execute on function public.can_edit_care_logs(uuid) to authenticated;
grant execute on function public.create_baby_with_owner(
  text, date, date, text, text, text, int, text, text, public.relationship_label
) to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Build 13: remove Supabase default table privileges from Darin ID requests.
-- Request creation and responses must go through the authenticated RPCs only.

revoke all privileges on table public.darin_invite_requests from anon;
revoke all privileges on table public.darin_invite_requests from authenticated;
grant select on table public.darin_invite_requests to authenticated;

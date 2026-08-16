-- Build 13: allow trusted server-side maintenance of Darin invite requests.
-- Client roles remain read-only and request mutations still go through RPCs.

grant select, update on table public.darin_invite_requests to service_role;

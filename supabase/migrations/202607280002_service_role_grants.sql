-- Server-only operations (Edge Functions and QA) use the Supabase secret key,
-- which maps to service_role. RLS bypass does not replace table privileges.
grant all on table public.profiles to service_role;
grant all on table public.babies to service_role;
grant all on table public.baby_members to service_role;
grant all on table public.invite_codes to service_role;
grant all on table public.care_logs to service_role;
grant all on table public.growth_records to service_role;
grant usage, select on all sequences in schema public to service_role;

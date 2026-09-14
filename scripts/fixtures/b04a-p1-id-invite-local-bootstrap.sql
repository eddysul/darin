-- Supplemental fixture for the B0.4a P1 ID-invite acceptance test.
-- The verifier loads b04a-p0-local-bootstrap.sql first.

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  actor_id uuid,
  baby_id uuid,
  event_type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  status text not null default 'pending',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists darin_id text;

create unique index notification_events_dedupe_uidx
  on public.notification_events (recipient_id, dedupe_key)
  where dedupe_key is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

insert into public.profiles (id, display_name, darin_id) values
  ('00000000-0000-4000-8000-000000000001', 'Admin', 'Admin#0001'),
  ('00000000-0000-4000-8000-000000000004', 'Receiver', 'Receiver#0004'),
  ('00000000-0000-4000-8000-000000000006', 'Second admin', 'AdminTwo#0006')
on conflict (id) do update
set darin_id = excluded.darin_id;

insert into public.baby_members (baby_id, user_id, permission_role, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000006',
  'admin',
  'active'
)
on conflict (baby_id, user_id) do update
set permission_role = excluded.permission_role, status = excluded.status;

-- Recreate the last pre-hardening function definition chain so the verifier
-- proves the vulnerable sequence before applying the new migration.

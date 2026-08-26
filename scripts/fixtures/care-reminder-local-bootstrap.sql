create extension if not exists pgcrypto;

create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.profiles (id uuid primary key, preferred_language text);
create table public.babies (id uuid primary key, name text not null);
create table public.baby_members (
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_role text not null,
  status text not null,
  primary key (baby_id, user_id)
);
create table public.care_logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  category text not null,
  recorded_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);
create index care_logs_baby_recorded_idx on public.care_logs (baby_id, recorded_at desc);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  actor_id uuid,
  baby_id uuid references public.babies(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_events_event_type_check check (
    event_type in ('test', 'legacy_allowed_no_rows', 'legacy_live')
  )
);
create unique index notification_events_dedupe_uidx
  on public.notification_events (recipient_id, dedupe_key) where dedupe_key is not null;
insert into public.notification_events (recipient_id, event_type, title)
values ('00000000-0000-0000-0000-000000000001', 'legacy_live', 'legacy');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.is_baby_member(p_baby_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_members
    where baby_id = p_baby_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.baby_permission(p_baby_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select permission_role from public.baby_members
  where baby_id = p_baby_id and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

grant usage on schema public, auth to authenticated, service_role;
grant select on public.baby_members to authenticated;

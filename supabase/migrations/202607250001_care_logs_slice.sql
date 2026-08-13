-- CareLog vertical slice (profiles / babies / baby_members / invite_codes / care_logs)
-- Apply in Supabase SQL Editor. Build 12 requires a signed-in account; do not enable Anonymous sign-ins.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.permission_role as enum ('admin', 'editor', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.relationship_label as enum (
    '엄마', '아빠', '보호자', '가족', '시터', '할머니', '할아버지', '기타'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.member_status as enum ('pending', 'active', 'inactive');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  preferred_language text not null default 'ko',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date,
  due_date date,
  child_status text not null default 'newborn',
  gender text,
  photo_url text,
  gestational_age_weeks int,
  birth_weight text,
  special_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.baby_members (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission_role public.permission_role not null default 'editor',
  relationship_label public.relationship_label not null default '가족',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, user_id)
);

create index if not exists baby_members_user_id_idx on public.baby_members (user_id);
create index if not exists baby_members_baby_id_idx on public.baby_members (baby_id);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  code text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  permission_role public.permission_role not null default 'editor',
  relationship_label public.relationship_label not null default '가족',
  expires_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  -- Dedup / migration key (app-local id). Unique per baby when set.
  client_generated_id text,
  category text not null,
  recorded_at timestamptz not null,
  date_key text not null,
  time_local text not null,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, client_generated_id)
);

create index if not exists care_logs_baby_recorded_idx
  on public.care_logs (baby_id, recorded_at desc);
create index if not exists care_logs_baby_date_key_idx
  on public.care_logs (baby_id, date_key);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists babies_set_updated_at on public.babies;
create trigger babies_set_updated_at
  before update on public.babies
  for each row execute function public.set_updated_at();

drop trigger if exists baby_members_set_updated_at on public.baby_members;
create trigger baby_members_set_updated_at
  before update on public.baby_members
  for each row execute function public.set_updated_at();

drop trigger if exists invite_codes_set_updated_at on public.invite_codes;
create trigger invite_codes_set_updated_at
  before update on public.invite_codes
  for each row execute function public.set_updated_at();

drop trigger if exists care_logs_set_updated_at on public.care_logs;
create trigger care_logs_set_updated_at
  before update on public.care_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_baby_member(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.baby_members m
    where m.baby_id = p_baby_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.baby_permission(p_baby_id uuid)
returns public.permission_role
language sql
stable
security definer
set search_path = public
as $$
  select m.permission_role
  from public.baby_members m
  where m.baby_id = p_baby_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.can_edit_care_logs(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.baby_permission(p_baby_id) in ('admin', 'editor'), false);
$$;

revoke all on function public.is_baby_member(uuid) from public;
revoke all on function public.baby_permission(uuid) from public;
revoke all on function public.can_edit_care_logs(uuid) from public;
grant execute on function public.is_baby_member(uuid) to authenticated;
grant execute on function public.baby_permission(uuid) to authenticated;
grant execute on function public.can_edit_care_logs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.babies enable row level security;
alter table public.baby_members enable row level security;
alter table public.invite_codes enable row level security;
alter table public.care_logs enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- babies
drop policy if exists babies_select_member on public.babies;
create policy babies_select_member on public.babies
  for select to authenticated
  using (public.is_baby_member(id));

drop policy if exists babies_insert_authenticated on public.babies;
create policy babies_insert_authenticated on public.babies
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists babies_update_admin on public.babies;
create policy babies_update_admin on public.babies
  for update to authenticated
  using (public.baby_permission(id) = 'admin')
  with check (public.baby_permission(id) = 'admin');

drop policy if exists babies_delete_admin on public.babies;
create policy babies_delete_admin on public.babies
  for delete to authenticated
  using (public.baby_permission(id) = 'admin');

-- baby_members
drop policy if exists baby_members_select_same_baby on public.baby_members;
create policy baby_members_select_same_baby on public.baby_members
  for select to authenticated
  using (public.is_baby_member(baby_id));

-- Only admins can invite others. First owner row is created via create_baby_with_owner RPC.
drop policy if exists baby_members_insert_self_or_admin on public.baby_members;
create policy baby_members_insert_admin on public.baby_members
  for insert to authenticated
  with check (public.baby_permission(baby_id) = 'admin');

-- Atomically create baby + admin membership (avoids RLS chicken-and-egg)
create or replace function public.create_baby_with_owner(
  p_name text,
  p_birth_date date default null,
  p_due_date date default null,
  p_child_status text default 'newborn',
  p_gender text default null,
  p_photo_url text default null,
  p_gestational_age_weeks int default null,
  p_birth_weight text default null,
  p_special_notes text default null,
  p_relationship_label public.relationship_label default '가족'
)
returns public.babies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baby public.babies;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.babies (
    name, birth_date, due_date, child_status, gender, photo_url,
    gestational_age_weeks, birth_weight, special_notes, created_by
  ) values (
    p_name, p_birth_date, p_due_date, coalesce(p_child_status, 'newborn'), p_gender, p_photo_url,
    p_gestational_age_weeks, p_birth_weight, p_special_notes, auth.uid()
  )
  returning * into v_baby;

  insert into public.baby_members (baby_id, user_id, permission_role, relationship_label, status)
  values (v_baby.id, auth.uid(), 'admin', p_relationship_label, 'active');

  return v_baby;
end;
$$;

grant execute on function public.create_baby_with_owner(
  text, date, date, text, text, text, int, text, text, public.relationship_label
) to authenticated;

drop policy if exists baby_members_update_admin on public.baby_members;
create policy baby_members_update_admin on public.baby_members
  for update to authenticated
  using (public.baby_permission(baby_id) = 'admin')
  with check (public.baby_permission(baby_id) = 'admin');

drop policy if exists baby_members_delete_admin on public.baby_members;
create policy baby_members_delete_admin on public.baby_members
  for delete to authenticated
  using (public.baby_permission(baby_id) = 'admin');

-- invite_codes
drop policy if exists invite_codes_select_member on public.invite_codes;
create policy invite_codes_select_member on public.invite_codes
  for select to authenticated
  using (public.is_baby_member(baby_id));

drop policy if exists invite_codes_insert_admin on public.invite_codes;
create policy invite_codes_insert_admin on public.invite_codes
  for insert to authenticated
  with check (public.baby_permission(baby_id) = 'admin');

drop policy if exists invite_codes_update_admin on public.invite_codes;
create policy invite_codes_update_admin on public.invite_codes
  for update to authenticated
  using (public.baby_permission(baby_id) = 'admin')
  with check (public.baby_permission(baby_id) = 'admin');

-- care_logs
drop policy if exists care_logs_select_member on public.care_logs;
create policy care_logs_select_member on public.care_logs
  for select to authenticated
  using (public.is_baby_member(baby_id));

drop policy if exists care_logs_insert_editor on public.care_logs;
create policy care_logs_insert_editor on public.care_logs
  for insert to authenticated
  with check (public.can_edit_care_logs(baby_id));

drop policy if exists care_logs_update_editor on public.care_logs;
create policy care_logs_update_editor on public.care_logs
  for update to authenticated
  using (public.can_edit_care_logs(baby_id))
  with check (public.can_edit_care_logs(baby_id));

drop policy if exists care_logs_delete_editor on public.care_logs;
create policy care_logs_delete_editor on public.care_logs
  for delete to authenticated
  using (public.can_edit_care_logs(baby_id));

-- Table privileges (RLS alone is not enough)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.babies to authenticated;
grant select, insert, update, delete on table public.baby_members to authenticated;
grant select, insert, update, delete on table public.invite_codes to authenticated;
grant select, insert, update, delete on table public.care_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

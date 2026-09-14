create extension if not exists pgcrypto;
create schema if not exists auth;
create role authenticated nologin;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create type public.permission_role as enum ('admin', 'editor', 'viewer');
create type public.relationship_label as enum ('가족', '친구');

create table public.profiles (
  id uuid primary key,
  display_name text,
  nickname text,
  default_relation text,
  updated_at timestamptz default now()
);

create table public.babies (
  id uuid primary key,
  name text not null
);

create table public.baby_members (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id),
  user_id uuid not null references public.profiles(id),
  permission_role public.permission_role not null,
  relationship_label public.relationship_label not null default '가족',
  status text not null default 'active',
  display_name_override text,
  unique (baby_id, user_id)
);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references public.babies(id),
  code text not null unique,
  created_by uuid references public.profiles(id),
  invite_type text not null,
  permission_role public.permission_role not null,
  relationship_label public.relationship_label not null,
  expires_at timestamptz,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  revoked_at timestamptz
);

create table public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  status text not null,
  accepted_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memory_friends (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id),
  user_id uuid not null references public.profiles(id),
  invited_by uuid references public.profiles(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, user_id)
);

create table public.memory_posts (
  id uuid primary key,
  baby_id uuid not null references public.babies(id),
  author_id uuid references public.profiles(id),
  deleted_at timestamptz
);

create table public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_post_id uuid not null references public.memory_posts(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  storage_path text not null unique
);

create or replace function public.baby_permission(p_baby_id uuid)
returns public.permission_role
language sql
stable
security definer
set search_path = public
as $$
  select bm.permission_role
  from public.baby_members bm
  where bm.baby_id = p_baby_id
    and bm.user_id = auth.uid()
    and bm.status = 'active'
  limit 1;
$$;

create or replace function public.can_manage_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts mp
    where mp.id = p_memory_post_id
      and mp.deleted_at is null
      and (
        mp.author_id = auth.uid()
        or public.baby_permission(mp.baby_id) = 'admin'::public.permission_role
      )
  );
$$;

create or replace function public.can_view_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_memory_post(p_memory_post_id);
$$;

alter table public.memory_media enable row level security;

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function public.baby_permission(uuid) to authenticated;
grant execute on function public.can_manage_memory_post(uuid) to authenticated;
grant execute on function public.can_view_memory_post(uuid) to authenticated;

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Admin'),
  ('00000000-0000-4000-8000-000000000002', 'Outsider'),
  ('00000000-0000-4000-8000-000000000003', 'Friend'),
  ('00000000-0000-4000-8000-000000000004', 'Receiver'),
  ('00000000-0000-4000-8000-000000000005', 'Race receiver');

insert into public.babies (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Protected baby'),
  ('10000000-0000-4000-8000-000000000002', 'Attacker baby');

insert into public.baby_members (baby_id, user_id, permission_role, status) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'admin', 'active');

insert into public.user_friendships (requester_id, receiver_id, status, accepted_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'accepted', now());

insert into public.memory_posts (id, baby_id, author_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002');

-- Simulate a historical row created through the former tautological policy.
insert into public.memory_media (id, memory_post_id, baby_id, storage_path) values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001/temp/40000000-0000-4000-8000-000000000001/private.jpg'
);

insert into public.invite_codes (
  id, baby_id, code, created_by, invite_type, permission_role,
  relationship_label, max_uses, used_count
) values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'DARIN-STALE',
  '00000000-0000-4000-8000-000000000001',
  'family', 'editor', '가족', 1, 0
), (
  '50000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'DARIN-RACE',
  '00000000-0000-4000-8000-000000000001',
  'family', 'editor', '가족', 1, 0
);

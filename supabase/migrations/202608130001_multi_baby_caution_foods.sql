-- Build 12: baby-scoped caution foods. Apply only after review; this migration is non-destructive.
alter table public.memory_posts
  add column if not exists is_family_moment boolean not null default false;

create table if not exists public.baby_caution_foods (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  food_name text not null check (char_length(btrim(food_name)) between 1 and 40),
  normalized_food_name text not null check (char_length(btrim(normalized_food_name)) between 1 and 40),
  source text not null default 'custom' check (source in ('preset', 'custom')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists baby_caution_foods_active_name_uidx
  on public.baby_caution_foods (baby_id, normalized_food_name)
  where archived_at is null;
create index if not exists baby_caution_foods_baby_idx
  on public.baby_caution_foods (baby_id, created_at) where archived_at is null;

alter table public.baby_caution_foods enable row level security;

create policy baby_caution_foods_select_member on public.baby_caution_foods
  for select to authenticated using (public.is_baby_member(baby_id));
create policy baby_caution_foods_insert_member on public.baby_caution_foods
  for insert to authenticated with check (
    public.is_baby_member(baby_id) and created_by = auth.uid()
  );
create policy baby_caution_foods_update_member on public.baby_caution_foods
  for update to authenticated using (public.is_baby_member(baby_id))
  with check (public.is_baby_member(baby_id));
create policy baby_caution_foods_delete_admin on public.baby_caution_foods
  for delete to authenticated using (public.baby_permission(baby_id) = 'admin');

grant select, insert, update on table public.baby_caution_foods to authenticated;
grant all on table public.baby_caution_foods to service_role;

-- Multi-baby Memory tags are labels only and never grant access. The author must
-- already be a member of every baby attached to a post.
drop policy if exists memory_tags_insert_manager on public.memory_tags;
create policy memory_tags_insert_manager on public.memory_tags
  for insert to authenticated with check (
    created_by = auth.uid()
    and public.can_manage_memory_post(memory_post_id)
    and (
      tag_type <> 'baby'
      or (baby_id is not null and public.is_baby_member(baby_id))
    )
  );

-- Rollback (only before product data exists):
-- drop table public.baby_caution_foods;
-- alter table public.memory_posts drop column if exists is_family_moment;
-- drop policy if exists memory_tags_insert_manager on public.memory_tags;
-- create policy memory_tags_insert_manager on public.memory_tags
--   for insert to authenticated
--   with check (created_by = auth.uid() and public.can_manage_memory_post(memory_post_id));

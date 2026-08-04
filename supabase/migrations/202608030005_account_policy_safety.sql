-- Phase 5: account deletion safety and authenticated support requests.
-- Shared baby content is preserved with nullable authorship. Solo-baby rows
-- continue to cascade from babies; media objects are removed by delete-account.

alter table public.diary_entries alter column author_id drop not null;
alter table public.diary_entries drop constraint if exists diary_entries_author_id_fkey;
alter table public.diary_entries add constraint diary_entries_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.memory_posts alter column author_id drop not null;
alter table public.memory_posts drop constraint if exists memory_posts_author_id_fkey;
alter table public.memory_posts add constraint memory_posts_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.memory_tags alter column created_by drop not null;
alter table public.memory_tags drop constraint if exists memory_tags_created_by_fkey;
alter table public.memory_tags add constraint memory_tags_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.memory_comments alter column author_id drop not null;
alter table public.memory_comments drop constraint if exists memory_comments_author_id_fkey;
alter table public.memory_comments add constraint memory_comments_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.growth_books alter column created_by drop not null;
alter table public.growth_books drop constraint if exists growth_books_created_by_fkey;
alter table public.growth_books add constraint growth_books_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.growth_book_pages alter column created_by drop not null;
alter table public.growth_book_pages drop constraint if exists growth_book_pages_created_by_fkey;
alter table public.growth_book_pages add constraint growth_book_pages_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.growth_book_media alter column created_by drop not null;
alter table public.growth_book_media drop constraint if exists growth_book_media_created_by_fkey;
alter table public.growth_book_media add constraint growth_book_media_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.growth_book_comments alter column author_id drop not null;
alter table public.growth_book_comments drop constraint if exists growth_book_comments_author_id_fkey;
alter table public.growth_book_comments add constraint growth_book_comments_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete set null;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text check (email is null or char_length(email) <= 320),
  category text check (category in ('bug', 'account', 'data', 'family', 'feedback', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  app_version text,
  build_number text,
  device_info jsonb,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists contact_requests_user_created_idx
  on public.contact_requests (user_id, created_at desc) where user_id is not null;

alter table public.contact_requests enable row level security;
drop policy if exists contact_requests_insert_own on public.contact_requests;
create policy contact_requests_insert_own on public.contact_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'open');
drop policy if exists contact_requests_select_own on public.contact_requests;
create policy contact_requests_select_own on public.contact_requests for select to authenticated
  using (user_id = auth.uid());

grant select, insert on public.contact_requests to authenticated;
grant all on public.contact_requests to service_role;

create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- A baby with no other active member belongs only to this account.
  delete from public.babies b
  where exists (
    select 1 from public.baby_members own_membership
    where own_membership.baby_id = b.id and own_membership.user_id = v_user_id
  )
  and not exists (
    select 1 from public.baby_members other_membership
    where other_membership.baby_id = b.id
      and other_membership.user_id <> v_user_id
      and other_membership.status = 'active'
  );

  -- Shared family rows remain, while direct identity fields are anonymized.
  update public.babies set created_by = null where created_by = v_user_id;
  update public.care_logs set created_by = null where created_by = v_user_id;
  update public.growth_records set created_by = null where created_by = v_user_id;
  update public.invite_codes set created_by = null where created_by = v_user_id;
  update public.invite_codes set used_by = null where used_by = v_user_id;
  update public.notification_events set actor_id = null where actor_id = v_user_id;
  update public.contact_requests set user_id = null where user_id = v_user_id;

  delete from public.push_tokens where user_id = v_user_id;
  delete from public.notification_settings where user_id = v_user_id;
  delete from public.notification_events where recipient_id = v_user_id;
  delete from public.baby_members where user_id = v_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;

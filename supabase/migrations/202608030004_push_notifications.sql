-- Phase 4: push notification tokens, preferences and delivery audit log.
-- Sending remains service-role only (Supabase Edge Function); mobile clients never read other users' tokens.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null check (nullif(btrim(device_id), '') is not null),
  expo_push_token text not null check (expo_push_token ~ '^ExponentPushToken\[[^]]+\]$|^ExpoPushToken\[[^]]+\]$'),
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  build_number text,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id),
  unique (expo_push_token)
);

create index if not exists push_tokens_active_user_idx
  on public.push_tokens (user_id, last_seen_at desc) where disabled_at is null;

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  baby_id uuid references public.babies (id) on delete cascade,
  diary_reminder_enabled boolean not null default false,
  diary_reminder_time time not null default '21:00',
  timezone text not null default 'UTC',
  family_activity_enabled boolean not null default true,
  invite_activity_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  show_preview boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_settings_user_global_uidx
  on public.notification_settings (user_id) where baby_id is null;
create unique index if not exists notification_settings_user_baby_uidx
  on public.notification_settings (user_id, baby_id) where baby_id is not null;
create index if not exists notification_settings_baby_idx
  on public.notification_settings (baby_id, user_id) where baby_id is not null;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  baby_id uuid references public.babies (id) on delete cascade,
  event_type text not null check (event_type in (
    'memory_comment', 'memory_reaction', 'growth_book_comment', 'growth_book_rolling_paper',
    'family_joined', 'diary_reminder', 'test'
  )),
  title text not null check (nullif(btrim(title), '') is not null),
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_events_recipient_created_idx
  on public.notification_events (recipient_id, created_at desc);
create index if not exists notification_events_baby_created_idx
  on public.notification_events (baby_id, created_at desc) where baby_id is not null;
create unique index if not exists notification_events_dedupe_uidx
  on public.notification_events (recipient_id, dedupe_key) where dedupe_key is not null;

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();
drop trigger if exists notification_settings_set_updated_at on public.notification_settings;
create trigger notification_settings_set_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();
drop trigger if exists notification_events_set_updated_at on public.notification_events;
create trigger notification_events_set_updated_at before update on public.notification_events
  for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated
  using (user_id = auth.uid());
drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens for insert to authenticated
  with check (user_id = auth.uid() and disabled_at is null);
drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own on public.push_tokens for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_settings_select_own on public.notification_settings;
create policy notification_settings_select_own on public.notification_settings for select to authenticated
  using (user_id = auth.uid() and (baby_id is null or public.is_baby_member(baby_id)));
drop policy if exists notification_settings_insert_own on public.notification_settings;
create policy notification_settings_insert_own on public.notification_settings for insert to authenticated
  with check (user_id = auth.uid() and (baby_id is null or public.is_baby_member(baby_id)));
drop policy if exists notification_settings_update_own on public.notification_settings;
create policy notification_settings_update_own on public.notification_settings for update to authenticated
  using (user_id = auth.uid() and (baby_id is null or public.is_baby_member(baby_id)))
  with check (user_id = auth.uid() and (baby_id is null or public.is_baby_member(baby_id)));
drop policy if exists notification_settings_delete_own on public.notification_settings;
create policy notification_settings_delete_own on public.notification_settings for delete to authenticated
  using (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies by design: only service_role/Edge Functions create delivery events.
drop policy if exists notification_events_select_recipient on public.notification_events;
create policy notification_events_select_recipient on public.notification_events for select to authenticated
  using (recipient_id = auth.uid());

grant select, insert, update, delete on table public.push_tokens to authenticated;
grant select, insert, update, delete on table public.notification_settings to authenticated;
grant select on table public.notification_events to authenticated;
grant all on table public.push_tokens to service_role;
grant all on table public.notification_settings to service_role;
grant all on table public.notification_events to service_role;

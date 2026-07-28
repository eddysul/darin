-- Growth records vertical slice. Requires the care_logs slice helpers/tables.

create table if not exists public.growth_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  -- Stable local id used by the one-time AsyncStorage migration.
  client_generated_id text,
  measured_at date not null,
  weight_kg numeric,
  height_cm numeric,
  head_circumference_cm numeric,
  source text not null default 'hospital'
    check (source in ('hospital', 'home')),
  input_method text not null default 'manual'
    check (input_method in ('manual', 'ai_extract')),
  user_confirmed boolean not null default true,
  confidence jsonb,
  original_text jsonb,
  note text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, client_generated_id)
);

create index if not exists growth_records_baby_measured_idx
  on public.growth_records (baby_id, measured_at desc, created_at desc);

drop trigger if exists growth_records_set_updated_at on public.growth_records;
create trigger growth_records_set_updated_at
  before update on public.growth_records
  for each row execute function public.set_updated_at();

create or replace function public.can_edit_growth_records(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.baby_permission(p_baby_id) in ('admin', 'editor'), false);
$$;

revoke all on function public.can_edit_growth_records(uuid) from public;
grant execute on function public.can_edit_growth_records(uuid) to authenticated;

alter table public.growth_records enable row level security;

drop policy if exists growth_records_select_member on public.growth_records;
create policy growth_records_select_member on public.growth_records
  for select to authenticated
  using (public.is_baby_member(baby_id));

drop policy if exists growth_records_insert_editor on public.growth_records;
create policy growth_records_insert_editor on public.growth_records
  for insert to authenticated
  with check (
    public.can_edit_growth_records(baby_id)
    and created_by = auth.uid()
  );

drop policy if exists growth_records_update_editor on public.growth_records;
create policy growth_records_update_editor on public.growth_records
  for update to authenticated
  using (public.can_edit_growth_records(baby_id))
  with check (public.can_edit_growth_records(baby_id));

drop policy if exists growth_records_delete_editor on public.growth_records;
create policy growth_records_delete_editor on public.growth_records
  for delete to authenticated
  using (public.can_edit_growth_records(baby_id));

grant select, insert, update, delete on table public.growth_records to authenticated;
grant all on table public.growth_records to service_role;

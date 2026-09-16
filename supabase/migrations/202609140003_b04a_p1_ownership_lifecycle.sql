-- B0.4a-2: ownership and current-membership lifecycle hardening.
--
-- Write authorization is evaluated against the live membership row and holds
-- that row locked through the statement. Admins may manage all rows in their
-- baby; editors may manage only rows they authored. Viewers and former members
-- never retain author-based mutation privileges.

create or replace function public.current_baby_write_permission(p_baby_id uuid)
returns public.permission_role
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_permission public.permission_role;
begin
  if auth.uid() is null or p_baby_id is null then
    return null;
  end if;

  select member_row.permission_role
  into v_permission
  from public.baby_members as member_row
  where member_row.baby_id = p_baby_id
    and member_row.user_id = auth.uid()
    and member_row.status::text is not distinct from 'active'
  for update;

  return v_permission;
end;
$$;

revoke all on function public.current_baby_write_permission(uuid) from public;
grant execute on function public.current_baby_write_permission(uuid) to authenticated;

create or replace function public.can_manage_care_log(p_care_log_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_logs as care_row
    cross join lateral (
      select public.current_baby_write_permission(care_row.baby_id) as permission_role
    ) as current_scope
    where care_row.id = p_care_log_id
      and (
        current_scope.permission_role is not distinct from 'admin'::public.permission_role
        or (
          current_scope.permission_role is not distinct from 'editor'::public.permission_role
          and care_row.created_by is not null
          and care_row.created_by = auth.uid()
        )
      )
  );
$$;

create or replace function public.care_log_identity_unchanged(
  p_id uuid,
  p_baby_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_logs as original_row
    where original_row.id = p_id
      and original_row.baby_id is not distinct from p_baby_id
      and original_row.created_by is not distinct from p_created_by
  );
$$;

revoke all on function public.can_manage_care_log(uuid) from public;
revoke all on function public.care_log_identity_unchanged(uuid, uuid, uuid) from public;
grant execute on function public.can_manage_care_log(uuid) to authenticated;
grant execute on function public.care_log_identity_unchanged(uuid, uuid, uuid) to authenticated;

drop policy if exists care_logs_insert_editor on public.care_logs;
create policy care_logs_insert_editor on public.care_logs
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.current_baby_write_permission(baby_id)
      in ('admin'::public.permission_role, 'editor'::public.permission_role)
  );

drop policy if exists care_logs_update_editor on public.care_logs;
create policy care_logs_update_editor on public.care_logs
  for update to authenticated
  using (public.can_manage_care_log(id))
  with check (
    public.care_log_identity_unchanged(id, baby_id, created_by)
    and (
      public.current_baby_write_permission(baby_id)
        is not distinct from 'admin'::public.permission_role
      or (
        public.current_baby_write_permission(baby_id)
          is not distinct from 'editor'::public.permission_role
        and created_by is not null
        and created_by = auth.uid()
      )
    )
  );

drop policy if exists care_logs_delete_editor on public.care_logs;
create policy care_logs_delete_editor on public.care_logs
  for delete to authenticated
  using (public.can_manage_care_log(id));

create or replace function public.can_manage_growth_record(p_growth_record_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.growth_records as growth_row
    cross join lateral (
      select public.current_baby_write_permission(growth_row.baby_id) as permission_role
    ) as current_scope
    where growth_row.id = p_growth_record_id
      and (
        current_scope.permission_role is not distinct from 'admin'::public.permission_role
        or (
          current_scope.permission_role is not distinct from 'editor'::public.permission_role
          and growth_row.created_by is not null
          and growth_row.created_by = auth.uid()
        )
      )
  );
$$;

create or replace function public.growth_record_identity_unchanged(
  p_id uuid,
  p_baby_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.growth_records as original_row
    where original_row.id = p_id
      and original_row.baby_id is not distinct from p_baby_id
      and original_row.created_by is not distinct from p_created_by
  );
$$;

revoke all on function public.can_manage_growth_record(uuid) from public;
revoke all on function public.growth_record_identity_unchanged(uuid, uuid, uuid) from public;
grant execute on function public.can_manage_growth_record(uuid) to authenticated;
grant execute on function public.growth_record_identity_unchanged(uuid, uuid, uuid) to authenticated;

drop policy if exists growth_records_insert_editor on public.growth_records;
create policy growth_records_insert_editor on public.growth_records
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.current_baby_write_permission(baby_id)
      in ('admin'::public.permission_role, 'editor'::public.permission_role)
  );

drop policy if exists growth_records_update_editor on public.growth_records;
create policy growth_records_update_editor on public.growth_records
  for update to authenticated
  using (public.can_manage_growth_record(id))
  with check (
    public.growth_record_identity_unchanged(id, baby_id, created_by)
    and (
      public.current_baby_write_permission(baby_id)
        is not distinct from 'admin'::public.permission_role
      or (
        public.current_baby_write_permission(baby_id)
          is not distinct from 'editor'::public.permission_role
        and created_by is not null
        and created_by = auth.uid()
      )
    )
  );

drop policy if exists growth_records_delete_editor on public.growth_records;
create policy growth_records_delete_editor on public.growth_records
  for delete to authenticated
  using (public.can_manage_growth_record(id));

create or replace function public.can_manage_diary_entry(p_diary_entry_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.diary_entries as diary_row
    cross join lateral (
      select public.current_baby_write_permission(diary_row.baby_id) as permission_role
    ) as current_scope
    where diary_row.id = p_diary_entry_id
      and diary_row.deleted_at is null
      and (
        current_scope.permission_role is not distinct from 'admin'::public.permission_role
        or (
          current_scope.permission_role is not distinct from 'editor'::public.permission_role
          and diary_row.author_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_manage_diary_entry(uuid) from public;
grant execute on function public.can_manage_diary_entry(uuid) to authenticated;

drop policy if exists diary_entries_insert_admin_editor on public.diary_entries;
create policy diary_entries_insert_admin_editor on public.diary_entries
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.current_baby_write_permission(baby_id)
      in ('admin'::public.permission_role, 'editor'::public.permission_role)
  );

drop policy if exists diary_entries_update_author_admin on public.diary_entries;
create policy diary_entries_update_author_admin on public.diary_entries
  for update to authenticated
  using (public.can_manage_diary_entry(id))
  with check (
    deleted_at is null
    and (
      public.current_baby_write_permission(baby_id)
        is not distinct from 'admin'::public.permission_role
      or (
        public.current_baby_write_permission(baby_id)
          is not distinct from 'editor'::public.permission_role
        and author_id = auth.uid()
      )
    )
  );

create or replace function public.can_manage_memory_post(p_memory_post_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts as post_row
    cross join lateral (
      select public.current_baby_write_permission(post_row.baby_id) as permission_role
    ) as current_scope
    where post_row.id = p_memory_post_id
      and post_row.deleted_at is null
      and (
        current_scope.permission_role is not distinct from 'admin'::public.permission_role
        or (
          current_scope.permission_role is not distinct from 'editor'::public.permission_role
          and post_row.author_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_delete_memory_post(p_memory_post_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select public.can_manage_memory_post(p_memory_post_id);
$$;

revoke all on function public.can_manage_memory_post(uuid) from public;
revoke all on function public.can_delete_memory_post(uuid) from public;
grant execute on function public.can_manage_memory_post(uuid) to authenticated;
grant execute on function public.can_delete_memory_post(uuid) to authenticated;

drop policy if exists memory_posts_insert_editor on public.memory_posts;
create policy memory_posts_insert_editor on public.memory_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.current_baby_write_permission(baby_id)
      in ('admin'::public.permission_role, 'editor'::public.permission_role)
    and deleted_at is null
  );

drop policy if exists memory_posts_update_author_or_admin on public.memory_posts;
create policy memory_posts_update_author_or_admin on public.memory_posts
  for update to authenticated
  using (public.can_manage_memory_post(id))
  with check (
    deleted_at is null
    and (
      public.current_baby_write_permission(baby_id)
        is not distinct from 'admin'::public.permission_role
      or (
        public.current_baby_write_permission(baby_id)
          is not distinct from 'editor'::public.permission_role
        and author_id = auth.uid()
      )
    )
  );

drop policy if exists memory_posts_delete_author_or_admin on public.memory_posts;
create policy memory_posts_delete_author_or_admin on public.memory_posts
  for delete to authenticated
  using (public.can_delete_memory_post(id));

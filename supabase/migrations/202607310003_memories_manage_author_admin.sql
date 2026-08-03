-- Phase 2E: Memories manage/edit hardening
-- Editor may create own posts and comment/react on visible posts,
-- but cannot update/delete another member's memory_post.
-- Soft-delete remains author OR baby admin (unchanged via can_delete_memory_post).

create or replace function public.can_manage_memory_post(p_memory_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_posts p
    where p.id = p_memory_post_id
      and p.deleted_at is null
      and (
        p.author_id = auth.uid()
        or public.baby_permission(p.baby_id) = 'admin'
      )
  );
$$;

revoke all on function public.can_manage_memory_post(uuid) from public;
grant execute on function public.can_manage_memory_post(uuid) to authenticated;

-- Align UPDATE policy with author/admin manage helper (drop legacy editor path).
drop policy if exists memory_posts_update_author_or_editor on public.memory_posts;
drop policy if exists memory_posts_update_author_or_admin on public.memory_posts;
create policy memory_posts_update_author_or_admin on public.memory_posts
  for update to authenticated
  using (
    deleted_at is null
    and (
      author_id = auth.uid()
      or public.baby_permission(baby_id) = 'admin'
    )
  )
  with check (
    deleted_at is null
    and (
      author_id = auth.uid()
      or public.baby_permission(baby_id) = 'admin'
    )
  );

-- Keep hard DELETE restricted to can_delete_memory_post (author or admin).
drop policy if exists memory_posts_delete_author_or_admin on public.memory_posts;
create policy memory_posts_delete_author_or_admin on public.memory_posts
  for delete to authenticated
  using (public.can_delete_memory_post(id));

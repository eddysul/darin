-- Historical memory author identity for viewers who can already see the post.
-- Authorization stays on can_view_memory_post (current relationship).
-- Display does not require the author to still hold active family/friend membership.

create or replace function public.list_memory_author_display(p_user_ids uuid[])
returns table (
  user_id uuid,
  display_name text,
  avatar_storage_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile_row.id,
    profile_row.display_name,
    profile_row.avatar_storage_path
  from public.profiles as profile_row
  where profile_row.id = any(coalesce(p_user_ids, '{}'::uuid[]))
    and (
      profile_row.id = auth.uid()
      or exists (
        select 1
        from public.memory_posts as post_row
        where post_row.author_id = profile_row.id
          and post_row.deleted_at is null
          and public.can_view_memory_post(post_row.id)
      )
      or exists (
        select 1
        from public.memory_comments as comment_row
        where comment_row.author_id = profile_row.id
          and comment_row.deleted_at is null
          and public.can_view_memory_post(comment_row.memory_post_id)
      )
      or exists (
        select 1
        from public.memory_tags as tag_row
        where tag_row.tagged_user_id = profile_row.id
          and public.can_view_memory_post(tag_row.memory_post_id)
      )
    );
$$;

revoke all on function public.list_memory_author_display(uuid[]) from public;
grant execute on function public.list_memory_author_display(uuid[]) to authenticated;

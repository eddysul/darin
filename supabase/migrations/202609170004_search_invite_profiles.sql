-- Admin-only people discovery for family/friend invite.
-- Projection is privacy-safe: user_id, display_name, darin_id, avatar_storage_path.
-- Does not return email, phone, nickname, guardian_birth_date, or residence_country.
-- Do not apply this file to production as part of the invite-search UI task.

create or replace function public.search_invite_profiles(
  p_baby_id uuid,
  p_query text
)
returns table (
  user_id uuid,
  display_name text,
  darin_id text,
  avatar_storage_path text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text;
  v_needle text;
  v_like text;
begin
  if auth.uid() is null
     or public.baby_permission(p_baby_id) is distinct from 'admin'::public.permission_role then
    raise exception 'only baby admin can search invite profiles' using errcode = '42501';
  end if;

  v_query := btrim(coalesce(p_query, ''));
  if char_length(v_query) < 2 then
    return;
  end if;

  v_needle := lower(v_query);
  v_like := '%' || replace(replace(replace(v_needle, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    profile_row.id,
    profile_row.display_name,
    profile_row.darin_id,
    profile_row.avatar_storage_path
  from public.profiles as profile_row
  where profile_row.darin_id is not null
    and btrim(profile_row.darin_id) <> ''
    and (
      lower(profile_row.darin_id) like v_like escape '\'
      or lower(coalesce(profile_row.display_name, '')) like v_like escape '\'
    )
  order by
    case
      when lower(profile_row.darin_id) = v_needle then 0
      when lower(profile_row.darin_id) like replace(replace(replace(v_needle, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\' then 1
      when lower(coalesce(profile_row.display_name, '')) like replace(replace(replace(v_needle, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\' then 2
      else 3
    end,
    profile_row.display_name
  limit 20;
end;
$$;

revoke all on function public.search_invite_profiles(uuid, text) from public;
grant execute on function public.search_invite_profiles(uuid, text) to authenticated;

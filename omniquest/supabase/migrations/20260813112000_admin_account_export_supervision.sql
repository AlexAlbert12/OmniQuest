create or replace function public.get_admin_account_export_requests_page(
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  user_alias text,
  user_role text,
  status text,
  file_size_bytes bigint,
  requested_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  error_message text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission('users.export') then
    raise exception 'Permission denied';
  end if;

  return query
  select
    request.id,
    request.user_id,
    coalesce(nullif(trim(profile.alias), ''), 'Usuario')::text as user_alias,
    profile.role_id::text as user_role,
    request.status,
    request.file_size_bytes,
    request.requested_at,
    request.started_at,
    request.completed_at,
    request.expires_at,
    request.error_message,
    count(*) over() as total_count
  from public.data_export_requests request
  join public.profiles profile on profile.id = request.user_id
  order by request.requested_at desc, request.id desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_admin_account_export_requests_page(integer, integer) from public, anon;
grant execute on function public.get_admin_account_export_requests_page(integer, integer) to authenticated, service_role;

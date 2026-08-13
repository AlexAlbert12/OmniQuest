create or replace function public.mark_all_notifications_read(p_audience text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_audience text := lower(trim(coalesce(p_audience, '')));
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_audience not in ('student', 'teacher') then
    raise exception 'Unsupported notification audience';
  end if;

  select p.role_id
  into v_role
  from public.profiles p
  where p.id = v_user_id
    and coalesce(p.active, true);

  if v_role is null then
    raise exception 'Active profile required';
  end if;

  if (v_audience = 'teacher' and v_role <> 'teacher')
     or (v_audience = 'student' and v_role not in ('student', 'guest')) then
    raise exception 'Notification audience does not match current role';
  end if;

  update public.notifications n
  set read_at = now(), updated_at = now()
  where n.user_id = v_user_id
    and n.audience = v_audience
    and n.deleted_at is null
    and n.read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_all_notifications_read(text) from public, anon;
grant execute on function public.mark_all_notifications_read(text) to authenticated, service_role;

comment on function public.mark_all_notifications_read(text)
  is 'Marks every unread persistent notification owned by the current user for the requested role-compatible audience as read.';

-- Admin More refinement: the portal context always exposes the caller's own basic
-- administrative identity without granting users.read over other profiles.
create or replace function public.get_admin_portal_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_alias text;
  v_email text;
  v_active boolean;
  v_avatar text;
  v_role_id text;
  v_role_name text;
  v_permissions text[];
begin
  select profile.alias, profile.email, coalesce(profile.active, true), profile.avatar
  into v_alias, v_email, v_active, v_avatar
  from public.profiles profile
  where profile.id = v_user_id
    and profile.role_id = 'admin'
    and coalesce(profile.active, true);

  if v_user_id is null or not found then
    raise exception 'Admin access required';
  end if;

  select role.id, role.name, role.permissions
  into v_role_id, v_role_name, v_permissions
  from public.admin_role_assignments assignment
  join public.admin_roles role on role.id = assignment.role_id
  where assignment.user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'user_id', v_user_id,
      'role_id', null,
      'role_name', 'Acceso administrativo pendiente',
      'permissions', '[]'::jsonb,
      'profile', jsonb_build_object('id', v_user_id, 'alias', v_alias, 'email', v_email, 'active', v_active, 'avatar', v_avatar)
    );
  end if;

  return jsonb_build_object(
    'user_id', v_user_id,
    'role_id', v_role_id,
    'role_name', v_role_name,
    'permissions', coalesce(to_jsonb(v_permissions), '[]'::jsonb),
    'profile', jsonb_build_object('id', v_user_id, 'alias', v_alias, 'email', v_email, 'active', v_active, 'avatar', v_avatar)
  );
end;
$$;

revoke all on function public.get_admin_portal_context() from public, anon;
grant execute on function public.get_admin_portal_context() to authenticated;

notify pgrst, 'reload schema';

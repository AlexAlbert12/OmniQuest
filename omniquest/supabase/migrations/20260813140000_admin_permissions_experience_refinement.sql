-- Admin permissions refinement: explicit access revocation is server-controlled,
-- requires a reason, cannot target the caller and is recorded in both governance
-- history and the global administrative audit log.

create or replace function public.revoke_admin_role(p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_assignment public.admin_role_assignments%rowtype;
  v_role public.admin_roles%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.admin_has_permission('admin.roles.manage') then raise exception 'Permission denied'; end if;
  if length(v_reason) < 5 then raise exception 'A change reason is required'; end if;
  if p_user_id = v_actor then raise exception 'You cannot remove your own administrative access'; end if;

  select * into v_profile from public.profiles where id = p_user_id and role_id = 'admin' for update;
  if not found then raise exception 'Admin profile not found'; end if;

  select assignment.* into v_assignment from public.admin_role_assignments assignment where assignment.user_id = p_user_id for update;
  if not found then raise exception 'Admin role assignment not found'; end if;

  select * into v_role from public.admin_roles where id = v_assignment.role_id;

  delete from public.admin_role_assignments where user_id = p_user_id;

  insert into public.admin_user_change_history (profile_id, changed_by, action, before_state, after_state, reason)
  values (
    p_user_id,
    v_actor,
    'admin.role.revoke',
    jsonb_build_object('role_id', v_assignment.role_id, 'role_name', v_role.name, 'permissions', coalesce(v_role.permissions, '{}'::text[])),
    jsonb_build_object('role_id', 'unassigned', 'role_name', 'Sin perfil asignado', 'permissions', '[]'::jsonb),
    v_reason
  );

  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, metadata)
  values (v_actor, 'admin.role.revoke', 'admin_role_assignments', p_user_id::text, jsonb_build_object('previous_role_id', v_assignment.role_id, 'previous_role_name', v_role.name, 'reason', v_reason, 'severity_hint', 'critical'));

  return jsonb_build_object('user_id', p_user_id, 'role_id', 'unassigned', 'role_name', 'Sin perfil asignado');
end;
$$;

revoke all on function public.revoke_admin_role(uuid, text) from public, anon;
grant execute on function public.revoke_admin_role(uuid, text) to authenticated;

notify pgrst, 'reload schema';

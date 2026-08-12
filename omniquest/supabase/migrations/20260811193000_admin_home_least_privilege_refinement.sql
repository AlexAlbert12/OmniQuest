-- Admin home refinement: explicit least-privilege assignments, actionable metrics and push semantics.

-- Bootstrap exactly one existing administrator only when the deployment has never
-- created an explicit administrative role assignment. Future admin accounts remain
-- unassigned until a privileged administrator grants them a role.
insert into public.admin_role_assignments (user_id, role_id, assigned_by, assigned_at, updated_at)
select profile.id, 'super_admin', profile.id, now(), now()
from public.profiles profile
where profile.role_id = 'admin'
  and coalesce(profile.active, true)
  and not exists (select 1 from public.admin_role_assignments)
order by profile.created_at asc nulls last, profile.id
limit 1
on conflict (user_id) do nothing;

-- An administrator is considered authorized only after an explicit role assignment.
-- get_admin_portal_context() still recognizes an unassigned admin account so the UI
-- can explain that access is pending instead of silently granting super-admin rights.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.admin_role_assignments assignment on assignment.user_id = profile.id
    where profile.id = auth.uid()
      and profile.role_id = 'admin'
      and coalesce(profile.active, true)
  );
$$;

create or replace function public.admin_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    and exists (
      select 1
      from public.admin_role_assignments assignment
      join public.admin_roles role on role.id = assignment.role_id
      where assignment.user_id = auth.uid()
        and p_permission = any(role.permissions)
    );
$$;

create or replace function public.get_admin_portal_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role_id text;
  v_role_name text;
  v_permissions text[];
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles profile
    where profile.id = v_user_id
      and profile.role_id = 'admin'
      and coalesce(profile.active, true)
  ) then
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
      'permissions', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'user_id', v_user_id,
    'role_id', v_role_id,
    'role_name', v_role_name,
    'permissions', coalesce(to_jsonb(v_permissions), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_admin_roles()
returns table (
  id text,
  name text,
  description text,
  permissions text[],
  system boolean,
  assigned_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission('admin.roles.manage') then
    raise exception 'Admin role management permission required';
  end if;

  return query
  select role.id, role.name, role.description, role.permissions, role.system,
    count(assignment.user_id)::bigint as assigned_count
  from public.admin_roles role
  left join public.admin_role_assignments assignment on assignment.role_id = role.id
  group by role.id, role.name, role.description, role.permissions, role.system
  order by case role.id when 'super_admin' then 0 else 1 end, role.name;
end;
$$;

create or replace function public.get_admin_role_assignments_page(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  alias text,
  email text,
  role_id text,
  role_name text,
  permissions text[],
  assigned_at timestamptz,
  assigned_by uuid,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.admin_has_permission('admin.roles.manage') then
    raise exception 'Admin role management permission required';
  end if;

  return query
  select profile.id, profile.alias, profile.email,
    coalesce(role.id, 'unassigned') as role_id,
    coalesce(role.name, 'Sin perfil asignado') as role_name,
    coalesce(role.permissions, '{}'::text[]) as permissions,
    assignment.assigned_at, assignment.assigned_by,
    count(*) over()::bigint
  from public.profiles profile
  left join public.admin_role_assignments assignment on assignment.user_id = profile.id
  left join public.admin_roles role on role.id = assignment.role_id
  where profile.role_id = 'admin'
  order by profile.alias, profile.id
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.assign_admin_role(p_user_id uuid, p_role_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_before jsonb;
  v_role public.admin_roles%rowtype;
begin
  if not public.admin_has_permission('admin.roles.manage') then raise exception 'Permission denied'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'A change reason is required'; end if;

  select * into v_profile from public.profiles where id = p_user_id and role_id = 'admin' for update;
  if not found then raise exception 'Admin profile not found'; end if;
  select * into v_role from public.admin_roles where id = p_role_id;
  if not found then raise exception 'Admin role not found'; end if;

  if p_user_id = v_actor and p_role_id <> 'super_admin' then
    raise exception 'You cannot reduce your own administrative permissions';
  end if;

  select jsonb_build_object('role_id', coalesce(assignment.role_id, 'unassigned'))
  into v_before
  from (select 1) seed
  left join public.admin_role_assignments assignment on assignment.user_id = p_user_id;

  insert into public.admin_role_assignments (user_id, role_id, assigned_by, assigned_at, updated_at)
  values (p_user_id, p_role_id, v_actor, now(), now())
  on conflict (user_id) do update
  set role_id = excluded.role_id, assigned_by = excluded.assigned_by, assigned_at = now(), updated_at = now();

  insert into public.admin_user_change_history (profile_id, changed_by, action, before_state, after_state, reason)
  values (p_user_id, v_actor, 'admin.role.assign', v_before, jsonb_build_object('role_id', p_role_id, 'permissions', v_role.permissions), trim(p_reason));

  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, metadata)
  values (v_actor, 'admin.role.assign', 'profiles', p_user_id::text, jsonb_build_object('role_id', p_role_id, 'reason', trim(p_reason)));

  return jsonb_build_object('user_id', p_user_id, 'role_id', p_role_id, 'role_name', v_role.name);
end;
$$;

-- Dashboard alerts are actionable: inactive learners have previous activity but no
-- attempt in the last seven days; archived/inactive academic entities do not raise
-- configuration alerts.
create or replace function public.get_admin_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_profiles integer := 0;
  v_teachers_count integer := 0;
  v_students_count integer := 0;
  v_subjects_count integer := 0;
  v_classrooms_count integer := 0;
  v_enrollments_count integer := 0;
  v_active_courses integer := 0;
  v_archived_courses integer := 0;
  v_active_classrooms integer := 0;
  v_inactive_users integer := 0;
  v_courses_without_classrooms integer := 0;
  v_inactive_students integer := 0;
  v_classrooms_without_code integer := 0;
begin
  if not public.admin_has_permission('dashboard.read') then raise exception 'Admin dashboard permission required'; end if;

  select count(*)::integer,
    count(*) filter (where role_id = 'teacher')::integer,
    count(*) filter (where role_id in ('student','guest'))::integer,
    count(*) filter (where active = false)::integer
  into v_total_profiles, v_teachers_count, v_students_count, v_inactive_users
  from public.profiles profile
  where not (profile.role_id = 'guest' and profile.converted_at is null and profile.expires_at <= now());

  select count(*)::integer,
    count(*) filter (where coalesce(active, true) and not coalesce(is_archived, false))::integer,
    count(*) filter (where coalesce(is_archived, false))::integer
  into v_subjects_count, v_active_courses, v_archived_courses
  from public.subjects;

  select count(*)::integer,
    count(*) filter (where coalesce(active, true))::integer,
    count(*) filter (where coalesce(active, true) and nullif(trim(coalesce(code, '')), '') is null)::integer
  into v_classrooms_count, v_active_classrooms, v_classrooms_without_code
  from public.classrooms;

  select count(*)::integer
  into v_enrollments_count
  from public.enrollments enrollment
  join public.profiles profile on profile.id = enrollment.student_id
  where not (profile.role_id = 'guest' and profile.converted_at is null and profile.expires_at <= now());

  select count(*)::integer
  into v_courses_without_classrooms
  from public.subjects subject
  where coalesce(subject.active, true)
    and not coalesce(subject.is_archived, false)
    and not exists (select 1 from public.classrooms classroom where classroom.subject_id = subject.id);

  select count(*)::integer
  into v_inactive_students
  from (
    select enrollment.student_id
    from public.enrollments enrollment
    join public.profiles profile on profile.id = enrollment.student_id
    join public.attempt_history attempt on attempt.student_id = enrollment.student_id
    where coalesce(profile.active, true)
      and profile.role_id in ('student','guest')
      and not (profile.role_id = 'guest' and profile.converted_at is null and profile.expires_at <= now())
    group by enrollment.student_id
    having max(attempt.attempted_at) < now() - interval '7 days'
  ) inactive;

  return jsonb_build_object(
    'totalProfiles', v_total_profiles,
    'teachersCount', v_teachers_count,
    'studentsCount', v_students_count,
    'subjectsCount', v_subjects_count,
    'classroomsCount', v_classrooms_count,
    'enrollmentsCount', v_enrollments_count,
    'activeCourses', v_active_courses,
    'archivedCourses', v_archived_courses,
    'activeClassrooms', v_active_classrooms,
    'inactiveUsers', v_inactive_users,
    'coursesWithoutClassrooms', v_courses_without_classrooms,
    'inactiveStudents', v_inactive_students,
    'classroomsWithoutCode', v_classrooms_without_code
  );
end;
$$;

-- Push monitoring distinguishes work waiting in the queue from work already being
-- processed. A delivery rate is unknown until at least one receipt resolves.
create or replace function public.get_admin_push_delivery_metrics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.admin_has_permission('dashboard.read') then raise exception 'Admin dashboard permission required'; end if;

  return jsonb_build_object(
    'days', v_days,
    'queued', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'pending'),
    'processing', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status in ('processing', 'waiting_receipt')),
    'completed', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'completed'),
    'failed', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'failed'),
    'skipped', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'skipped'),
    'tickets', (select count(*) from public.notification_push_deliveries delivery where delivery.created_at >= v_since and delivery.status in ('ticketed', 'delivered')),
    'delivered', (select count(*) from public.notification_push_deliveries delivery where delivery.created_at >= v_since and delivery.status = 'delivered'),
    'device_failures', (select count(*) from public.notification_push_deliveries delivery where delivery.created_at >= v_since and delivery.status = 'failed'),
    'retrying', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.attempts > 1 and queue.status in ('pending', 'processing', 'waiting_receipt')),
    'delivery_rate', (
      select round(
        100.0 * count(*) filter (where delivery.status = 'delivered')
        / nullif(count(*) filter (where delivery.status in ('delivered', 'failed')), 0),
        1
      )
      from public.notification_push_deliveries delivery
      where delivery.created_at >= v_since
    )
  );
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_has_permission(text) from public, anon;
revoke all on function public.get_admin_portal_context() from public, anon;
revoke all on function public.get_admin_roles() from public, anon;
revoke all on function public.get_admin_role_assignments_page(integer, integer) from public, anon;
revoke all on function public.assign_admin_role(uuid, text, text) from public, anon;
revoke all on function public.get_admin_dashboard_metrics() from public, anon;
revoke all on function public.get_admin_push_delivery_metrics(integer) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_has_permission(text) to authenticated;
grant execute on function public.get_admin_portal_context() to authenticated;
grant execute on function public.get_admin_roles() to authenticated;
grant execute on function public.get_admin_role_assignments_page(integer, integer) to authenticated;
grant execute on function public.assign_admin_role(uuid, text, text) to authenticated;
grant execute on function public.get_admin_dashboard_metrics() to authenticated;
grant execute on function public.get_admin_push_delivery_metrics(integer) to authenticated;

notify pgrst, 'reload schema';

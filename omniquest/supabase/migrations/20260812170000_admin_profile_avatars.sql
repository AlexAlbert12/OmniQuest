drop function if exists public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer);

create function public.get_admin_profiles_page(
  p_role text default null,
  p_search text default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_profile_id uuid default null,
  p_active boolean default null,
  p_activity_state text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  alias text,
  avatar text,
  email text,
  role_id text,
  active boolean,
  created_at timestamptz,
  subject_count integer,
  enrollment_count integer,
  last_activity_at timestamptz,
  activity_state text,
  last_sign_in_at timestamptz,
  security_status text,
  mfa_factor_count integer,
  deactivation_reason text,
  deactivated_at timestamptz,
  reactivate_at timestamptz,
  admin_role_name text,
  admin_permissions text[],
  change_count integer,
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
  v_search text := lower(trim(coalesce(p_search, '')));
  v_activity_state text := lower(trim(coalesce(p_activity_state, 'all')));
begin
  if not public.admin_has_permission('users.read') then raise exception 'Permission denied'; end if;

  return query
  with profile_activity as (
    select profile.*,
      case
        when profile.role_id in ('student','guest') then (select max(attempt.attempted_at) from public.attempt_history attempt where attempt.student_id = profile.id)
        when profile.role_id = 'teacher' then greatest(
          (select max(log.created_at) from public.teacher_audit_logs log where log.teacher_id = profile.id),
          (select max(subject.created_at) from public.subjects subject where subject.teacher_id = profile.id)
        )
        else (select max(log.created_at) from public.admin_audit_logs log where log.admin_id = profile.id)
      end as computed_last_activity_at
    from public.profiles profile
  ), filtered as (
    select activity.*,
      case when activity.computed_last_activity_at is null then 'never'
           when activity.computed_last_activity_at >= now() - interval '30 days' then 'recent'
           else 'inactive' end as computed_activity_state
    from profile_activity activity
    where (p_profile_id is null or activity.id = p_profile_id)
      and (p_role is null or (p_role = 'student' and activity.role_id in ('student','guest')) or activity.role_id = p_role)
      and (p_active is null or coalesce(activity.active, true) = p_active)
      and (p_created_from is null or activity.created_at >= p_created_from)
      and (p_created_to is null or activity.created_at <= p_created_to)
      and (v_search = '' or lower(concat_ws(' ', activity.alias, activity.email, activity.role_id)) like '%' || v_search || '%')
      and (p_subject_id is null or (activity.role_id = 'teacher' and exists (select 1 from public.subjects subject where subject.id = p_subject_id and subject.teacher_id = activity.id)) or (activity.role_id in ('student','guest') and exists (select 1 from public.enrollments enrollment where enrollment.student_id = activity.id and enrollment.subject_id = p_subject_id)))
      and (p_classroom_id is null or (activity.role_id = 'teacher' and exists (select 1 from public.classrooms classroom join public.subjects subject on subject.id = classroom.subject_id where classroom.id = p_classroom_id and subject.teacher_id = activity.id)) or (activity.role_id in ('student','guest') and exists (select 1 from public.enrollments enrollment where enrollment.student_id = activity.id and enrollment.classroom_id = p_classroom_id)))
  )
  select filtered.id, filtered.alias, filtered.avatar, coalesce(filtered.email, auth_user.email), filtered.role_id, filtered.active, filtered.created_at,
    (select count(*)::integer from public.subjects subject where subject.teacher_id = filtered.id),
    (select count(*)::integer from public.enrollments enrollment where enrollment.student_id = filtered.id),
    filtered.computed_last_activity_at, filtered.computed_activity_state,
    auth_user.last_sign_in_at,
    case when filtered.active = false then 'inactive'
         when auth_user.banned_until is not null and auth_user.banned_until > now() then 'locked'
         when auth_user.email_confirmed_at is null then 'unverified'
         when auth_user.last_sign_in_at is null then 'never_signed_in'
         when auth_user.last_sign_in_at < now() - interval '180 days' then 'attention'
         else 'secure' end,
    (select count(*)::integer from auth.mfa_factors factor where factor.user_id = filtered.id and factor.status::text = 'verified'),
    filtered.deactivation_reason, filtered.deactivated_at, filtered.reactivate_at,
    case when filtered.role_id = 'admin' then coalesce(admin_role.name, 'Administrador global') else null end,
    case when filtered.role_id = 'admin' then coalesce(admin_role.permissions, default_role.permissions) else null end,
    (select count(*)::integer from public.admin_user_change_history history where history.profile_id = filtered.id),
    count(*) over()::bigint
  from filtered
  left join auth.users auth_user on auth_user.id = filtered.id
  left join public.admin_role_assignments assignment on assignment.user_id = filtered.id
  left join public.admin_roles admin_role on admin_role.id = assignment.role_id
  left join public.admin_roles default_role on default_role.id = 'super_admin'
  where v_activity_state in ('','all') or filtered.computed_activity_state = v_activity_state
  order by case when coalesce(filtered.active, true) then 0 else 1 end,
    auth_user.last_sign_in_at desc nulls last, filtered.computed_last_activity_at desc nulls last,
    filtered.created_at desc, filtered.alias
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer) to authenticated;

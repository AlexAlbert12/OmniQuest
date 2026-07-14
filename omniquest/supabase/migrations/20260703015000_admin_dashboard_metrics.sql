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
  v_students_without_activity integer := 0;
  v_classrooms_without_code integer := 0;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  select count(*)::integer
  into v_total_profiles
  from public.profiles;

  select count(*) filter (where role_id = 'teacher')::integer,
         count(*) filter (where role_id in ('student', 'guest'))::integer,
         count(*) filter (where active = false)::integer
  into v_teachers_count, v_students_count, v_inactive_users
  from public.profiles;

  select count(*)::integer,
         count(*) filter (where coalesce(active, true) and not coalesce(is_archived, false))::integer,
         count(*) filter (where coalesce(is_archived, false))::integer
  into v_subjects_count, v_active_courses, v_archived_courses
  from public.subjects;

  select count(*)::integer,
         count(*) filter (where coalesce(active, true))::integer,
         count(*) filter (where nullif(trim(coalesce(code, '')), '') is null)::integer
  into v_classrooms_count, v_active_classrooms, v_classrooms_without_code
  from public.classrooms;

  select count(*)::integer
  into v_enrollments_count
  from public.enrollments;

  select count(*)::integer
  into v_courses_without_classrooms
  from public.subjects s
  where not exists (
    select 1
    from public.classrooms c
    where c.subject_id = s.id
  );

  select count(*)::integer
  into v_students_without_activity
  from (
    select distinct e.student_id
    from public.enrollments e
    where not exists (
      select 1
      from public.subject_scores ss
      where ss.student_id = e.student_id
    )
    and not exists (
      select 1
      from public.attempt_history ah
      where ah.student_id = e.student_id
    )
  ) idle_students;

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
    'studentsWithoutActivity', v_students_without_activity,
    'classroomsWithoutCode', v_classrooms_without_code
  );
end;
$$;

grant execute on function public.get_admin_dashboard_metrics() to authenticated;

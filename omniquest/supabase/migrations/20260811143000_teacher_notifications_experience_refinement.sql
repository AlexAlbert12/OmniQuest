create or replace function public.get_teacher_notification_center_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_pending_reviews integer := 0;
  v_inactive_students integer := 0;
  v_sensitive_actions integer := 0;
  v_unread_notifications integer := 0;
  v_active_subjects integer := 0;
  v_muted_until timestamptz;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  select count(*)::integer
  into v_active_subjects
  from public.subjects s
  where s.teacher_id = v_teacher_id
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false);

  select count(*)::integer
  into v_pending_reviews
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where s.teacher_id = v_teacher_id
    and ah.manual_review_status = 'pending';

  select count(distinct e.student_id)::integer
  into v_inactive_students
  from public.enrollments e
  join public.subjects s on s.id = e.subject_id
  where s.teacher_id = v_teacher_id
    and e.student_id is not null
    and not exists (
      select 1
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.student_id = e.student_id
        and q.subject_id = e.subject_id
        and coalesce(ah.attempted_at, ah.created_at) >= now() - interval '7 days'
    );

  select count(*)::integer
  into v_sensitive_actions
  from public.teacher_audit_logs log
  where log.teacher_id = v_teacher_id
    and log.created_at >= now() - interval '7 days'
    and log.severity in ('warning', 'critical');

  select count(*)::integer
  into v_unread_notifications
  from public.notifications n
  where n.user_id = v_teacher_id
    and n.audience = 'teacher'
    and n.deleted_at is null
    and n.read_at is null;

  select teacher_notifications_muted_until
  into v_muted_until
  from public.user_notification_preferences
  where user_id = v_teacher_id;

  return jsonb_build_object(
    'pending_reviews', v_pending_reviews,
    'inactive_students', v_inactive_students,
    'sensitive_actions', v_sensitive_actions,
    'unread_notifications', v_unread_notifications,
    'active_subjects', v_active_subjects,
    'muted_until', v_muted_until
  );
end;
$$;

update public.notifications
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('category', 'courses'), updated_at = now()
where audience = 'teacher'
  and title = 'Pregunta con muchos fallos'
  and coalesce(metadata ->> 'category', '') <> 'courses';

create or replace function public.notify_question_failure_threshold_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_text text;
  v_subject_id bigint;
  v_subject_name text;
  v_teacher_id uuid;
  v_recent_failures integer := 0;
  v_affected_students integer := 0;
  v_window_start timestamptz := now() - interval '24 hours';
begin
  if coalesce(new.is_correct, false) = true then
    return new;
  end if;

  select q.text, q.subject_id, s.name, s.teacher_id
  into v_question_text, v_subject_id, v_subject_name, v_teacher_id
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where q.id = new.question_id;

  if v_teacher_id is null then
    return new;
  end if;

  select count(*)::integer, count(distinct ah.student_id)::integer
  into v_recent_failures, v_affected_students
  from public.attempt_history ah
  where ah.question_id = new.question_id
    and coalesce(ah.is_correct, false) = false
    and coalesce(ah.attempted_at, ah.created_at, now()) >= v_window_start;

  if v_recent_failures < 5 and v_affected_students < 3 then
    return new;
  end if;

  perform public.create_notification(
    v_teacher_id,
    'teacher',
    'announcement',
    'Pregunta con muchos fallos',
    concat(
      v_affected_students,
      case when v_affected_students = 1 then ' alumno ha fallado ' else ' alumnos han fallado ' end,
      '"',
      left(coalesce(v_question_text, 'una pregunta'), 70),
      '" en ',
      coalesce(v_subject_name, 'un curso'),
      '.'
    ),
    'warning-outline',
    '#FB7185',
    concat('/(teacher)/question-report/', new.question_id),
    'questions',
    new.question_id::text,
    jsonb_build_object(
      'subject_id', v_subject_id,
      'subject_name', v_subject_name,
      'question_id', new.question_id,
      'recent_failures', v_recent_failures,
      'affected_students', v_affected_students,
      'window_hours', 24,
      'category', 'courses'
    ),
    concat('teacher-question-failures:', new.question_id, ':', to_char(now(), 'YYYYMMDD'))
  );

  return new;
end;
$$;

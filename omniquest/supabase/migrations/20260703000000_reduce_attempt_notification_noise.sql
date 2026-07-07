drop trigger if exists notify_attempt_event on public.attempt_history;
drop function if exists public.notify_attempt_event();

update public.notifications
set
  deleted_at = coalesce(deleted_at, now()),
  updated_at = now()
where related_table = 'attempt_history'
  and fingerprint like 'teacher-attempt:%'
  and deleted_at is null;

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
  -- Correct answers are useful for analytics, but not as persistent notifications.
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

  select
    count(*)::integer,
    count(distinct ah.student_id)::integer
  into v_recent_failures, v_affected_students
  from public.attempt_history ah
  where ah.question_id = new.question_id
    and coalesce(ah.is_correct, false) = false
    and coalesce(ah.attempted_at, ah.created_at, now()) >= v_window_start;

  -- A single wrong answer is normal. Notify only when it becomes a teaching signal.
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
      'window_hours', 24
    ),
    concat('teacher-question-failures:', new.question_id, ':', to_char(now(), 'YYYYMMDD'))
  );

  return new;
end;
$$;

drop trigger if exists notify_question_failure_threshold_event on public.attempt_history;

create trigger notify_question_failure_threshold_event
after insert on public.attempt_history
for each row execute function public.notify_question_failure_threshold_event();

-- Align teacher student-history analytics with manual-review semantics and preserve exact review context.

create or replace function public.get_teacher_student_history_summary(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 30), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e
    join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with contexts as (
    select e.id, e.student_id, e.subject_id, e.classroom_id, e.joined_at,
      s.name as subject_name, s.academic_year as subject_year,
      c.name as classroom_name, c.code as classroom_code, c.academic_year as classroom_year
    from public.enrollments e
    join public.subjects s on s.id = e.subject_id and s.teacher_id = v_teacher_id
    left join public.classrooms c on c.id = e.classroom_id
    where e.student_id = p_student_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ),
  scoped_questions as (
    select q.id, q.subject_id, q.classroom_id, q.topic_id, q.type, q.active
    from public.questions q
    where exists (
      select 1 from contexts c
      where c.subject_id = q.subject_id
        and (c.classroom_id is null or q.classroom_id is null or q.classroom_id = c.classroom_id)
    )
  ),
  scoped_attempts as (
    select ah.id, ah.student_id, ah.question_id, ah.is_correct, ah.earned_points, ah.attempted_at,
      coalesce(ah.manual_review_status, 'not_required') as manual_review_status,
      q.subject_id, q.classroom_id, q.topic_id, q.type as question_type, coalesce(q.active, true) as question_active
    from public.attempt_history ah
    join scoped_questions q on q.id = ah.question_id
    where ah.student_id = p_student_id
  ),
  current_period as (
    select * from scoped_attempts where attempted_at >= now() - make_interval(days => v_days)
  ),
  previous_period as (
    select * from scoped_attempts
    where attempted_at >= now() - make_interval(days => v_days * 2)
      and attempted_at < now() - make_interval(days => v_days)
  ),
  weak_topic as (
    select a.subject_id, a.classroom_id, a.topic_id, coalesce(t.title, 'Práctica general') as topic_title,
      count(*)::int as attempts,
      count(*) filter (where not a.is_correct)::int as mistakes,
      case when count(*) > 0 then round(100.0 * count(*) filter (where a.is_correct) / count(*))::int else 0 end as accuracy
    from current_period a
    left join public.subject_topics t on t.id = a.topic_id
    where a.manual_review_status not in ('pending', 'in_review')
    group by a.subject_id, a.classroom_id, a.topic_id, t.title
    having count(*) filter (where not a.is_correct) > 0
    order by mistakes desc, accuracy asc, attempts desc
    limit 1
  ),
  metrics as (
    select
      (select count(*)::int from current_period) as current_attempts,
      (select count(*)::int from current_period where manual_review_status not in ('pending', 'in_review')) as current_evaluated,
      (select count(*)::int from current_period where manual_review_status not in ('pending', 'in_review') and is_correct) as current_correct,
      (select count(*)::int from current_period where manual_review_status in ('pending', 'in_review')) as current_pending,
      (select coalesce(sum(coalesce(earned_points, 0)), 0)::int from current_period) as current_xp,
      (select count(*)::int from previous_period) as previous_attempts,
      (select count(*)::int from previous_period where manual_review_status not in ('pending', 'in_review')) as previous_evaluated,
      (select count(*)::int from previous_period where manual_review_status not in ('pending', 'in_review') and is_correct) as previous_correct,
      (select coalesce(sum(coalesce(earned_points, 0)), 0)::int from previous_period) as previous_xp,
      (select max(attempted_at) from scoped_attempts) as last_activity,
      (select count(*)::int from scoped_attempts where manual_review_status in ('pending', 'in_review')) as pending_reviews,
      (select count(distinct question_id)::int from current_period where question_active) as answered_questions,
      (select count(*)::int from scoped_questions where coalesce(active, true)) as available_questions
  )
  select jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'alias', p.alias, 'avatar', p.avatar, 'points', p.points, 'active', p.active, 'createdAt', p.created_at),
    'subjectsCount', (select count(*)::int from public.subjects s where s.teacher_id = v_teacher_id and coalesce(s.active, true) and not coalesce(s.is_archived, false)),
    'courseContexts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'enrollmentId', c.id, 'subjectId', c.subject_id, 'subjectName', c.subject_name,
        'classroomId', c.classroom_id, 'classroomName', coalesce(c.classroom_name, 'Clase principal'),
        'classroomCode', c.classroom_code, 'academicYear', coalesce(c.classroom_year, c.subject_year), 'joinedAt', c.joined_at
      ) order by c.joined_at, c.id) from contexts c
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'periodDays', v_days,
      'attempts', m.current_attempts,
      'evaluatedAttempts', m.current_evaluated,
      'pendingEvaluation', m.current_pending,
      'correct', m.current_correct,
      'accuracyPercent', case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int else null end,
      'earnedXp', m.current_xp,
      'lastActivityAt', m.last_activity,
      'pendingReviews', m.pending_reviews,
      'answeredQuestions', m.answered_questions,
      'availableQuestions', m.available_questions,
      'coveragePercent', case when m.available_questions > 0 then least(100, round(100.0 * m.answered_questions / m.available_questions)::int) else null end
    ),
    'comparison', jsonb_build_object(
      'current', jsonb_build_object(
        'attempts', m.current_attempts,
        'evaluatedAttempts', m.current_evaluated,
        'accuracyPercent', case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int else null end,
        'earnedXp', m.current_xp
      ),
      'previous', jsonb_build_object(
        'attempts', m.previous_attempts,
        'evaluatedAttempts', m.previous_evaluated,
        'accuracyPercent', case when m.previous_evaluated > 0 then round(100.0 * m.previous_correct / m.previous_evaluated)::int else null end,
        'earnedXp', m.previous_xp
      ),
      'delta', jsonb_build_object(
        'attempts', m.current_attempts - m.previous_attempts,
        'accuracyPoints', coalesce(case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int end, 0)
          - coalesce(case when m.previous_evaluated > 0 then round(100.0 * m.previous_correct / m.previous_evaluated)::int end, 0),
        'earnedXp', m.current_xp - m.previous_xp
      )
    ),
    'recommendation', case
      when m.current_attempts = 0 and m.last_activity is null then jsonb_build_object(
        'code', 'start', 'title', 'Ayudarle a empezar',
        'reason', 'No se ha registrado ninguna respuesta en los cursos seleccionados.',
        'actionLabel', 'Enviar recordatorio', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      when m.pending_reviews > 0 then jsonb_build_object(
        'code', 'review', 'title', 'Revisar respuestas pendientes',
        'reason', case when m.pending_reviews = 1 then 'Hay 1 respuesta esperando una decisión docente.' else format('Hay %s respuestas esperando una decisión docente.', m.pending_reviews) end,
        'actionLabel', 'Abrir revisiones', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      when exists (select 1 from weak_topic) then jsonb_build_object(
        'code', 'practice', 'title', 'Reforzar ' || (select topic_title from weak_topic),
        'reason', format('La precisión del tema es %s%% y acumula %s.', (select accuracy from weak_topic),
          case when (select mistakes from weak_topic) = 1 then '1 error' else (select mistakes from weak_topic)::text || ' errores' end),
        'actionLabel', 'Preparar práctica',
        'subjectId', (select subject_id from weak_topic),
        'classroomId', (select classroom_id from weak_topic),
        'topicId', (select topic_id from weak_topic)
      )
      when m.last_activity < now() - interval '14 days' then jsonb_build_object(
        'code', 'reengage', 'title', 'Recuperar la constancia',
        'reason', 'La última actividad supera los 14 días.',
        'actionLabel', 'Enviar recordatorio', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      else jsonb_build_object(
        'code', 'challenge', 'title', 'Proponer un nuevo reto',
        'reason', 'Mantiene una actividad estable y puede avanzar a contenido más exigente.',
        'actionLabel', 'Crear pregunta', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
    end,
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'subjectId', n.subject_id, 'classroomId', n.classroom_id, 'createdAt', n.created_at, 'updatedAt', n.updated_at) order by n.created_at desc, n.id desc)
      from (
        select n.id, n.body, n.subject_id, n.classroom_id, n.created_at, n.updated_at
        from public.teacher_student_notes n
        where n.teacher_id = v_teacher_id and n.student_id = p_student_id
          and (p_subject_id is null or n.subject_id is null or n.subject_id = p_subject_id)
          and (p_classroom_id is null or n.classroom_id is null or n.classroom_id = p_classroom_id)
        order by n.created_at desc, n.id desc limit 5
      ) n
    ), '[]'::jsonb),
    'notesTotal', (
      select count(*)::int from public.teacher_student_notes n
      where n.teacher_id = v_teacher_id and n.student_id = p_student_id
        and (p_subject_id is null or n.subject_id is null or n.subject_id = p_subject_id)
        and (p_classroom_id is null or n.classroom_id is null or n.classroom_id = p_classroom_id)
    )
  ) into v_result
  from public.profiles p cross join metrics m
  where p.id = p_student_id;

  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_weaknesses(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 90), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with rows as (
    select q.subject_id, s.name as subject_name, q.topic_id, coalesce(t.title, 'Práctica general') as topic_title,
      count(ah.id)::int as attempts,
      count(ah.id) filter (where not ah.is_correct)::int as mistakes,
      round(100.0 * count(ah.id) filter (where ah.is_correct) / nullif(count(ah.id), 0))::int as accuracy_percent,
      max(ah.attempted_at) as last_attempt_at
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and ah.attempted_at >= now() - make_interval(days => v_days)
      and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review')
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
    group by q.subject_id, s.name, q.topic_id, t.title
    having count(ah.id) filter (where not ah.is_correct) > 0
    order by mistakes desc, accuracy_percent asc, last_attempt_at desc
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(r) order by r.mistakes desc, r.accuracy_percent asc) from rows r), '[]'::jsonb),
    'periodDays', v_days
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_reviews_page(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with filtered as (
    select ah.id, ah.question_id, q.subject_id, q.classroom_id, q.text as question_text, s.name as subject_name,
      coalesce(t.title, 'Práctica general') as topic_title, ah.submitted_answer_text as answer_text,
      coalesce(ah.manual_review_status, 'not_required') as status, ah.reviewed_at, ah.review_notes, ah.attempted_at,
      (select count(*)::int from public.manual_review_comments m where m.attempt_history_id = ah.id) as comments_count
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and q.type = 'open_answer'
      and coalesce(ah.manual_review_status, 'not_required') <> 'not_required'
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
  ), page_rows as (
    select * from filtered
    order by case status when 'pending' then 1 when 'in_review' then 2 when 'needs_changes' then 3 else 4 end, attempted_at desc, id desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by case p.status when 'pending' then 1 when 'in_review' then 2 when 'needs_changes' then 3 else 4 end, p.attempted_at desc, p.id desc) from page_rows p), '[]'::jsonb),
    'total', (select count(*)::int from filtered), 'limit', v_limit, 'offset', v_offset
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_metrics(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 90), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with attempts as (
    select ah.attempted_at, ah.is_correct, coalesce(ah.earned_points, 0)::int as earned_points,
      coalesce(ah.manual_review_status, 'not_required') as manual_review_status,
      q.subject_id, q.classroom_id, q.topic_id, s.name as subject_name,
      coalesce(t.title, 'Práctica general') as topic_title
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and ah.attempted_at >= now() - make_interval(days => v_days)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
  ), daily as (
    select attempted_at::date as day,
      count(*)::int as attempts,
      count(*) filter (where manual_review_status not in ('pending', 'in_review'))::int as evaluated,
      count(*) filter (where manual_review_status in ('pending', 'in_review'))::int as pending,
      count(*) filter (where manual_review_status not in ('pending', 'in_review') and is_correct)::int as correct,
      coalesce(sum(earned_points), 0)::int as earned_xp
    from attempts group by attempted_at::date order by day
  ), topic_rows as (
    select subject_id, subject_name, topic_id, topic_title,
      count(*)::int as attempts,
      count(*) filter (where manual_review_status not in ('pending', 'in_review'))::int as evaluated,
      count(*) filter (where manual_review_status in ('pending', 'in_review'))::int as pending,
      count(*) filter (where manual_review_status not in ('pending', 'in_review') and is_correct)::int as correct,
      case when count(*) filter (where manual_review_status not in ('pending', 'in_review')) > 0
        then round(100.0 * count(*) filter (where manual_review_status not in ('pending', 'in_review') and is_correct)
          / count(*) filter (where manual_review_status not in ('pending', 'in_review')))::int else null end as accuracy_percent,
      coalesce(sum(earned_points), 0)::int as earned_xp,
      max(attempted_at) as last_activity_at
    from attempts group by subject_id, subject_name, topic_id, topic_title
  )
  select jsonb_build_object(
    'periodDays', v_days,
    'evolution', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.day, 'attempts', d.attempts, 'evaluated', d.evaluated, 'pending', d.pending, 'correct', d.correct,
        'accuracyPercent', case when d.evaluated > 0 then round(100.0 * d.correct / d.evaluated)::int else null end,
        'earnedXp', d.earned_xp
      ) order by d.day) from daily d
    ), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(to_jsonb(t) order by t.last_activity_at desc, t.topic_title) from topic_rows t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- The review queue can now be opened from one student's history without losing context.
drop function if exists public.get_teacher_manual_review_queue(bigint, bigint, text, text, integer, integer);

create function public.get_teacher_manual_review_queue(
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_status text default null,
  p_search text default null,
  p_student_id uuid default null,
  p_attempt_id bigint default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  with filtered as (
    select ah.id, ah.student_id, coalesce(p.alias, split_part(p.email, '@', 1), 'Alumno') as student_name,
      p.email as student_email, ah.question_id, q.text as question_text, ah.submitted_answer_text as answer_text,
      ah.submitted_answer_payload as answer_payload, ah.manual_review_status as status, ah.attempted_at, ah.reviewed_at,
      ah.review_notes, ah.earned_points, q.points_base as possible_points, ah.time_taken_seconds,
      s.id as subject_id, s.name as subject_name, c.id as classroom_id, coalesce(c.name, 'Sin clase') as classroom_name,
      st.id as topic_id, st.title as topic_name, ah.manual_review_due_at as due_at, ah.manual_review_assigned_to as assigned_to,
      coalesce(assignee.alias, split_part(assignee.email, '@', 1)) as assigned_to_name,
      ah.manual_review_rubric_id as rubric_id, rubric.name as rubric_name, ah.manual_review_rubric_result as rubric_result,
      greatest(0, extract(epoch from (now() - coalesce(ah.attempted_at, ah.created_at, now())))::bigint) as pending_seconds,
      (ah.manual_review_due_at is not null and ah.manual_review_due_at < now()) as is_overdue,
      (select count(*) from public.manual_review_comments mrc where mrc.attempt_history_id = ah.id)::integer as comments_count,
      (select mrc.body from public.manual_review_comments mrc where mrc.attempt_history_id = ah.id order by mrc.created_at desc, mrc.id desc limit 1) as latest_comment
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id
    left join public.classrooms c on c.id = coalesce(q.classroom_id, (select ga.classroom_id from public.game_attempts ga where ga.id = ah.attempt_id))
    left join public.subject_topics st on st.id = q.topic_id
    left join public.profiles p on p.id = ah.student_id
    left join public.profiles assignee on assignee.id = ah.manual_review_assigned_to
    left join public.manual_review_rubrics rubric on rubric.id = ah.manual_review_rubric_id
    where q.type = 'open_answer' and ah.manual_review_status <> 'not_required'
      and (public.is_admin() or s.teacher_id = v_user_id or ah.manual_review_assigned_to = v_user_id)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or coalesce(q.classroom_id, c.id) = p_classroom_id)
      and (p_student_id is null or ah.student_id = p_student_id)
      and (p_attempt_id is null or ah.id = p_attempt_id)
      and (nullif(trim(coalesce(p_status, '')), '') is null or ah.manual_review_status = p_status)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or q.text ilike '%' || trim(p_search) || '%'
        or coalesce(ah.submitted_answer_text, '') ilike '%' || trim(p_search) || '%'
        or coalesce(p.alias, '') ilike '%' || trim(p_search) || '%'
        or coalesce(p.email, '') ilike '%' || trim(p_search) || '%'
        or s.name ilike '%' || trim(p_search) || '%'
      )
  ), page as (
    select * from filtered
    order by is_overdue desc, case status when 'pending' then 1 when 'needs_changes' then 2 when 'in_review' then 3 else 4 end,
      due_at asc nulls last, attempted_at asc, id asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) order by page.is_overdue desc, page.due_at asc nulls last, page.id) from page), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'summary', jsonb_build_object(
      'pending', (select count(*) from filtered where status = 'pending'),
      'in_review', (select count(*) from filtered where status = 'in_review'),
      'needs_changes', (select count(*) from filtered where status = 'needs_changes'),
      'overdue', (select count(*) from filtered where is_overdue)
    )
  ) into v_result;
  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'summary', '{}'::jsonb));
end;
$$;

revoke all on function public.get_teacher_student_history_summary(uuid, bigint, bigint, integer) from public, anon;
revoke all on function public.get_teacher_student_history_weaknesses(uuid, bigint, bigint, integer) from public, anon;
revoke all on function public.get_teacher_student_history_reviews_page(uuid, bigint, bigint, integer, integer) from public, anon;
revoke all on function public.get_teacher_student_history_metrics(uuid, bigint, bigint, integer) from public, anon;
revoke all on function public.get_teacher_manual_review_queue(bigint, bigint, text, text, uuid, bigint, integer, integer) from public, anon;

grant execute on function public.get_teacher_student_history_summary(uuid, bigint, bigint, integer) to authenticated;
grant execute on function public.get_teacher_student_history_weaknesses(uuid, bigint, bigint, integer) to authenticated;
grant execute on function public.get_teacher_student_history_reviews_page(uuid, bigint, bigint, integer, integer) to authenticated;
grant execute on function public.get_teacher_student_history_metrics(uuid, bigint, bigint, integer) to authenticated;
grant execute on function public.get_teacher_manual_review_queue(bigint, bigint, text, text, uuid, bigint, integer, integer) to authenticated;

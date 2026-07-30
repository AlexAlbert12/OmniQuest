-- Teacher-facing server aggregates and lazy tab data.
-- Keeps large datasets in PostgreSQL and exposes only paged, role-scoped payloads.

create index if not exists attempt_history_question_attempted_student_idx
  on public.attempt_history(question_id, attempted_at desc, student_id);

create index if not exists enrollments_subject_classroom_student_idx
  on public.enrollments(subject_id, classroom_id, student_id);

create index if not exists subject_scores_subject_classroom_student_idx
  on public.subject_scores(subject_id, classroom_id, student_id);

create index if not exists questions_subject_classroom_topic_active_idx
  on public.questions(subject_id, classroom_id, topic_id, active);

create index if not exists classrooms_subject_active_created_idx
  on public.classrooms(subject_id, active, created_at desc);

create index if not exists subject_topics_subject_classroom_active_order_idx
  on public.subject_topics(subject_id, classroom_id, active, sort_order, created_at);

create or replace function public.get_teacher_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Teacher session required';
  end if;

  with teacher_subjects as (
    select s.id, s.name, s.description, s.icon, s.code, s.theme_color, s.created_at
    from public.subjects s
    where s.teacher_id = v_teacher_id
      and not coalesce(s.is_archived, false)
      and coalesce(s.active, true)
  ),
  enrollment_agg as (
    select e.subject_id,
      count(distinct e.student_id)::int as enrolled_count
    from public.enrollments e
    join teacher_subjects s on s.id = e.subject_id
    group by e.subject_id
  ),
  score_agg as (
    select ss.subject_id,
      count(distinct ss.student_id)::int as played_count,
      coalesce(round(avg(coalesce(ss.max_score, 0))), 0)::int as average_score
    from public.subject_scores ss
    join teacher_subjects s on s.id = ss.subject_id
    group by ss.subject_id
  ),
  question_agg as (
    select q.subject_id, count(*) filter (where coalesce(q.active, true))::int as questions_count
    from public.questions q
    join teacher_subjects s on s.id = q.subject_id
    group by q.subject_id
  ),
  classroom_agg as (
    select c.subject_id, count(*) filter (where coalesce(c.active, true))::int as classroom_count
    from public.classrooms c
    join teacher_subjects s on s.id = c.subject_id
    group by c.subject_id
  ),
  recent_courses as (
    select s.*,
      coalesce(e.enrolled_count, 0) as enrolled_count,
      coalesce(sc.played_count, 0) as played_count,
      coalesce(sc.average_score, 0) as average_score,
      coalesce(q.questions_count, 0) as questions_count,
      coalesce(c.classroom_count, 0) as classroom_count
    from teacher_subjects s
    left join enrollment_agg e on e.subject_id = s.id
    left join score_agg sc on sc.subject_id = s.id
    left join question_agg q on q.subject_id = s.id
    left join classroom_agg c on c.subject_id = s.id
    order by s.created_at desc, s.id desc
    limit 3
  ),
  problem_questions as (
    select
      q.id,
      q.subject_id,
      s.name as subject_name,
      q.text,
      count(*) filter (where not ah.is_correct)::int as failures,
      count(*)::int as total_attempts,
      case when count(*) > 0 then round(100.0 * count(*) filter (where not ah.is_correct) / count(*))::int else 0 end as failure_rate
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join teacher_subjects s on s.id = q.subject_id
    group by q.id, q.subject_id, s.name, q.text
    having count(*) filter (where not ah.is_correct) > 0
    order by failures desc, failure_rate desc, q.id desc
    limit 5
  )
  select jsonb_build_object(
    'teacherAlias', coalesce((select p.alias from public.profiles p where p.id = v_teacher_id), 'Profesor'),
    'totals', jsonb_build_object(
      'courses', (select count(*)::int from teacher_subjects),
      'classrooms', (
        select count(*)::int from public.classrooms c
        join teacher_subjects s on s.id = c.subject_id
        where coalesce(c.active, true)
      ),
      'students', (
        select count(distinct e.student_id)::int from public.enrollments e
        join teacher_subjects s on s.id = e.subject_id
      ),
      'questions', (
        select count(*)::int from public.questions q
        join teacher_subjects s on s.id = q.subject_id
        where coalesce(q.active, true)
      ),
      'attempts', (
        select count(*)::int from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        join teacher_subjects s on s.id = q.subject_id
      ),
      'weeklyActiveStudents', (
        select count(distinct ah.student_id)::int from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        join teacher_subjects s on s.id = q.subject_id
        where ah.attempted_at >= now() - interval '7 days'
      )
    ),
    'openReviewCount', (
      select count(*)::int
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      join teacher_subjects s on s.id = q.subject_id
      where q.type = 'open_answer'
        and coalesce(ah.manual_review_status, 'pending') = 'pending'
    ),
    'emptyCourses', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.created_at desc)
      from teacher_subjects s
      left join enrollment_agg e on e.subject_id = s.id
      where coalesce(e.enrolled_count, 0) = 0
    ), '[]'::jsonb),
    'recentCourses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'description', r.description,
        'icon', r.icon,
        'code', r.code,
        'themeColor', r.theme_color,
        'enrolledCount', r.enrolled_count,
        'playedCount', r.played_count,
        'averageScore', r.average_score,
        'questionsCount', r.questions_count,
        'classroomCount', r.classroom_count
      ) order by r.created_at desc, r.id desc)
      from recent_courses r
    ), '[]'::jsonb),
    'problematicQuestions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'subjectId', p.subject_id,
        'subjectName', p.subject_name,
        'text', p.text,
        'failures', p.failures,
        'totalAttempts', p.total_attempts,
        'failureRate', p.failure_rate
      ) order by p.failures desc, p.failure_rate desc)
      from problem_questions p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_attention_students_page(
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Teacher session required';
  end if;

  with teacher_enrollments as (
    select
      e.student_id,
      e.subject_id,
      e.classroom_id,
      e.joined_at,
      coalesce(p.alias, 'Alumno') as student_name,
      s.name as subject_name,
      c.name as classroom_name
    from public.enrollments e
    join public.subjects s on s.id = e.subject_id and s.teacher_id = v_teacher_id
    left join public.classrooms c on c.id = e.classroom_id
    left join public.profiles p on p.id = e.student_id
    where not coalesce(s.is_archived, false)
      and coalesce(s.active, true)
      and coalesce(p.active, true)
  ),
  activity as (
    select
      te.student_id,
      te.subject_id,
      te.classroom_id,
      max(ah.attempted_at) as last_activity,
      count(ah.id)::int as attempts_count,
      count(ah.id) filter (where ah.is_correct)::int as correct_count
    from teacher_enrollments te
    left join public.questions q
      on q.subject_id = te.subject_id
      and (te.classroom_id is null or q.classroom_id = te.classroom_id)
      and coalesce(q.active, true)
    left join public.attempt_history ah
      on ah.question_id = q.id
      and ah.student_id = te.student_id
    group by te.student_id, te.subject_id, te.classroom_id
  ),
  rows as (
    select
      te.*,
      a.last_activity,
      a.attempts_count,
      case when a.attempts_count > 0 then round(100.0 * a.correct_count / a.attempts_count)::int else 0 end as accuracy_percent,
      case
        when a.last_activity is null then 'no_activity'
        when a.attempts_count >= 3 and (100.0 * a.correct_count / nullif(a.attempts_count, 0)) < 50 then 'needs_help'
        when a.last_activity < now() - interval '14 days' then 'inactive'
        else 'active'
      end as attention_reason,
      case
        when a.last_activity is null then 9999
        else greatest(0, floor(extract(epoch from (now() - a.last_activity)) / 86400))::int
      end as days_inactive
    from teacher_enrollments te
    join activity a
      on a.student_id = te.student_id
      and a.subject_id = te.subject_id
      and a.classroom_id is not distinct from te.classroom_id
  ),
  attention_rows as (
    select * from rows where attention_reason <> 'active'
  ),
  page_rows as (
    select *
    from attention_rows
    order by
      case attention_reason when 'no_activity' then 0 when 'needs_help' then 1 else 2 end,
      days_inactive desc,
      student_name asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', concat(student_id::text, ':', subject_id::text, ':', coalesce(classroom_id::text, 'all')),
        'studentId', student_id,
        'studentName', student_name,
        'subjectId', subject_id,
        'subjectName', subject_name,
        'classroomId', classroom_id,
        'classroomName', classroom_name,
        'lastActivity', last_activity,
        'daysInactive', days_inactive,
        'accuracyPercent', accuracy_percent,
        'reason', attention_reason
      ) order by case attention_reason when 'no_activity' then 0 when 'needs_help' then 1 else 2 end, days_inactive desc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from attention_rows),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_recent_activity_page(
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
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Teacher session required';
  end if;

  with activity_rows as (
    select
      concat('enrollment:', e.id::text) as id,
      'enrollment'::text as event_type,
      e.joined_at as event_at,
      e.student_id,
      coalesce(p.alias, 'Alumno') as student_name,
      s.id as subject_id,
      s.name as subject_name,
      c.id as classroom_id,
      c.name as classroom_name,
      null::bigint as question_id,
      null::text as question_text,
      null::boolean as is_correct,
      null::integer as earned_points
    from public.enrollments e
    join public.subjects s on s.id = e.subject_id and s.teacher_id = v_teacher_id
    left join public.classrooms c on c.id = e.classroom_id
    left join public.profiles p on p.id = e.student_id
    where not coalesce(s.is_archived, false)
      and e.student_id is not null

    union all

    select
      concat('attempt:', ah.id::text) as id,
      'attempt'::text as event_type,
      coalesce(ah.attempted_at, ah.created_at, now()) as event_at,
      ah.student_id,
      coalesce(p.alias, 'Alumno') as student_name,
      s.id as subject_id,
      s.name as subject_name,
      q.classroom_id,
      c.name as classroom_name,
      q.id as question_id,
      q.text as question_text,
      ah.is_correct,
      coalesce(ah.earned_points, 0)::int as earned_points
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.classrooms c on c.id = q.classroom_id
    left join public.profiles p on p.id = ah.student_id
    where not coalesce(s.is_archived, false)
  ),
  page_rows as (
    select * from activity_rows
    order by event_at desc, id desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'type', event_type,
        'eventAt', event_at,
        'studentId', student_id,
        'studentName', student_name,
        'subjectId', subject_id,
        'subjectName', subject_name,
        'classroomId', classroom_id,
        'classroomName', classroom_name,
        'questionId', question_id,
        'questionText', question_text,
        'isCorrect', is_correct,
        'earnedPoints', earned_points
      ) order by event_at desc, id desc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from activity_rows),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_courses_page(
  p_search text default null,
  p_status text default null,
  p_sort text default 'recent',
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_sort text := case when p_sort in ('recent', 'name', 'participation') then p_sort else 'recent' end;
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Teacher session required';
  end if;

  with teacher_subjects as (
    select s.id, s.name, s.description, s.icon, s.code, s.theme_color, s.created_at
    from public.subjects s
    where s.teacher_id = v_teacher_id
      and not coalesce(s.is_archived, false)
      and coalesce(s.active, true)
  ),
  enrollment_agg as (
    select e.subject_id,
      count(distinct e.student_id)::int as enrolled_count,
      count(distinct e.student_id) filter (where e.joined_at >= now() - interval '7 days')::int as enrolled_this_week
    from public.enrollments e
    join teacher_subjects s on s.id = e.subject_id
    group by e.subject_id
  ),
  score_agg as (
    select ss.subject_id,
      count(distinct ss.student_id)::int as played_count,
      coalesce(round(avg(coalesce(ss.max_score, 0))), 0)::int as average_score
    from public.subject_scores ss
    join teacher_subjects s on s.id = ss.subject_id
    group by ss.subject_id
  ),
  question_agg as (
    select q.subject_id,
      count(*) filter (where coalesce(q.active, true))::int as questions_count,
      count(*) filter (where coalesce(q.active, true) and q.created_at >= now() - interval '7 days')::int as questions_this_week
    from public.questions q
    join teacher_subjects s on s.id = q.subject_id
    group by q.subject_id
  ),
  topic_agg as (
    select t.subject_id, count(*) filter (where coalesce(t.active, true))::int as topics_count
    from public.subject_topics t
    join teacher_subjects s on s.id = t.subject_id
    group by t.subject_id
  ),
  attempt_agg as (
    select q.subject_id,
      count(distinct ah.student_id)::int as active_students_count,
      count(distinct concat(ah.student_id::text, ':', ah.question_id::text))::int as answered_questions_count,
      count(distinct ah.student_id) filter (where ah.attempted_at >= now() - interval '7 days')::int as active_students_this_week,
      count(*) filter (where ah.attempted_at >= now() - interval '7 days')::int as played_this_week
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id and coalesce(q.active, true)
    join teacher_subjects s on s.id = q.subject_id
    group by q.subject_id
  ),
  rows as (
    select
      s.*,
      coalesce(e.enrolled_count, 0) as enrolled_count,
      coalesce(a.active_students_count, 0) as active_students_count,
      coalesce(sc.played_count, 0) as played_count,
      coalesce(a.answered_questions_count, 0) as answered_questions_count,
      coalesce(e.enrolled_count, 0) * coalesce(q.questions_count, 0) as available_questions_count,
      coalesce(sc.average_score, 0) as average_score,
      coalesce(q.questions_count, 0) as questions_count,
      coalesce(t.topics_count, 0) as topics_count,
      coalesce(e.enrolled_this_week, 0) as enrolled_this_week,
      coalesce(a.active_students_this_week, 0) as active_students_this_week,
      coalesce(a.played_this_week, 0) as played_this_week,
      coalesce(q.questions_this_week, 0) as questions_this_week,
      case
        when coalesce(q.questions_count, 0) = 0 or coalesce(e.enrolled_count, 0) = 0 then 'unconfigured'
        when coalesce(a.answered_questions_count, 0) = 0 then 'no_activity'
        when coalesce(a.answered_questions_count, 0) >= coalesce(e.enrolled_count, 0) * coalesce(q.questions_count, 0) then 'completed'
        else 'in_progress'
      end as status,
      case when coalesce(e.enrolled_count, 0) > 0
        then round(100.0 * coalesce(a.active_students_count, 0) / e.enrolled_count)::int
        else 0 end as participation_rate
    from teacher_subjects s
    left join enrollment_agg e on e.subject_id = s.id
    left join score_agg sc on sc.subject_id = s.id
    left join question_agg q on q.subject_id = s.id
    left join topic_agg t on t.subject_id = s.id
    left join attempt_agg a on a.subject_id = s.id
  ),
  filtered as (
    select * from rows
    where (v_search is null or concat_ws(' ', name, description, code) ilike '%' || v_search || '%')
      and (v_status is null or v_status = 'all' or status = v_status)
  ),
  page_rows as (
    select * from filtered
    order by
      case when v_sort = 'name' then lower(name) end asc,
      case when v_sort = 'participation' then participation_rate end desc,
      case when v_sort = 'participation' then played_count end desc,
      case when v_sort = 'recent' then created_at end desc,
      id desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'description', description,
        'icon', icon,
        'code', code,
        'themeColor', theme_color,
        'createdAt', created_at,
        'status', status,
        'analytics', jsonb_build_object(
          'enrolledCount', enrolled_count,
          'activeStudentsCount', active_students_count,
          'playedCount', played_count,
          'answeredQuestionsCount', answered_questions_count,
          'availableQuestionsCount', available_questions_count,
          'averageScore', average_score,
          'questionsCount', questions_count,
          'topicsCount', topics_count,
          'enrolledThisWeek', enrolled_this_week,
          'activeStudentsThisWeek', active_students_this_week,
          'playedThisWeek', played_this_week,
          'questionsThisWeek', questions_this_week
        )
      ) order by
        case when v_sort = 'name' then lower(name) end asc,
        case when v_sort = 'participation' then participation_rate end desc,
        case when v_sort = 'recent' then created_at end desc,
        id desc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from filtered),
    'summary', jsonb_build_object(
      'courses', (select count(*)::int from rows),
      'students', (select coalesce(sum(enrolled_count), 0)::int from rows),
      'activeStudents', (select coalesce(sum(active_students_count), 0)::int from rows),
      'questions', (select coalesce(sum(questions_count), 0)::int from rows),
      'played', (select coalesce(sum(played_count), 0)::int from rows),
      'answeredQuestions', (select coalesce(sum(answered_questions_count), 0)::int from rows),
      'availableQuestions', (select coalesce(sum(available_questions_count), 0)::int from rows),
      'weightedScore', (select coalesce(sum(average_score * played_count), 0)::bigint from rows),
      'enrolledThisWeek', (select coalesce(sum(enrolled_this_week), 0)::int from rows),
      'activeStudentsThisWeek', (select coalesce(sum(active_students_this_week), 0)::int from rows),
      'playedThisWeek', (select coalesce(sum(played_this_week), 0)::int from rows),
      'questionsThisWeek', (select coalesce(sum(questions_this_week), 0)::int from rows)
    ),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_classrooms_page(
  p_search text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Teacher session required';
  end if;

  with teacher_classrooms as (
    select
      c.id, c.subject_id, c.name, c.code, c.academic_year, c.created_at, c.active,
      s.name as course_name, s.description as course_description, s.icon as course_icon,
      s.code as course_code, s.theme_color as course_theme_color, s.created_at as course_created_at
    from public.classrooms c
    join public.subjects s on s.id = c.subject_id and s.teacher_id = v_teacher_id
    where coalesce(c.active, true)
      and not coalesce(s.is_archived, false)
      and coalesce(s.active, true)
  ),
  enrollment_agg as (
    select e.classroom_id, count(distinct e.student_id)::int as students_count
    from public.enrollments e
    join teacher_classrooms c on c.id = e.classroom_id
    group by e.classroom_id
  ),
  question_agg as (
    select q.classroom_id, count(*) filter (where coalesce(q.active, true))::int as questions_count
    from public.questions q
    join teacher_classrooms c on c.id = q.classroom_id
    group by q.classroom_id
  ),
  topic_agg as (
    select t.classroom_id, count(*) filter (where coalesce(t.active, true))::int as topics_count
    from public.subject_topics t
    join teacher_classrooms c on c.id = t.classroom_id
    group by t.classroom_id
  ),
  rows as (
    select c.*,
      coalesce(e.students_count, 0) as students_count,
      coalesce(q.questions_count, 0) as questions_count,
      coalesce(t.topics_count, 0) as topics_count
    from teacher_classrooms c
    left join enrollment_agg e on e.classroom_id = c.id
    left join question_agg q on q.classroom_id = c.id
    left join topic_agg t on t.classroom_id = c.id
    where v_search is null
      or concat_ws(' ', c.name, c.code, c.academic_year, c.course_name) ilike '%' || v_search || '%'
  ),
  page_rows as (
    select * from rows order by created_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'classroom', jsonb_build_object(
          'id', id,
          'subjectId', subject_id,
          'name', name,
          'code', code,
          'academicYear', academic_year,
          'createdAt', created_at,
          'active', active
        ),
        'course', jsonb_build_object(
          'id', subject_id,
          'name', course_name,
          'description', course_description,
          'icon', course_icon,
          'code', course_code,
          'themeColor', course_theme_color,
          'createdAt', course_created_at
        ),
        'analytics', jsonb_build_object(
          'studentsCount', students_count,
          'questionsCount', questions_count,
          'topicsCount', topics_count
        )
      ) order by created_at desc, id desc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from rows),
    'summary', jsonb_build_object(
      'classrooms', (select count(*)::int from teacher_classrooms),
      'courses', (select count(distinct subject_id)::int from teacher_classrooms)
    ),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_subject_overview(
  p_subject_id bigint,
  p_classroom_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_classroom_id bigint;
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Teacher session required';
  end if;

  if not exists (
    select 1 from public.subjects s
    where s.id = p_subject_id and s.teacher_id = v_teacher_id and not coalesce(s.is_archived, false)
  ) then
    raise exception 'Course not found';
  end if;

  select c.id into v_classroom_id
  from public.classrooms c
  where c.subject_id = p_subject_id
    and coalesce(c.active, true)
    and (p_classroom_id is null or c.id = p_classroom_id)
  order by case when c.id = p_classroom_id then 0 else 1 end, c.created_at asc, c.id asc
  limit 1;

  if v_classroom_id is null then
    v_classroom_id := public.ensure_default_classroom(p_subject_id);
  end if;

  with selected_questions as (
    select q.id, q.text, q.created_at
    from public.questions q
    where q.subject_id = p_subject_id
      and q.classroom_id = v_classroom_id
      and coalesce(q.active, true)
  ),
  selected_enrollments as (
    select e.student_id
    from public.enrollments e
    where e.subject_id = p_subject_id and e.classroom_id = v_classroom_id
  ),
  attempts as (
    select ah.*
    from public.attempt_history ah
    join selected_questions q on q.id = ah.question_id
    join selected_enrollments e on e.student_id = ah.student_id
  ),
  student_metrics as (
    select
      e.student_id,
      count(a.id)::int as total_answers,
      count(a.id) filter (where a.is_correct)::int as correct_answers,
      max(a.attempted_at) as last_activity
    from selected_enrollments e
    left join attempts a on a.student_id = e.student_id
    group by e.student_id
  ),
  summary as (
    select
      (select count(*)::int from selected_enrollments) as enrolled_count,
      (select count(*)::int from selected_questions) as questions_count,
      (select count(*)::int from attempts) as total_answers,
      (select count(*) filter (where is_correct)::int from attempts) as correct_answers,
      (select count(distinct student_id)::int from attempts) as active_students,
      (select count(distinct concat(student_id::text, ':', question_id::text))::int from attempts) as answered_pairs,
      (select coalesce(round(avg(coalesce(ss.max_score, 0))), 0)::int
         from public.subject_scores ss
         where ss.subject_id = p_subject_id and ss.classroom_id = v_classroom_id) as average_xp
  )
  select jsonb_build_object(
    'subject', (
      select jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'icon', s.icon,
        'code', s.code,
        'educationLevel', s.education_level,
        'academicYear', s.academic_year,
        'subjectLabel', s.subject_label,
        'themeColor', s.theme_color,
        'createdAt', s.created_at
      )
      from public.subjects s where s.id = p_subject_id
    ),
    'classrooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'academicYear', c.academic_year,
        'active', c.active,
        'code', c.code
      ) order by c.created_at asc, c.id asc)
      from public.classrooms c
      where c.subject_id = p_subject_id and coalesce(c.active, true)
    ), '[]'::jsonb),
    'selectedClassroomId', v_classroom_id,
    'subjectsCount', (
      select count(*)::int from public.subjects s
      where s.teacher_id = v_teacher_id and not coalesce(s.is_archived, false) and coalesce(s.active, true)
    ),
    'summary', (
      select jsonb_build_object(
        'enrolledCount', enrolled_count,
        'questionsCount', questions_count,
        'totalAnswers', total_answers,
        'correctAnswers', correct_answers,
        'answeredClassQuestions', answered_pairs,
        'possibleClassQuestions', enrolled_count * questions_count,
        'activeStudents', active_students,
        'averageXp', average_xp,
        'averageAccuracy', case when total_answers > 0 then round(100.0 * correct_answers / total_answers)::int else 0 end,
        'averageGrade', case when total_answers > 0 then round((10.0 * correct_answers / total_answers)::numeric, 1) else 0 end,
        'participation', case when enrolled_count > 0 then round(100.0 * active_students / enrolled_count)::int else 0 end,
        'progress', case when enrolled_count * questions_count > 0 then round(100.0 * answered_pairs / (enrolled_count * questions_count))::int else 0 end
      ) from summary
    ),
    'latestQuestion', (
      select jsonb_build_object('id', q.id, 'text', q.text, 'createdAt', q.created_at)
      from selected_questions q order by q.created_at desc, q.id desc limit 1
    ),
    'gradeDistribution', jsonb_build_array(
      jsonb_build_object('label', 'Excelente (9-10)', 'count', (select count(*)::int from student_metrics where total_answers > 0 and 10.0 * correct_answers / total_answers >= 9)),
      jsonb_build_object('label', 'Bueno (7-8.9)', 'count', (select count(*)::int from student_metrics where total_answers > 0 and 10.0 * correct_answers / total_answers >= 7 and 10.0 * correct_answers / total_answers < 9)),
      jsonb_build_object('label', 'Regular (5-6.9)', 'count', (select count(*)::int from student_metrics where total_answers > 0 and 10.0 * correct_answers / total_answers >= 5 and 10.0 * correct_answers / total_answers < 7)),
      jsonb_build_object('label', 'Necesita apoyo (<5)', 'count', (select count(*)::int from student_metrics where total_answers = 0 or 10.0 * correct_answers / nullif(total_answers, 0) < 5))
    ),
    'recentActivity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'studentName', x.student_name,
        'questionText', x.question_text,
        'isCorrect', x.is_correct,
        'earnedPoints', x.earned_points,
        'attemptedAt', x.attempted_at
      ) order by x.attempted_at desc, x.id desc)
      from (
        select ah.id, coalesce(p.alias, 'Alumno') as student_name, q.text as question_text,
          ah.is_correct, coalesce(ah.earned_points, 0)::int as earned_points, ah.attempted_at
        from attempts ah
        join public.questions q on q.id = ah.question_id
        left join public.profiles p on p.id = ah.student_id
        order by ah.attempted_at desc, ah.id desc
        limit 5
      ) x
    ), '[]'::jsonb)
  ) into v_result
  from summary;

  return v_result;
end;
$$;

create or replace function public.get_teacher_subject_topics_page(
  p_subject_id bigint,
  p_classroom_id bigint,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  if not exists (
    select 1 from public.classrooms c where c.id = p_classroom_id and c.subject_id = p_subject_id and coalesce(c.active, true)
  ) then
    raise exception 'Classroom not found';
  end if;

  with topic_rows as (
    select
      t.id::text as row_id,
      t.id,
      t.title,
      t.description,
      t.icon,
      t.sort_order,
      t.available_until,
      count(distinct q.id) filter (where coalesce(q.active, true))::int as questions_count,
      count(distinct ts.student_id)::int as played_count,
      coalesce(round(avg(coalesce(ts.max_score, 0))), 0)::int as average_score,
      t.created_at
    from public.subject_topics t
    left join public.questions q on q.topic_id = t.id and q.classroom_id = p_classroom_id
    left join public.topic_scores ts on ts.topic_id = t.id and ts.classroom_id = p_classroom_id
    where t.subject_id = p_subject_id
      and t.classroom_id = p_classroom_id
      and coalesce(t.active, true)
    group by t.id, t.title, t.description, t.icon, t.sort_order, t.available_until, t.created_at

    union all

    select
      'general'::text as row_id,
      null::bigint as id,
      'Tema general'::text as title,
      'Preguntas todavía no organizadas en un tema.'::text as description,
      'layers-outline'::text as icon,
      0::int as sort_order,
      null::timestamptz as available_until,
      count(distinct q.id)::int as questions_count,
      count(distinct ah.student_id)::int as played_count,
      coalesce(round(avg(coalesce(ah.earned_points, 0))), 0)::int as average_score,
      min(q.created_at) as created_at
    from public.questions q
    left join public.attempt_history ah on ah.question_id = q.id
    where q.subject_id = p_subject_id
      and q.classroom_id = p_classroom_id
      and q.topic_id is null
      and coalesce(q.active, true)
    having count(q.id) > 0
  ),
  page_rows as (
    select * from topic_rows order by sort_order asc, created_at asc nulls last, row_id asc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', case when row_id = 'general' then to_jsonb('general'::text) else to_jsonb(id) end,
        'title', title,
        'description', description,
        'icon', icon,
        'sortOrder', sort_order,
        'availableUntil', available_until,
        'questionsCount', questions_count,
        'playedCount', played_count,
        'averageScore', average_score
      ) order by sort_order asc, created_at asc nulls last, row_id asc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from topic_rows),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_subject_questions_page(
  p_subject_id bigint,
  p_classroom_id bigint,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  with rows as (
    select
      q.id, q.text, q.type, q.points_base, q.time_limit_seconds, q.difficulty,
      q.explanation, q.topic_id, q.classroom_id, q.created_at, q.updated_at,
      q.media_type, q.media_path, q.media_alt_text, q.media_caption,
      t.title as topic_title,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'text', a.text,
          'is_correct', a.is_correct,
          'sort_order', a.sort_order
        ) order by a.sort_order asc, a.id asc)
        from public.answers a where a.question_id = q.id
      ), '[]'::jsonb) as answers
    from public.questions q
    left join public.subject_topics t on t.id = q.topic_id
    where q.subject_id = p_subject_id
      and q.classroom_id = p_classroom_id
      and coalesce(q.active, true)
      and (p_topic_id is null or q.topic_id = p_topic_id)
      and (not p_general_topic or q.topic_id is null)
      and (p_difficulty is null or q.difficulty = p_difficulty)
      and (v_search is null or concat_ws(' ', q.text, q.explanation, t.title, q.type) ilike '%' || v_search || '%')
  ),
  page_rows as (
    select * from rows order by created_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'text', text,
        'type', type,
        'points_base', points_base,
        'time_limit_seconds', time_limit_seconds,
        'difficulty', difficulty,
        'explanation', explanation,
        'topic_id', topic_id,
        'classroom_id', classroom_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'media_type', media_type,
        'media_path', media_path,
        'media_alt_text', media_alt_text,
        'media_caption', media_caption,
        'topicTitle', topic_title,
        'answers', answers
      ) order by created_at desc, id desc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from rows),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_subject_students_page(
  p_subject_id bigint,
  p_classroom_id bigint,
  p_search text default null,
  p_status text default null,
  p_sort text default 'xp',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_sort text := case when p_sort in ('xp', 'progress', 'grade', 'recent', 'last_activity') then p_sort else 'xp' end;
  v_question_count integer;
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  select count(*)::int into v_question_count
  from public.questions q
  where q.subject_id = p_subject_id and q.classroom_id = p_classroom_id and coalesce(q.active, true);

  with attempts as (
    select ah.student_id,
      count(*)::int as total_answers,
      count(*) filter (where ah.is_correct)::int as correct_answers,
      max(ah.attempted_at) as last_activity
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    where q.subject_id = p_subject_id and q.classroom_id = p_classroom_id
    group by ah.student_id
  ),
  base_rows as (
    select
      e.student_id as id,
      coalesce(p.alias, 'Alumno') as name,
      coalesce(ss.max_score, 0)::int as score,
      coalesce(a.total_answers, 0)::int as total_answers,
      coalesce(a.correct_answers, 0)::int as correct_answers,
      coalesce(a.total_answers - a.correct_answers, 0)::int as failed_answers,
      coalesce(a.last_activity, ss.played_at) as last_activity,
      case
        when a.total_answers > 0 then round(100.0 * a.correct_answers / a.total_answers)::int
        else 0
      end as accuracy_percent,
      case
        when a.total_answers > 0 then round((10.0 * a.correct_answers / a.total_answers)::numeric, 1)
        else 0
      end as grade,
      case
        when v_question_count > 0 then least(100, round(100.0 * coalesce(a.total_answers, 0) / v_question_count)::int)
        else 0
      end as participation,
      greatest(
        case when ss.played_at is not null then 1 else 0 end,
        coalesce(cardinality(ss.played_days), 0),
        case when v_question_count > 0 then ceil(coalesce(a.total_answers, 0)::numeric / v_question_count)::int else 0 end
      )::int as played_sessions,
      (coalesce(a.total_answers, 0) > 0 or ss.played_at is not null) as has_activity
    from public.enrollments e
    left join public.profiles p on p.id = e.student_id
    left join public.subject_scores ss
      on ss.student_id = e.student_id and ss.subject_id = p_subject_id and ss.classroom_id = p_classroom_id
    left join attempts a on a.student_id = e.student_id
    where e.subject_id = p_subject_id
      and e.classroom_id = p_classroom_id
      and coalesce(p.active, true)
  ),
  rows as (
    select b.*,
      case
        when not b.has_activity then 'no_activity'
        when b.participation < 35 or b.grade < 5 then 'needs_help'
        when b.last_activity < now() - interval '14 days' or b.participation < 60 then 'inactive'
        else 'active'
      end as status
    from base_rows b
  ),
  filtered as (
    select * from rows
    where (v_search is null or name ilike '%' || v_search || '%')
      and (v_status is null or v_status = 'all' or status = v_status)
  ),
  page_rows as (
    select * from filtered
    order by
      case when v_sort = 'progress' then participation end desc,
      case when v_sort = 'grade' then grade end desc,
      case when v_sort in ('recent', 'last_activity') then last_activity end desc nulls last,
      case when v_sort = 'xp' then score end desc,
      name asc,
      id asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'score', score,
        'grade', grade,
        'accuracyPercent', accuracy_percent,
        'correctAnswers', correct_answers,
        'failedAnswers', failed_answers,
        'participation', participation,
        'playedSessions', played_sessions,
        'lastActivity', last_activity,
        'hasActivity', has_activity,
        'status', status
      ) order by
        case when v_sort = 'progress' then participation end desc,
        case when v_sort = 'grade' then grade end desc,
        case when v_sort in ('recent', 'last_activity') then last_activity end desc nulls last,
        case when v_sort = 'xp' then score end desc,
        name asc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from filtered),
    'summary', jsonb_build_object(
      'enrolled', (select count(*)::int from rows),
      'answered', (select count(*) filter (where has_activity)::int from rows),
      'participation', (select case when count(*) > 0 then round(100.0 * count(*) filter (where has_activity) / count(*))::int else 0 end from rows),
      'averageGrade', (select coalesce(round(avg(grade)::numeric, 1), 0) from rows where has_activity),
      'averageAccuracy', (select coalesce(round(avg(accuracy_percent)), 0)::int from rows where has_activity),
      'failedAnswers', (select coalesce(sum(failed_answers), 0)::int from rows),
      'correctAnswers', (select coalesce(sum(correct_answers), 0)::int from rows),
      'averageXp', (select coalesce(round(avg(score)), 0)::int from rows),
      'questionsCount', v_question_count
    ),
    'gradeDistribution', jsonb_build_array(
      jsonb_build_object('label', 'Excelente (9-10)', 'count', (select count(*)::int from rows where grade >= 9)),
      jsonb_build_object('label', 'Bueno (7-8.9)', 'count', (select count(*)::int from rows where grade >= 7 and grade < 9)),
      jsonb_build_object('label', 'Regular (5-6.9)', 'count', (select count(*)::int from rows where grade >= 5 and grade < 7)),
      jsonb_build_object('label', 'Necesita apoyo (<5)', 'count', (select count(*)::int from rows where grade < 5))
    ),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_subject_analytics(
  p_subject_id bigint,
  p_classroom_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_students jsonb;
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  v_students := public.get_teacher_subject_students_page(
    p_subject_id, p_classroom_id, null, null, 'xp', 200, 0
  );

  with failed_questions as (
    select
      q.id,
      q.text,
      coalesce(t.title, 'Tema general') as topic,
      count(*) filter (where not ah.is_correct)::int as failures,
      count(*)::int as total_attempts,
      case when count(*) > 0 then round(100.0 * count(*) filter (where not ah.is_correct) / count(*))::int else 0 end as failure_rate
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.subject_topics t on t.id = q.topic_id
    where q.subject_id = p_subject_id and q.classroom_id = p_classroom_id
    group by q.id, q.text, t.title
    having count(*) filter (where not ah.is_correct) > 0
    order by failures desc, failure_rate desc
    limit 8
  ),
  weeks as (
    select generate_series(0, 5) as index
  ),
  evolution as (
    select
      w.index,
      date_trunc('week', now()) - ((5 - w.index) * interval '7 days') as starts_at,
      date_trunc('week', now()) - ((4 - w.index) * interval '7 days') as ends_at
    from weeks w
  ),
  evolution_rows as (
    select
      e.index,
      e.starts_at,
      count(ah.id)::int as activity_count,
      coalesce(round(avg(coalesce(ah.earned_points, 0))), 0)::int as average_score
    from evolution e
    left join public.questions q
      on q.subject_id = p_subject_id and q.classroom_id = p_classroom_id
    left join public.attempt_history ah
      on ah.question_id = q.id and ah.attempted_at >= e.starts_at and ah.attempted_at < e.ends_at
    group by e.index, e.starts_at
    order by e.index
  )
  select v_students || jsonb_build_object(
    'failedQuestions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'text', text,
        'topic', topic,
        'actualFailures', failures,
        'totalAttempts', total_attempts,
        'failureRate', failure_rate
      ) order by failures desc, failure_rate desc)
      from failed_questions
    ), '[]'::jsonb),
    'temporalEvolution', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', to_char(starts_at, 'DD Mon'),
        'activityCount', activity_count,
        'averageScore', average_score
      ) order by index)
      from evolution_rows
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_dashboard_summary() from public;
revoke all on function public.get_teacher_attention_students_page(integer, integer) from public;
revoke all on function public.get_teacher_recent_activity_page(integer, integer) from public;
revoke all on function public.get_teacher_courses_page(text, text, text, integer, integer) from public;
revoke all on function public.get_teacher_classrooms_page(text, integer, integer) from public;
revoke all on function public.get_teacher_subject_overview(bigint, bigint) from public;
revoke all on function public.get_teacher_subject_topics_page(bigint, bigint, integer, integer) from public;
revoke all on function public.get_teacher_subject_questions_page(bigint, bigint, bigint, boolean, integer, text, integer, integer) from public;
revoke all on function public.get_teacher_subject_students_page(bigint, bigint, text, text, text, integer, integer) from public;
revoke all on function public.get_teacher_subject_analytics(bigint, bigint) from public;

grant execute on function public.get_teacher_dashboard_summary() to authenticated;
grant execute on function public.get_teacher_attention_students_page(integer, integer) to authenticated;
grant execute on function public.get_teacher_recent_activity_page(integer, integer) to authenticated;
grant execute on function public.get_teacher_courses_page(text, text, text, integer, integer) to authenticated;
grant execute on function public.get_teacher_classrooms_page(text, integer, integer) to authenticated;
grant execute on function public.get_teacher_subject_overview(bigint, bigint) to authenticated;
grant execute on function public.get_teacher_subject_topics_page(bigint, bigint, integer, integer) to authenticated;
grant execute on function public.get_teacher_subject_questions_page(bigint, bigint, bigint, boolean, integer, text, integer, integer) to authenticated;
grant execute on function public.get_teacher_subject_students_page(bigint, bigint, text, text, text, integer, integer) to authenticated;
grant execute on function public.get_teacher_subject_analytics(bigint, bigint) to authenticated;

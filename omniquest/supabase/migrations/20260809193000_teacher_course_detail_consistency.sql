-- Final teacher course-detail consistency: canonical metrics and evaluated-only grade distributions.

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
         from selected_enrollments e
         left join public.subject_scores ss
           on ss.student_id = e.student_id and ss.subject_id = p_subject_id and ss.classroom_id = v_classroom_id) as average_xp
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
      jsonb_build_object('label', 'Notable (7-8.9)', 'count', (select count(*)::int from student_metrics where total_answers > 0 and 10.0 * correct_answers / total_answers >= 7 and 10.0 * correct_answers / total_answers < 9)),
      jsonb_build_object('label', 'Aprobado (5-6.9)', 'count', (select count(*)::int from student_metrics where total_answers > 0 and 10.0 * correct_answers / total_answers >= 5 and 10.0 * correct_answers / total_answers < 7)),
      jsonb_build_object('label', 'Suspenso (<5)', 'count', (select count(*)::int from student_metrics where total_answers > 0 and 10.0 * correct_answers / total_answers < 5))
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
      a.last_activity as last_activity,
      case when a.total_answers > 0 then round(100.0 * a.correct_answers / a.total_answers)::int else 0 end as accuracy_percent,
      case when a.total_answers > 0 then round((10.0 * a.correct_answers / a.total_answers)::numeric, 1) else 0 end as grade,
      case when v_question_count > 0 then least(100, round(100.0 * coalesce(a.total_answers, 0) / v_question_count)::int) else 0 end as participation,
      case when v_question_count > 0 then ceil(coalesce(a.total_answers, 0)::numeric / v_question_count)::int else case when coalesce(a.total_answers, 0) > 0 then 1 else 0 end end as played_sessions,
      (coalesce(a.total_answers, 0) > 0) as has_activity
    from public.enrollments e
    left join public.profiles p on p.id = e.student_id
    left join public.subject_scores ss on ss.student_id = e.student_id and ss.subject_id = p_subject_id and ss.classroom_id = p_classroom_id
    left join attempts a on a.student_id = e.student_id
    where e.subject_id = p_subject_id and e.classroom_id = p_classroom_id and coalesce(p.active, true)
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
      'answered', (select count(*) filter (where total_answers > 0)::int from rows),
      'participation', (select case when count(*) > 0 then round(100.0 * count(*) filter (where total_answers > 0) / count(*))::int else 0 end from rows),
      'activeThisWeek', (select count(*) filter (where total_answers > 0 and last_activity >= now() - interval '7 days')::int from rows),
      'averageGrade', (select coalesce(round(avg(grade)::numeric, 1), 0) from rows where total_answers > 0),
      'averageAccuracy', (select case when coalesce(sum(total_answers), 0) > 0 then round(100.0 * sum(correct_answers) / sum(total_answers))::int else 0 end from rows),
      'failedAnswers', (select coalesce(sum(failed_answers), 0)::int from rows),
      'correctAnswers', (select coalesce(sum(correct_answers), 0)::int from rows),
      'averageXp', (select coalesce(round(avg(score)), 0)::int from rows),
      'questionsCount', v_question_count
    ),
    'gradeDistribution', jsonb_build_array(
      jsonb_build_object('label', 'Excelente (9-10)', 'count', (select count(*)::int from rows where total_answers > 0 and grade >= 9)),
      jsonb_build_object('label', 'Notable (7-8.9)', 'count', (select count(*)::int from rows where total_answers > 0 and grade >= 7 and grade < 9)),
      jsonb_build_object('label', 'Aprobado (5-6.9)', 'count', (select count(*)::int from rows where total_answers > 0 and grade >= 5 and grade < 7)),
      jsonb_build_object('label', 'Suspenso (<5)', 'count', (select count(*)::int from rows where total_answers > 0 and grade < 5))
    ),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_subject_overview(bigint, bigint) from public, anon;
revoke all on function public.get_teacher_subject_students_page(bigint, bigint, text, text, text, integer, integer) from public, anon;
grant execute on function public.get_teacher_subject_overview(bigint, bigint) to authenticated;
grant execute on function public.get_teacher_subject_students_page(bigint, bigint, text, text, text, integer, integer) to authenticated;

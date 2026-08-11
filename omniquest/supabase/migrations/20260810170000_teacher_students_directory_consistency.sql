-- Teacher students directory consistency hardening.
-- Keeps filter counts semantically exact, decouples priority previews from the current page,
-- and introduces a real composite `attention` filter.

create or replace function public.get_teacher_students_page(
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_status text default null,
  p_search text default null,
  p_order text default 'attention',
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
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
  v_order text := lower(trim(coalesce(p_order, 'attention')));
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Teacher session required';
  end if;

  if p_subject_id is not null and not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found or access denied';
  end if;

  if p_classroom_id is not null and not exists (
    select 1
    from public.classrooms c
    join public.subjects s on s.id = c.subject_id
    where c.id = p_classroom_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or s.id = p_subject_id)
  ) then
    raise exception 'Classroom not found or access denied';
  end if;

  if v_status is not null and v_status not in ('active', 'inactive', 'needs_help', 'no_activity', 'excellent', 'attention') then
    raise exception 'Invalid student status';
  end if;
  if v_order not in ('attention', 'accuracy', 'xp', 'last_activity', 'name') then
    v_order := 'attention';
  end if;

  with teacher_subjects as (
    select s.id, s.name
    from public.subjects s
    where s.teacher_id = v_teacher_id
      and coalesce(s.active, true)
      and not coalesce(s.is_archived, false)
  ),
  scoped_enrollments as (
    select e.id, e.student_id, e.subject_id, e.classroom_id, e.joined_at, s.name as subject_name, c.name as classroom_name
    from public.enrollments e
    join teacher_subjects s on s.id = e.subject_id
    left join public.classrooms c on c.id = e.classroom_id
    where (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ),
  student_context as (
    select
      e.student_id,
      min(e.joined_at) as imported_at,
      array_agg(distinct e.subject_id order by e.subject_id) as subject_ids,
      array_agg(distinct e.subject_name order by e.subject_name) as subject_names,
      array_agg(distinct e.classroom_id order by e.classroom_id) filter (where e.classroom_id is not null) as classroom_ids,
      array_agg(distinct coalesce(e.classroom_name, 'Clase principal') order by coalesce(e.classroom_name, 'Clase principal')) as classroom_names,
      jsonb_agg(jsonb_build_object(
        'subjectId', e.subject_id,
        'subjectName', e.subject_name,
        'classroomId', e.classroom_id,
        'classroomName', coalesce(e.classroom_name, 'Clase principal'),
        'joinedAt', e.joined_at
      ) order by e.joined_at, e.id) as course_contexts
    from scoped_enrollments e
    group by e.student_id
  ),
  scoped_questions as (
    select distinct q.id, q.subject_id, q.classroom_id, q.topic_id
    from public.questions q
    join teacher_subjects s on s.id = q.subject_id
    where coalesce(q.active, true)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
  ),
  available_question_counts as (
    select sc.student_id, count(distinct q.id)::int as available_questions
    from student_context sc
    join scoped_enrollments e on e.student_id = sc.student_id
    join scoped_questions q on q.subject_id = e.subject_id
      and (e.classroom_id is null or q.classroom_id is null or q.classroom_id = e.classroom_id)
    group by sc.student_id
  ),
  attempt_agg as (
    select
      sc.student_id,
      count(ah.id) filter (where q.id is not null)::int as attempts_count,
      count(ah.id) filter (where q.id is not null and ah.is_correct)::int as correct_count,
      count(distinct ah.question_id) filter (where q.id is not null)::int as answered_questions,
      coalesce(sum(coalesce(ah.earned_points, 0)) filter (where q.id is not null), 0)::int as earned_points,
      max(ah.attempted_at) filter (where q.id is not null) as last_activity_at
    from student_context sc
    left join public.attempt_history ah on ah.student_id = sc.student_id
    left join scoped_questions q on q.id = ah.question_id
    group by sc.student_id
  ),
  score_agg as (
    select
      sc.student_id,
      coalesce(sum(coalesce(ss.max_score, 0)), 0)::int as subject_xp,
      max(ss.played_at) as score_activity_at
    from student_context sc
    left join public.subject_scores ss on ss.student_id = sc.student_id
      and ss.subject_id = any(sc.subject_ids)
      and (p_classroom_id is null or ss.classroom_id = p_classroom_id)
    group by sc.student_id
  ),
  calculated as (
    select
      sc.student_id,
      coalesce(p.alias, 'Alumno sin perfil') as alias,
      p.email,
      coalesce(p.points, 0)::int as global_points,
      coalesce(sa.subject_xp, 0)::int as subject_xp,
      coalesce(aa.attempts_count, 0)::int as attempts_count,
      coalesce(aa.correct_count, 0)::int as correct_count,
      coalesce(aa.answered_questions, 0)::int as answered_questions,
      coalesce(aqc.available_questions, 0)::int as available_questions,
      case when coalesce(aa.attempts_count, 0) > 0 then round(100.0 * coalesce(aa.correct_count, 0) / aa.attempts_count)::int else 0 end as accuracy_percent,
      case when coalesce(aqc.available_questions, 0) > 0 then least(100, round(100.0 * coalesce(aa.answered_questions, 0) / aqc.available_questions)::int) else 0 end as participation_percent,
      greatest(aa.last_activity_at, sa.score_activity_at) as last_activity_at,
      sc.imported_at,
      sc.subject_ids,
      sc.subject_names,
      coalesce(sc.classroom_ids, '{}'::bigint[]) as classroom_ids,
      sc.classroom_names,
      sc.course_contexts,
      case
        when coalesce(aa.attempts_count, 0) = 0 and coalesce(sa.subject_xp, 0) = 0 then 'no_activity'
        when coalesce(aa.attempts_count, 0) >= 3 and (100.0 * coalesce(aa.correct_count, 0) / nullif(aa.attempts_count, 0)) < 50 then 'needs_help'
        when greatest(aa.last_activity_at, sa.score_activity_at) < now() - interval '14 days' then 'inactive'
        when coalesce(aa.attempts_count, 0) >= 5 and (100.0 * coalesce(aa.correct_count, 0) / nullif(aa.attempts_count, 0)) >= 85 then 'excellent'
        else 'active'
      end as status
    from student_context sc
    join public.profiles p on p.id = sc.student_id
      and p.role_id = 'student'
      and coalesce(p.active, true)
    left join attempt_agg aa on aa.student_id = sc.student_id
    left join score_agg sa on sa.student_id = sc.student_id
    left join available_question_counts aqc on aqc.student_id = sc.student_id
  ),
  searched as (
    select *
    from calculated c
    where (
      v_search is null
      or c.alias ilike '%' || v_search || '%'
      or coalesce(c.email, '') ilike '%' || v_search || '%'
      or array_to_string(c.subject_names, ' ') ilike '%' || v_search || '%'
      or array_to_string(c.classroom_names, ' ') ilike '%' || v_search || '%'
    )
  ),
  filtered as (
    select *
    from searched c
    where v_status is null
      or (v_status = 'attention' and c.status in ('needs_help', 'inactive'))
      or (v_status <> 'attention' and c.status = v_status)
  ),
  page_rows as (
    select *
    from filtered
    order by
      case when v_order = 'attention' then case status when 'needs_help' then 1 when 'inactive' then 2 when 'no_activity' then 3 when 'active' then 4 else 5 end end,
      case when v_order = 'accuracy' then accuracy_percent end desc,
      case when v_order = 'xp' then subject_xp end desc,
      case when v_order = 'last_activity' then last_activity_at end desc nulls last,
      case when v_order = 'name' then alias end asc,
      alias asc,
      student_id
    limit v_limit offset v_offset
  ),
  item_rows as (
    select
      p.*,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'title', w.topic_title,
          'detail', w.subject_name,
          'mistakes', w.mistakes,
          'accuracyPercent', w.accuracy_percent
        ) order by w.mistakes desc, w.accuracy_percent asc)
        from (
          select
            coalesce(t.title, 'Práctica general') as topic_title,
            s.name as subject_name,
            count(ah.id) filter (where not ah.is_correct)::int as mistakes,
            case when count(ah.id) > 0 then round(100.0 * count(ah.id) filter (where ah.is_correct) / count(ah.id))::int else 0 end as accuracy_percent
          from public.attempt_history ah
          join scoped_questions q on q.id = ah.question_id
          join public.subjects s on s.id = q.subject_id
          left join public.subject_topics t on t.id = q.topic_id
          where ah.student_id = p.student_id
          group by t.id, t.title, s.id, s.name
          having count(ah.id) filter (where not ah.is_correct) > 0
          order by mistakes desc, accuracy_percent asc
          limit 4
        ) w
      ), '[]'::jsonb) as weak_areas,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'questionText', r.question_text,
          'topicTitle', r.topic_title,
          'subjectName', r.subject_name,
          'isCorrect', r.is_correct,
          'attemptedAt', r.attempted_at,
          'earnedPoints', r.earned_points
        ) order by r.attempted_at desc, r.id desc)
        from (
          select ah.id, q.text as question_text, coalesce(t.title, 'Práctica general') as topic_title,
            s.name as subject_name, ah.is_correct, ah.attempted_at, coalesce(ah.earned_points, 0)::int as earned_points
          from public.attempt_history ah
          join public.questions q on q.id = ah.question_id
          join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
          left join public.subject_topics t on t.id = q.topic_id
          where ah.student_id = p.student_id
            and (p_subject_id is null or q.subject_id = p_subject_id)
            and (p_classroom_id is null or q.classroom_id = p_classroom_id)
          order by ah.attempted_at desc, ah.id desc
          limit 8
        ) r
      ), '[]'::jsonb) as recent_attempts
    from page_rows p
  ),
  preview_rows as (
    select 'attention'::text as preview_kind, a.*
    from (
      select *
      from searched
      where status in ('needs_help', 'inactive')
      order by case status when 'needs_help' then 1 else 2 end, accuracy_percent asc, last_activity_at asc nulls first, alias, student_id
      limit 4
    ) a
    union all
    select 'pending'::text as preview_kind, p.*
    from (
      select *
      from searched
      where status = 'no_activity'
      order by imported_at asc nulls first, alias, student_id
      limit 4
    ) p
  ),
  preview_item_rows as (
    select
      p.*,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'title', w.topic_title,
          'detail', w.subject_name,
          'mistakes', w.mistakes,
          'accuracyPercent', w.accuracy_percent
        ) order by w.mistakes desc, w.accuracy_percent asc)
        from (
          select
            coalesce(t.title, 'Práctica general') as topic_title,
            s.name as subject_name,
            count(ah.id) filter (where not ah.is_correct)::int as mistakes,
            case when count(ah.id) > 0 then round(100.0 * count(ah.id) filter (where ah.is_correct) / count(ah.id))::int else 0 end as accuracy_percent
          from public.attempt_history ah
          join scoped_questions q on q.id = ah.question_id
          join public.subjects s on s.id = q.subject_id
          left join public.subject_topics t on t.id = q.topic_id
          where ah.student_id = p.student_id
          group by t.id, t.title, s.id, s.name
          having count(ah.id) filter (where not ah.is_correct) > 0
          order by mistakes desc, accuracy_percent asc
          limit 4
        ) w
      ), '[]'::jsonb) as weak_areas,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'questionText', r.question_text,
          'topicTitle', r.topic_title,
          'subjectName', r.subject_name,
          'isCorrect', r.is_correct,
          'attemptedAt', r.attempted_at,
          'earnedPoints', r.earned_points
        ) order by r.attempted_at desc, r.id desc)
        from (
          select ah.id, q.text as question_text, coalesce(t.title, 'Práctica general') as topic_title,
            s.name as subject_name, ah.is_correct, ah.attempted_at, coalesce(ah.earned_points, 0)::int as earned_points
          from public.attempt_history ah
          join public.questions q on q.id = ah.question_id
          join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
          left join public.subject_topics t on t.id = q.topic_id
          where ah.student_id = p.student_id
            and (p_subject_id is null or q.subject_id = p_subject_id)
            and (p_classroom_id is null or q.classroom_id = p_classroom_id)
          order by ah.attempted_at desc, ah.id desc
          limit 8
        ) r
      ), '[]'::jsonb) as recent_attempts
    from preview_rows p
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.student_id,
        'alias', i.alias,
        'handle', '@' || regexp_replace(lower(i.alias), '\\s+', '', 'g'),
        'globalPoints', i.global_points,
        'subjectScore', i.subject_xp,
        'averageScore', round(i.accuracy_percent / 10.0, 1),
        'accuracyPercent', i.accuracy_percent,
        'challenges', i.attempts_count,
        'questions', i.answered_questions,
        'participation', i.participation_percent,
        'progress', i.participation_percent,
        'status', i.status,
        'hasActivity', i.attempts_count > 0 or i.subject_xp > 0,
        'subjectIds', to_jsonb(i.subject_ids),
        'subjectNames', to_jsonb(i.subject_names),
        'classroomIds', to_jsonb(i.classroom_ids),
        'classroomNames', to_jsonb(i.classroom_names),
        'courseContexts', i.course_contexts,
        'weakAreas', i.weak_areas,
        'recentAttempts', i.recent_attempts,
        'lastActivityAt', i.last_activity_at,
        'importedAt', i.imported_at
      ) order by
        case when v_order = 'attention' then case i.status when 'needs_help' then 1 when 'inactive' then 2 when 'no_activity' then 3 when 'active' then 4 else 5 end end,
        case when v_order = 'accuracy' then i.accuracy_percent end desc,
        case when v_order = 'xp' then i.subject_xp end desc,
        case when v_order = 'last_activity' then i.last_activity_at end desc nulls last,
        case when v_order = 'name' then i.alias end asc,
        i.alias asc
      ) from item_rows i
    ), '[]'::jsonb),
    'total', (select count(*)::int from filtered),
    'limit', v_limit,
    'offset', v_offset,
    'summary', jsonb_build_object(
      'total', (select count(*)::int from searched),
      'active', (select count(*)::int from searched where status = 'active'),
      'excellent', (select count(*)::int from searched where status = 'excellent'),
      'inactive', (select count(*)::int from searched where status = 'inactive'),
      'noActivity', (select count(*)::int from searched where status = 'no_activity'),
      'needsHelp', (select count(*)::int from searched where status = 'needs_help'),
      'attention', (select count(*)::int from searched where status in ('needs_help', 'inactive')),
      'withActivity', (select count(*)::int from searched where attempts_count > 0 or subject_xp > 0),
      'averageXp', coalesce((select round(avg(subject_xp))::int from searched where attempts_count > 0 or subject_xp > 0), 0),
      'averageGrade', coalesce((select round(avg(accuracy_percent / 10.0), 1) from searched where attempts_count > 0), 0),
      'averageAccuracy', coalesce((select round(avg(accuracy_percent))::int from searched where attempts_count > 0), 0),
      'completedChallenges', coalesce((select sum(attempts_count)::int from searched), 0)
    ),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name, s.id)
      from teacher_subjects s
    ), '[]'::jsonb),
    'classrooms', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'subject_id', c.subject_id, 'name', c.name, 'academic_year', c.academic_year) order by c.name, c.id)
      from public.classrooms c
      join teacher_subjects s on s.id = c.subject_id
      where coalesce(c.active, true)
    ), '[]'::jsonb),
    'attention', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.student_id,
        'alias', p.alias,
        'handle', '@' || regexp_replace(lower(p.alias), '\\s+', '', 'g'),
        'globalPoints', p.global_points,
        'subjectScore', p.subject_xp,
        'averageScore', round(p.accuracy_percent / 10.0, 1),
        'accuracyPercent', p.accuracy_percent,
        'challenges', p.attempts_count,
        'questions', p.answered_questions,
        'participation', p.participation_percent,
        'progress', p.participation_percent,
        'status', p.status,
        'hasActivity', p.attempts_count > 0 or p.subject_xp > 0,
        'subjectIds', to_jsonb(p.subject_ids),
        'subjectNames', to_jsonb(p.subject_names),
        'classroomIds', to_jsonb(p.classroom_ids),
        'classroomNames', to_jsonb(p.classroom_names),
        'courseContexts', p.course_contexts,
        'weakAreas', p.weak_areas,
        'recentAttempts', p.recent_attempts,
        'lastActivityAt', p.last_activity_at,
        'importedAt', p.imported_at
      ) order by case p.status when 'needs_help' then 1 else 2 end, p.alias, p.student_id)
      from preview_item_rows p
      where p.preview_kind = 'attention'
    ), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.student_id,
        'alias', p.alias,
        'handle', '@' || regexp_replace(lower(p.alias), '\\s+', '', 'g'),
        'globalPoints', p.global_points,
        'subjectScore', p.subject_xp,
        'averageScore', round(p.accuracy_percent / 10.0, 1),
        'accuracyPercent', p.accuracy_percent,
        'challenges', p.attempts_count,
        'questions', p.answered_questions,
        'participation', p.participation_percent,
        'progress', p.participation_percent,
        'status', p.status,
        'hasActivity', p.attempts_count > 0 or p.subject_xp > 0,
        'subjectIds', to_jsonb(p.subject_ids),
        'subjectNames', to_jsonb(p.subject_names),
        'classroomIds', to_jsonb(p.classroom_ids),
        'classroomNames', to_jsonb(p.classroom_names),
        'courseContexts', p.course_contexts,
        'weakAreas', p.weak_areas,
        'recentAttempts', p.recent_attempts,
        'lastActivityAt', p.last_activity_at,
        'importedAt', p.imported_at
      ) order by p.alias, p.student_id)
      from preview_item_rows p
      where p.preview_kind = 'pending'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_teacher_students_page(bigint, bigint, text, text, text, integer, integer) is
  'Returns a server-paginated teacher student directory with stable facet counts, exact status semantics and server-computed priority previews.';

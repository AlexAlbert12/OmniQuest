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
    select
      s.id,
      s.name,
      s.description,
      s.icon,
      s.code,
      s.theme_color,
      s.created_at,
      coalesce(s.active, true) as active,
      coalesce(s.is_archived, false) as is_archived,
      s.archived_at,
      s.archive_reason,
      s.retention_until
    from public.subjects s
    where s.teacher_id = v_teacher_id
      and (
        coalesce(s.is_archived, false)
        or (not coalesce(s.is_archived, false) and coalesce(s.active, true))
      )
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
  active_rows as (
    select * from rows where not is_archived and active
  ),
  archived_rows as (
    select * from rows where is_archived
  ),
  filtered as (
    select * from rows
    where (v_search is null or concat_ws(' ', name, description, code) ilike '%' || v_search || '%')
      and (
        (v_status = 'archived' and is_archived)
        or (
          v_status is distinct from 'archived'
          and not is_archived
          and active
          and (v_status is null or v_status = 'all' or status = v_status)
        )
      )
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
        'active', active,
        'isArchived', is_archived,
        'archivedAt', archived_at,
        'archiveReason', archive_reason,
        'retentionUntil', retention_until,
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
      'courses', (select count(*)::int from active_rows),
      'archivedCourses', (select count(*)::int from archived_rows),
      'students', (select coalesce(sum(enrolled_count), 0)::int from active_rows),
      'activeStudents', (select coalesce(sum(active_students_count), 0)::int from active_rows),
      'questions', (select coalesce(sum(questions_count), 0)::int from active_rows),
      'played', (select coalesce(sum(played_count), 0)::int from active_rows),
      'answeredQuestions', (select coalesce(sum(answered_questions_count), 0)::int from active_rows),
      'availableQuestions', (select coalesce(sum(available_questions_count), 0)::int from active_rows),
      'weightedScore', (select coalesce(sum(average_score * played_count), 0)::bigint from active_rows),
      'enrolledThisWeek', (select coalesce(sum(enrolled_this_week), 0)::int from active_rows),
      'activeStudentsThisWeek', (select coalesce(sum(active_students_this_week), 0)::int from active_rows),
      'playedThisWeek', (select coalesce(sum(played_this_week), 0)::int from active_rows),
      'questionsThisWeek', (select coalesce(sum(questions_this_week), 0)::int from active_rows)
    ),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_courses_page(text, text, text, integer, integer) from public, anon;
grant execute on function public.get_teacher_courses_page(text, text, text, integer, integer) to authenticated;

create or replace function public.start_game_attempt(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
  v_classroom_id bigint;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_difficulty is not null and p_difficulty not in (1, 2, 3) then
    raise exception 'Invalid difficulty';
  end if;

  if not exists (
    select 1
    from public.subjects s
    where s.id = p_subject_id
      and s.active is true
      and coalesce(s.is_archived, false) is false
  ) then
    raise exception 'Este curso no está disponible para jugar.';
  end if;

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1
    from public.classrooms c
    where c.id = v_classroom_id
      and c.subject_id = p_subject_id
      and coalesce(c.active, true)
  ) then
    raise exception 'Classroom does not belong to this subject';
  end if;

  if not exists (
    select 1
    from public.enrollments e
    where e.student_id = v_user_id
      and e.subject_id = p_subject_id
      and (e.classroom_id = v_classroom_id or (e.classroom_id is null and v_classroom_id is not null))
  ) then
    raise exception 'Student is not enrolled in this classroom';
  end if;

  if p_topic_id is not null then
    perform public.assert_topic_playable(p_topic_id);

    if not exists (
      select 1
      from public.subject_topics st
      where st.id = p_topic_id
        and st.subject_id = p_subject_id
        and st.classroom_id = v_classroom_id
        and coalesce(st.active, true)
    ) then
      raise exception 'Topic does not belong to this classroom';
    end if;
  end if;

  insert into public.game_attempts (student_id, subject_id, classroom_id, topic_id)
  values (v_user_id, p_subject_id, v_classroom_id, case when p_general_topic then null else p_topic_id end)
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.start_game_attempt(bigint, bigint, bigint, boolean, integer) from public, anon;
grant execute on function public.start_game_attempt(bigint, bigint, bigint, boolean, integer) to authenticated;

create or replace function public.get_safe_game_questions(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null,
  p_review_failed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_classroom_id bigint;
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_difficulty is not null and p_difficulty not in (1, 2, 3) then
    raise exception 'Invalid difficulty';
  end if;

  if not exists (
    select 1
    from public.subjects s
    where s.id = p_subject_id
      and s.active is true
      and coalesce(s.is_archived, false) is false
  ) then
    raise exception 'Este curso no está disponible para jugar.';
  end if;

  if p_topic_id is not null then
    perform public.assert_topic_playable(p_topic_id);
  end if;

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1
    from public.classrooms c
    join public.subjects s on s.id = c.subject_id
    where c.id = v_classroom_id
      and c.subject_id = p_subject_id
      and coalesce(c.active, true)
      and (
        s.teacher_id = v_user_id
        or public.is_admin()
        or exists (
          select 1
          from public.enrollments e
          where e.student_id = v_user_id
            and e.subject_id = p_subject_id
            and (e.classroom_id = c.id or e.classroom_id is null)
        )
      )
  ) then
    raise exception 'No puedes acceder a esta clase.';
  end if;

  select coalesce(jsonb_agg(question_payload order by random()), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'difficulty', coalesce(q.difficulty, 1),
      'points_base', q.points_base,
      'time_limit_seconds', q.time_limit_seconds,
      'topic_id', q.topic_id,
      'classroom_id', q.classroom_id,
      'question_updated_at', q.updated_at,
      'media_type', q.media_type,
      'media_url', null,
      'media_alt_text', q.media_alt_text,
      'media_caption', q.media_caption,
      'blank_count',
        case
          when q.type = 'fill_blank' then (
            select count(*)
            from public.answers a
            where a.question_id = q.id
              and coalesce(a.is_correct, true)
              and public.normalize_answer_text(a.text) <> ''
          )
          else null
        end,
      'answers',
        case
          when q.type in ('open_answer', 'fill_blank') then '[]'::jsonb
          when q.type in ('match_pairs', 'drag_drop') then (
            select coalesce(
              jsonb_agg(jsonb_build_object('id', a.id, 'text', split_part(a.text, '|||', 1)) order by random()),
              '[]'::jsonb
            )
            from public.answers a
            where a.question_id = q.id
          )
          else (
            select coalesce(
              jsonb_agg(jsonb_build_object('id', a.id, 'text', a.text) order by random()),
              '[]'::jsonb
            )
            from public.answers a
            where a.question_id = q.id
          )
        end,
      'pair_options',
        case
          when q.type in ('match_pairs', 'drag_drop') then (
            select coalesce(jsonb_agg(pair_right order by random()), '[]'::jsonb)
            from (
              select split_part(a.text, '|||', 2) as pair_right
              from public.answers a
              where a.question_id = q.id
                and split_part(a.text, '|||', 2) <> ''
            ) pairs
          )
          else '[]'::jsonb
        end
    ) as question_payload
    from public.questions q
    left join public.subject_topics st on st.id = q.topic_id
    where q.subject_id = p_subject_id
      and q.classroom_id = v_classroom_id
      and coalesce(q.active, true)
      and (q.topic_id is null or st.available_until is null or st.available_until > now())
      and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
      and (
        (p_general_topic and q.topic_id is null)
        or (not p_general_topic and p_topic_id is null)
        or (not p_general_topic and p_topic_id is not null and q.topic_id = p_topic_id)
      )
      and (
        not p_review_failed
        or exists (
          select 1
          from (
            select distinct on (ah.question_id)
              ah.question_id,
              ah.is_correct
            from public.attempt_history ah
            where ah.student_id = v_user_id
            order by ah.question_id, ah.attempted_at desc, ah.id desc
          ) latest
          where latest.question_id = q.id
            and latest.is_correct = false
        )
      )
  ) safe_questions;

  return v_result;
end;
$$;

revoke all on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) from public, anon;
grant execute on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) to authenticated;

create or replace function public.get_student_question_catalog(
  p_subject_id bigint default null,
  p_classroom_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select coalesce(jsonb_agg(question_payload order by subject_id, classroom_id, topic_id nulls first, id), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', q.id,
      'subject_id', q.subject_id,
      'classroom_id', q.classroom_id,
      'topic_id', q.topic_id,
      'text', q.text,
      'type', q.type,
      'difficulty', coalesce(q.difficulty, 1),
      'active', coalesce(q.active, true)
    ) as question_payload,
    q.id,
    q.subject_id,
    q.classroom_id,
    q.topic_id
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    where coalesce(q.active, true)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
      and (
        public.is_admin()
        or s.teacher_id = v_user_id
        or (
          s.active is true
          and coalesce(s.is_archived, false) is false
          and exists (
            select 1
            from public.enrollments e
            where e.student_id = v_user_id
              and e.subject_id = q.subject_id
              and (e.classroom_id = q.classroom_id or e.classroom_id is null)
          )
        )
      )
  ) catalog;

  return v_result;
end;
$$;

revoke all on function public.get_student_question_catalog(bigint, bigint) from public, anon;
grant execute on function public.get_student_question_catalog(bigint, bigint) to authenticated;

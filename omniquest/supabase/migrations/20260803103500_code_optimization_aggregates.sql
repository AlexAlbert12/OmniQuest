create index if not exists attempt_history_student_attempted_at_desc_idx
  on public.attempt_history (student_id, attempted_at desc);

create index if not exists attempt_history_student_question_idx
  on public.attempt_history (student_id, question_id);

create index if not exists questions_subject_classroom_active_idx
  on public.questions (subject_id, classroom_id, active, id);

create index if not exists subject_topics_subject_classroom_active_idx
  on public.subject_topics (subject_id, classroom_id, active, id);

create index if not exists enrollments_student_joined_at_idx
  on public.enrollments (student_id, joined_at desc);

create or replace function public.get_student_progress_summary()
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
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role_id = 'student'
      and coalesce(p.active, true) = true
  ) then
    raise exception 'Student access required.' using errcode = '42501';
  end if;

  with enrolled as (
    select
      e.subject_id,
      e.classroom_id,
      e.joined_at,
      s.name,
      s.description,
      s.icon,
      s.theme_color,
      c.name as classroom_name,
      c.code as classroom_code
    from public.enrollments e
    join public.subjects s on s.id = e.subject_id
    left join public.classrooms c on c.id = e.classroom_id
    where e.student_id = v_user_id
      and coalesce(s.active, true) = true
      and coalesce(s.is_archived, false) = false
      and (c.id is null or coalesce(c.active, true) = true)
  ), progress_rows as (
    select
      e.subject_id as id,
      e.classroom_id,
      e.classroom_name,
      e.classroom_code,
      e.name,
      e.description,
      e.icon,
      e.theme_color,
      e.joined_at,
      coalesce(question_stats.total_questions, 0)::integer as total_questions,
      coalesce(question_stats.answered_questions, 0)::integer as answered_questions,
      coalesce(question_stats.failed_questions, 0)::integer as failed_questions,
      coalesce(topic_stats.total_topics, 0)::integer as total_topics,
      coalesce(topic_stats.completed_topics, 0)::integer as completed_topics,
      coalesce(attempt_stats.total_attempts, 0)::integer as total_attempts,
      coalesce(attempt_stats.correct_attempts, 0)::integer as correct_attempts
    from enrolled e
    left join lateral (
      select
        count(*)::integer as total_questions,
        count(*) filter (
          where exists (
            select 1
            from public.attempt_history ah
            where ah.student_id = v_user_id
              and ah.question_id = q.id
          )
        )::integer as answered_questions,
        count(*) filter (
          where exists (
            select 1
            from public.attempt_history ah
            where ah.student_id = v_user_id
              and ah.question_id = q.id
              and ah.is_correct = false
          )
        )::integer as failed_questions
      from public.questions q
      where q.subject_id = e.subject_id
        and coalesce(q.active, true) = true
        and (e.classroom_id is null or q.classroom_id = e.classroom_id)
    ) question_stats on true
    left join lateral (
      select
        count(*)::integer as total_topics,
        count(*) filter (
          where exists (
            select 1
            from public.questions q
            where q.topic_id = t.id
              and coalesce(q.active, true) = true
              and (e.classroom_id is null or q.classroom_id = e.classroom_id)
          )
          and not exists (
            select 1
            from public.questions q
            where q.topic_id = t.id
              and coalesce(q.active, true) = true
              and (e.classroom_id is null or q.classroom_id = e.classroom_id)
              and not exists (
                select 1
                from public.attempt_history ah
                where ah.student_id = v_user_id
                  and ah.question_id = q.id
              )
          )
        )::integer as completed_topics
      from public.subject_topics t
      where t.subject_id = e.subject_id
        and coalesce(t.active, true) = true
        and (e.classroom_id is null or t.classroom_id = e.classroom_id)
    ) topic_stats on true
    left join lateral (
      select
        count(ah.id)::integer as total_attempts,
        count(ah.id) filter (where ah.is_correct = true)::integer as correct_attempts
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.student_id = v_user_id
        and q.subject_id = e.subject_id
        and coalesce(q.active, true) = true
        and (e.classroom_id is null or q.classroom_id = e.classroom_id)
    ) attempt_stats on true
  ), totals as (
    select
      count(*)::integer as total_classes,
      count(*) filter (where total_questions > 0 and answered_questions >= total_questions)::integer as completed_classes,
      coalesce(sum(total_questions), 0)::integer as total_questions,
      coalesce(sum(answered_questions), 0)::integer as answered_questions,
      coalesce(sum(total_attempts), 0)::integer as total_attempts,
      coalesce(sum(correct_attempts), 0)::integer as correct_attempts
    from progress_rows
  )
  select jsonb_build_object(
    'subjects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'classroomId', pr.classroom_id,
          'classroomName', pr.classroom_name,
          'classroomCode', pr.classroom_code,
          'name', pr.name,
          'description', pr.description,
          'icon', pr.icon,
          'theme_color', pr.theme_color,
          'totalTopics', pr.total_topics,
          'completedTopics', pr.completed_topics,
          'totalQuestions', pr.total_questions,
          'answeredQuestions', pr.answered_questions,
          'pendingQuestions', greatest(0, pr.total_questions - pr.answered_questions),
          'failedQuestions', pr.failed_questions,
          'percent', case when pr.total_questions > 0 then round((pr.answered_questions::numeric / pr.total_questions::numeric) * 100)::integer else 0 end,
          'isCompleted', pr.total_questions > 0 and pr.answered_questions >= pr.total_questions
        )
        order by pr.joined_at desc, pr.id
      )
      from progress_rows pr
    ), '[]'::jsonb),
    'totalClasses', totals.total_classes,
    'completedClasses', totals.completed_classes,
    'totalQuestions', totals.total_questions,
    'answeredQuestions', totals.answered_questions,
    'totalAttempts', totals.total_attempts,
    'correctAttempts', totals.correct_attempts,
    'accuracyPercent', case when totals.total_attempts > 0 then round((totals.correct_attempts::numeric / totals.total_attempts::numeric) * 100)::integer else 0 end,
    'overallPercent', case when totals.total_questions > 0 then round((totals.answered_questions::numeric / totals.total_questions::numeric) * 100)::integer else 0 end
  )
  into v_result
  from totals;

  return coalesce(v_result, jsonb_build_object(
    'subjects', '[]'::jsonb,
    'totalClasses', 0,
    'completedClasses', 0,
    'totalQuestions', 0,
    'answeredQuestions', 0,
    'totalAttempts', 0,
    'correctAttempts', 0,
    'accuracyPercent', 0,
    'overallPercent', 0
  ));
end;
$$;

create or replace function public.get_student_home_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile jsonb;
  v_progress jsonb;
  v_subjects jsonb := '[]'::jsonb;
  v_ranking jsonb := '[]'::jsonb;
  v_today_attempts integer := 0;
  v_weekly_attempts integer := 0;
  v_streak integer := 0;
  v_timezone text := 'Europe/Madrid';
  v_today date;
  v_today_start timestamptz;
  v_tomorrow_start timestamptz;
  v_week_start timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'alias', p.alias,
    'avatar', p.avatar,
    'points', coalesce(p.points, 0),
    'role_id', p.role_id,
    'visibility', p.visibility
  )
  into v_profile
  from public.profiles p
  where p.id = v_user_id
    and p.role_id = 'student'
    and coalesce(p.active, true) = true;

  if v_profile is null then
    raise exception 'Student access required.' using errcode = '42501';
  end if;

  select coalesce(up.timezone, 'Europe/Madrid')
  into v_timezone
  from public.user_preferences up
  where up.user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'Europe/Madrid');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'Europe/Madrid';
  end if;
  v_today := (now() at time zone v_timezone)::date;
  v_today_start := v_today::timestamp at time zone v_timezone;
  v_tomorrow_start := (v_today + 1)::timestamp at time zone v_timezone;
  v_week_start := date_trunc('week', v_today::timestamp) at time zone v_timezone;

  v_progress := public.get_student_progress_summary();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', (item ->> 'id')::bigint,
    'classroom_id', nullif(item ->> 'classroomId', '')::bigint,
    'classroom_name', item ->> 'classroomName',
    'classroom_code', item ->> 'classroomCode',
    'name', item ->> 'name',
    'description', item ->> 'description',
    'icon', item ->> 'icon',
    'theme_color', item ->> 'theme_color'
  )), '[]'::jsonb)
  into v_subjects
  from jsonb_array_elements(coalesce(v_progress -> 'subjects', '[]'::jsonb)) item;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.points desc, r.alias asc), '[]'::jsonb)
  into v_ranking
  from public.get_ranking_profiles(5) r;

  select count(*)::integer
  into v_today_attempts
  from public.attempt_history ah
  where ah.student_id = v_user_id
    and ah.attempted_at >= v_today_start
    and ah.attempted_at < v_tomorrow_start;

  select count(*)::integer
  into v_weekly_attempts
  from public.attempt_history ah
  where ah.student_id = v_user_id
    and ah.attempted_at >= v_week_start
    and ah.attempted_at < v_tomorrow_start;

  with activity_days as (
    select distinct (ah.attempted_at at time zone v_timezone)::date as activity_date
    from public.attempt_history ah
    where ah.student_id = v_user_id
      and ah.attempted_at < v_tomorrow_start
  ), streak_base as (
    select case
      when exists (select 1 from activity_days where activity_date = v_today) then v_today
      when exists (select 1 from activity_days where activity_date = v_today - 1) then v_today - 1
      else null::date
    end as base_date
  ), numbered_days as (
    select
      activity.activity_date,
      base.base_date,
      row_number() over (order by activity.activity_date desc) as position
    from activity_days activity
    cross join streak_base base
    where base.base_date is not null
      and activity.activity_date <= base.base_date
  )
  select count(*)::integer
  into v_streak
  from numbered_days
  where activity_date = base_date - (position - 1)::integer;

  return jsonb_build_object(
    'currentUserId', v_user_id,
    'profile', v_profile,
    'subjects', v_subjects,
    'progressSummary', v_progress,
    'ranking', v_ranking,
    'todayAttemptCount', v_today_attempts,
    'weeklyAttemptCount', v_weekly_attempts,
    'streakDays', v_streak
  );
end;
$$;

revoke all on function public.get_student_progress_summary() from public, anon;
revoke all on function public.get_student_home_dashboard() from public, anon;
grant execute on function public.get_student_progress_summary() to authenticated;
grant execute on function public.get_student_home_dashboard() to authenticated;

comment on function public.get_student_progress_summary() is
  'Returns student course progress and attempt aggregates without exposing raw attempt_history rows.';
comment on function public.get_student_home_dashboard() is
  'Returns the complete student home payload in one server-side aggregate call.';

create or replace function public.sync_student_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total_answers integer := 0;
  v_correct_answers integer := 0;
  v_accuracy_percent integer := 0;
  v_total_points integer := 0;
  v_subjects_count integer := 0;
  v_practiced_subjects integer := 0;
  v_practiced_classrooms integer := 0;
  v_question_types_played integer := 0;
  v_streak_days integer := 0;
  v_cursor date;
  v_played_days date[] := '{}';
  v_awarded_xp integer := 0;
  v_new_awards jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select
    count(*)::integer,
    count(*) filter (where is_correct)::integer
  into v_total_answers, v_correct_answers
  from public.attempt_history
  where student_id = v_user_id;

  v_accuracy_percent := case
    when v_total_answers > 0 then least(100, round((v_correct_answers::numeric / v_total_answers::numeric) * 100)::integer)
    else 0
  end;

  select coalesce(points, 0)
  into v_total_points
  from public.profiles
  where id = v_user_id;

  select count(*)::integer
  into v_subjects_count
  from public.enrollments
  where student_id = v_user_id;

  select
    count(distinct q.subject_id)::integer,
    count(distinct q.classroom_id)::integer,
    count(distinct q.type)::integer
  into v_practiced_subjects, v_practiced_classrooms, v_question_types_played
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  where ah.student_id = v_user_id;

  select coalesce(array_agg(distinct played_day order by played_day), '{}')
  into v_played_days
  from (
    select attempted_at::date as played_day
    from public.attempt_history
    where student_id = v_user_id
  ) days;

  v_cursor := current_date;

  if not v_cursor = any(v_played_days) and (v_cursor - 1) = any(v_played_days) then
    v_cursor := v_cursor - 1;
  end if;

  while v_cursor = any(v_played_days) loop
    v_streak_days := v_streak_days + 1;
    v_cursor := v_cursor - 1;
  end loop;

  with eligible_badges (badge_id, reward_xp) as (
    values
      ('first-step', 50),
      ('first-session', 60),
      ('practice-25', 100),
      ('practice-100', 250),
      ('correct-50', 180),
      ('accuracy-80', 200),
      ('streak-3', 100),
      ('streak-7', 220),
      ('course-explorer', 150),
      ('class-explorer', 150),
      ('question-type-explorer', 120),
      ('xp-500', 120),
      ('xp-2000', 300)
  ),
  unlocked as (
    select badge_id, reward_xp
    from eligible_badges
    where
      (badge_id = 'first-step' and v_correct_answers >= 1)
      or (badge_id = 'first-session' and v_total_answers >= 5)
      or (badge_id = 'practice-25' and v_total_answers >= 25)
      or (badge_id = 'practice-100' and v_total_answers >= 100)
      or (badge_id = 'correct-50' and v_correct_answers >= 50)
      or (badge_id = 'accuracy-80' and v_total_answers >= 20 and v_accuracy_percent >= 80)
      or (badge_id = 'streak-3' and v_streak_days >= 3)
      or (badge_id = 'streak-7' and v_streak_days >= 7)
      or (badge_id = 'course-explorer' and v_practiced_subjects >= 3)
      or (badge_id = 'class-explorer' and v_practiced_classrooms >= 3)
      or (badge_id = 'question-type-explorer' and v_question_types_played >= 3)
      or (badge_id = 'xp-500' and v_total_points >= 500)
      or (badge_id = 'xp-2000' and v_total_points >= 2000)
  ),
  inserted as (
    insert into public.student_badges (student_id, badge_id, reward_xp, awarded_at)
    select v_user_id, badge_id, reward_xp, now()
    from unlocked
    on conflict (student_id, badge_id) do nothing
    returning badge_id, reward_xp, awarded_at
  )
  select
    coalesce(sum(reward_xp), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'badge_id', badge_id,
      'awarded_at', awarded_at,
      'reward_xp', reward_xp
    ) order by awarded_at desc), '[]'::jsonb)
  into v_awarded_xp, v_new_awards
  from inserted;

  return jsonb_build_object(
    'awarded_xp', v_awarded_xp,
    'new_awards', v_new_awards,
    'awards',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'badge_id', badge_id,
          'awarded_at', awarded_at,
          'reward_xp', reward_xp
        ) order by awarded_at desc)
        from public.student_badges
        where student_id = v_user_id
      ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.sync_student_badges() to authenticated;

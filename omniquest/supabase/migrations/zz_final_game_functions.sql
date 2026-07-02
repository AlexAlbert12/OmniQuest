create extension if not exists pgcrypto;

create or replace function public.normalize_answer_text(value text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')))
$$;

alter table public.questions
  add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade,
  add column if not exists difficulty integer default 1,
  add column if not exists explanation text;

alter table public.subject_topics
  add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade,
  add column if not exists available_until timestamptz;

alter table public.enrollments
  add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;

alter table public.game_attempts
  add column if not exists classroom_id bigint references public.classrooms(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists finished_at timestamptz;

alter table public.subject_scores
  add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade,
  add column if not exists correct_answers integer not null default 0,
  add column if not exists played_days date[] default '{}'::date[],
  add column if not exists played_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.topic_scores
  add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade,
  add column if not exists played_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.attempt_history
  add column if not exists submitted_answer_text text,
  add column if not exists submitted_answer_payload jsonb,
  add column if not exists earned_points integer not null default 0,
  add column if not exists hint_used boolean not null default false,
  add column if not exists was_skipped boolean not null default false,
  add column if not exists attempt_id uuid references public.game_attempts(id) on delete set null,
  add column if not exists manual_review_status text not null default 'not_required',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

alter table public.attempt_history
  drop constraint if exists attempt_history_manual_review_status_check;

alter table public.attempt_history
  add constraint attempt_history_manual_review_status_check
  check (manual_review_status in ('not_required', 'pending', 'approved', 'rejected'));

create index if not exists questions_game_lookup_idx
  on public.questions(subject_id, classroom_id, topic_id, difficulty)
  where coalesce(active, true);

create index if not exists attempt_history_student_attempted_at_idx
  on public.attempt_history(student_id, attempted_at desc);

create index if not exists attempt_history_question_attempted_at_idx
  on public.attempt_history(question_id, attempted_at desc);

create index if not exists attempt_history_attempt_id_idx
  on public.attempt_history(attempt_id);

create index if not exists attempt_history_manual_review_idx
  on public.attempt_history(manual_review_status, attempted_at desc);

create or replace function public.assert_topic_playable(p_topic_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available_until timestamptz;
begin
  if p_topic_id is null then
    return;
  end if;

  select available_until
  into v_available_until
  from public.subject_topics
  where id = p_topic_id;

  if v_available_until is not null and v_available_until <= now() then
    raise exception 'El tiempo límite de este tema ha terminado. Ya no se puede jugar.';
  end if;
end;
$$;

-- Remove older overloads to avoid Supabase RPC ambiguity and stale behavior.
drop function if exists public.start_game_attempt(bigint, bigint, boolean);
drop function if exists public.start_game_attempt(bigint, bigint, bigint, boolean);
drop function if exists public.start_game_attempt(bigint, bigint, bigint, boolean, integer);

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

-- Remove older overloads to avoid Supabase RPC ambiguity and stale behavior.
drop function if exists public.get_game_questions(bigint, bigint, boolean);
drop function if exists public.get_game_questions(bigint, bigint, bigint, boolean);
drop function if exists public.get_game_questions(bigint, bigint, bigint, boolean, integer);

create or replace function public.get_game_questions(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null
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
        or exists (
          select 1
          from public.enrollments e
          where e.classroom_id = c.id
            and e.student_id = v_user_id
        )
        or exists (
          select 1
          from public.enrollments e
          where e.classroom_id is null
            and e.subject_id = p_subject_id
            and e.student_id = v_user_id
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
      'explanation', q.explanation,
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
  ) safe_questions;

  return v_result;
end;
$$;

create or replace function public.submit_answer(
  p_question_id bigint,
  p_answer_id bigint default null,
  p_answer_text text default null,
  p_answer_payload jsonb default null,
  p_time_taken_seconds integer default null,
  p_hint_used boolean default false,
  p_skipped boolean default false,
  p_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question public.questions%rowtype;
  v_subject_id bigint;
  v_classroom_id bigint;
  v_topic_id bigint;
  v_is_correct boolean := false;
  v_requires_manual_review boolean := false;
  v_manual_review_status text := 'not_required';
  v_correct_answer_id bigint := null;
  v_time_limit integer := 30;
  v_remaining_seconds integer := 0;
  v_earned_points integer := 0;
  v_score_for_best integer := 0;
  v_today_key date := (now() at time zone 'Europe/Madrid')::date;
  v_existing_days date[] := '{}'::date[];
  v_payload_ids bigint[];
  v_correct_ids bigint[];
  v_payload_pair jsonb;
  v_pair_left text;
  v_pair_right text;
  v_pair_count integer := 0;
  v_matching_pair_count integer := 0;
  v_attempt public.game_attempts%rowtype;
  v_correct_answer_text text := null;
  v_attempt_history_id bigint;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select *
  into v_question
  from public.questions
  where id = p_question_id
    and coalesce(active, true);

  if not found then
    raise exception 'Question not found';
  end if;

  v_subject_id := v_question.subject_id;
  v_classroom_id := coalesce(v_question.classroom_id, public.ensure_default_classroom(v_question.subject_id));
  v_topic_id := v_question.topic_id;
  v_time_limit := coalesce(v_question.time_limit_seconds, 30);

  if v_topic_id is not null then
    perform public.assert_topic_playable(v_topic_id);
  end if;

  if not exists (
    select 1
    from public.enrollments e
    where e.student_id = v_user_id
      and e.subject_id = v_subject_id
      and (e.classroom_id = v_classroom_id or (e.classroom_id is null and v_classroom_id is not null))
  ) then
    raise exception 'Student is not enrolled in this classroom';
  end if;

  if p_attempt_id is not null then
    select *
    into v_attempt
    from public.game_attempts
    where id = p_attempt_id
      and student_id = v_user_id
      and status = 'playing';

    if not found then
      raise exception 'Game attempt not found';
    end if;

    if v_attempt.subject_id <> v_subject_id or v_attempt.classroom_id <> v_classroom_id then
      raise exception 'Question does not belong to this game attempt';
    end if;

    if v_attempt.topic_id is not null and v_attempt.topic_id <> v_topic_id then
      raise exception 'Question does not belong to this topic attempt';
    end if;
  end if;

  if not p_skipped then
    if v_question.type in ('multiple_choice', 'true_false') then
      select a.id, coalesce(a.is_correct, false)
      into v_correct_answer_id, v_is_correct
      from public.answers a
      where a.id = p_answer_id
        and a.question_id = p_question_id;

      if v_correct_answer_id is null then
        v_is_correct := false;
      end if;

    elsif v_question.type = 'open_answer' then
      v_is_correct := false;
      v_requires_manual_review := true;
      v_manual_review_status := 'pending';

    elsif v_question.type = 'fill_blank' then
      with expected as (
        select public.normalize_answer_text(a.text) as value, count(*) as quantity
        from public.answers a
        where a.question_id = p_question_id
          and coalesce(a.is_correct, true)
          and public.normalize_answer_text(a.text) <> ''
        group by public.normalize_answer_text(a.text)
      ),
      submitted_parts as (
        select public.normalize_answer_text(part) as value
        from regexp_split_to_table(coalesce(p_answer_text, ''), '[,;\n]') as part
        where public.normalize_answer_text(part) <> ''
      ),
      submitted as (
        select value, count(*) as quantity
        from submitted_parts
        group by value
      ),
      differences as (
        select
          coalesce(expected.value, submitted.value) as value,
          coalesce(expected.quantity, 0) as expected_quantity,
          coalesce(submitted.quantity, 0) as submitted_quantity
        from expected
        full join submitted using (value)
        where coalesce(expected.quantity, 0) <> coalesce(submitted.quantity, 0)
      )
      select exists (select 1 from expected)
        and exists (select 1 from submitted)
        and not exists (select 1 from differences)
      into v_is_correct;

    elsif v_question.type = 'ordering' then
      select array_agg((item.value)::bigint order by item.ordinality)
      into v_payload_ids
      from jsonb_array_elements_text(coalesce(p_answer_payload->'answer_ids', '[]'::jsonb)) with ordinality item(value, ordinality);

      select array_agg(a.id order by coalesce(a.sort_order, a.id))
      into v_correct_ids
      from public.answers a
      where a.question_id = p_question_id;

      v_is_correct := coalesce(v_payload_ids = v_correct_ids, false);

    elsif v_question.type in ('match_pairs', 'drag_drop') then
      for v_payload_pair in select value from jsonb_array_elements(coalesce(p_answer_payload->'pairs', '[]'::jsonb)) loop
        v_pair_count := v_pair_count + 1;
        v_pair_left := coalesce(v_payload_pair->>'left', '');
        v_pair_right := coalesce(v_payload_pair->>'right', '');

        if exists (
          select 1
          from public.answers a
          where a.question_id = p_question_id
            and split_part(a.text, '|||', 1) = v_pair_left
            and split_part(a.text, '|||', 2) = v_pair_right
        ) then
          v_matching_pair_count := v_matching_pair_count + 1;
        end if;
      end loop;

      v_is_correct := v_pair_count > 0
        and v_pair_count = v_matching_pair_count
        and v_pair_count = (select count(*) from public.answers where question_id = p_question_id);
    end if;
  end if;

  if v_is_correct then
    v_remaining_seconds := greatest(0, v_time_limit - coalesce(p_time_taken_seconds, v_time_limit));
    v_earned_points := greatest(
      0,
      coalesce(v_question.points_base, 10) + floor(v_remaining_seconds / 2)::integer - case when p_hint_used then 10 else 0 end
    );
  end if;

  insert into public.attempt_history (
    student_id,
    question_id,
    answer_id,
    is_correct,
    time_taken_seconds,
    attempted_at,
    submitted_answer_text,
    submitted_answer_payload,
    earned_points,
    hint_used,
    was_skipped,
    attempt_id,
    manual_review_status
  ) values (
    v_user_id,
    p_question_id,
    p_answer_id,
    v_is_correct,
    p_time_taken_seconds,
    now(),
    p_answer_text,
    p_answer_payload,
    v_earned_points,
    p_hint_used,
    p_skipped,
    p_attempt_id,
    v_manual_review_status
  ) returning id into v_attempt_history_id;

  if p_attempt_id is not null then
    update public.game_attempts
    set total_score = coalesce(total_score, 0) + v_earned_points,
        correct_answers = coalesce(correct_answers, 0) + case when v_is_correct then 1 else 0 end,
        updated_at = now()
    where id = p_attempt_id
    returning total_score into v_score_for_best;
  else
    v_score_for_best := v_earned_points;
  end if;

  select coalesce(played_days, '{}'::date[])
  into v_existing_days
  from public.subject_scores
  where student_id = v_user_id
    and classroom_id = v_classroom_id;

  if not found then
    insert into public.subject_scores (
      student_id, subject_id, classroom_id, max_score, correct_answers, played_days, played_at, updated_at
    ) values (
      v_user_id, v_subject_id, v_classroom_id, v_score_for_best,
      case when v_is_correct then 1 else 0 end,
      array[v_today_key], now(), now()
    );
  else
    update public.subject_scores
    set max_score = greatest(coalesce(max_score, 0), v_score_for_best),
        correct_answers = coalesce(correct_answers, 0) + case when v_is_correct then 1 else 0 end,
        played_days = (
          select array_agg(distinct day order by day)
          from unnest(array_append(coalesce(v_existing_days, '{}'::date[]), v_today_key)) as day
        ),
        played_at = now(),
        updated_at = now(),
        subject_id = v_subject_id
    where student_id = v_user_id
      and classroom_id = v_classroom_id;
  end if;

  if v_topic_id is not null then
    if not exists (
      select 1
      from public.topic_scores
      where student_id = v_user_id
        and topic_id = v_topic_id
    ) then
      insert into public.topic_scores (
        student_id, subject_id, classroom_id, topic_id, max_score, played_at, updated_at
      ) values (
        v_user_id, v_subject_id, v_classroom_id, v_topic_id, v_score_for_best, now(), now()
      );
    else
      update public.topic_scores
      set max_score = greatest(coalesce(max_score, 0), v_score_for_best),
          played_at = now(),
          updated_at = now(),
          classroom_id = v_classroom_id,
          subject_id = v_subject_id
      where student_id = v_user_id
        and topic_id = v_topic_id;
    end if;
  end if;

  if v_earned_points > 0 then
    update public.profiles
    set points = coalesce(points, 0) + v_earned_points
    where id = v_user_id;
  end if;

  if not v_is_correct and v_question.type in ('multiple_choice', 'true_false') then
    select id
    into v_correct_answer_id
    from public.answers
    where question_id = p_question_id
      and coalesce(is_correct, false)
    order by sort_order nulls last, id
    limit 1;
  end if;

  if not v_requires_manual_review then
    select string_agg(
      case
        when v_question.type in ('match_pairs', 'drag_drop') then concat(split_part(a.text, '|||', 1), ' -> ', split_part(a.text, '|||', 2))
        else a.text
      end,
      ', '
      order by a.sort_order nulls last, a.id
    )
    into v_correct_answer_text
    from public.answers a
    where a.question_id = p_question_id
      and (coalesce(a.is_correct, true) or v_question.type in ('ordering', 'match_pairs', 'drag_drop'));
  end if;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'requires_manual_review', v_requires_manual_review,
    'manual_review_status', v_manual_review_status,
    'attempt_history_id', v_attempt_history_id,
    'earned_points', v_earned_points,
    'attempt_score', v_score_for_best,
    'correct_answer_id', v_correct_answer_id,
    'correct_answer_text', v_correct_answer_text,
    'explanation', case when v_requires_manual_review then null else v_question.explanation end
  );
end;
$$;

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

  select count(*)::integer,
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

  select count(distinct q.subject_id)::integer,
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
  select coalesce(sum(reward_xp), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'badge_id', badge_id,
           'awarded_at', awarded_at,
           'reward_xp', reward_xp
         ) order by awarded_at desc), '[]'::jsonb)
  into v_awarded_xp, v_new_awards
  from inserted;

  if v_awarded_xp > 0 then
    update public.profiles
    set points = coalesce(points, 0) + v_awarded_xp
    where id = v_user_id;
  end if;

  return jsonb_build_object(
    'awarded_xp', v_awarded_xp,
    'new_awards', v_new_awards,
    'awards', coalesce((
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

grant execute on function public.assert_topic_playable(bigint) to authenticated;
grant execute on function public.start_game_attempt(bigint, bigint, bigint, boolean, integer) to authenticated;
grant execute on function public.get_game_questions(bigint, bigint, bigint, boolean, integer) to authenticated;
grant execute on function public.submit_answer(bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) to authenticated;
grant execute on function public.sync_student_badges() to authenticated;

create or replace function public.normalize_answer_text(value text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')))
$$;

create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  topic_id bigint references public.subject_topics(id) on delete set null,
  status text not null default 'playing' check (status in ('playing', 'finished', 'abandoned')),
  total_score integer not null default 0,
  correct_answers integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists game_attempts_student_id_idx on public.game_attempts(student_id);
create index if not exists game_attempts_subject_id_idx on public.game_attempts(subject_id);

alter table public.game_attempts enable row level security;

drop policy if exists "Students can read own game attempts" on public.game_attempts;
create policy "Students can read own game attempts"
on public.game_attempts
for select
to authenticated
using (student_id = auth.uid());

create or replace function public.start_game_attempt(
  p_subject_id bigint,
  p_topic_id bigint default null,
  p_general_topic boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if not exists (
    select 1
    from public.enrollments
    where student_id = v_user_id
      and subject_id = p_subject_id
  ) then
    raise exception 'Student is not enrolled in this subject';
  end if;

  if p_topic_id is not null and not exists (
    select 1
    from public.subject_topics
    where id = p_topic_id
      and subject_id = p_subject_id
  ) then
    raise exception 'Topic does not belong to this subject';
  end if;

  insert into public.game_attempts (student_id, subject_id, topic_id)
  values (v_user_id, p_subject_id, case when p_general_topic then null else p_topic_id end)
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

create or replace function public.get_game_questions(
  p_subject_id bigint,
  p_topic_id bigint default null,
  p_general_topic boolean default false
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(question_payload order by random()), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'points_base', q.points_base,
      'time_limit_seconds', q.time_limit_seconds,
      'topic_id', q.topic_id,
      'answers',
        case
          when q.type in ('open_answer', 'fill_blank') then '[]'::jsonb
          when q.type in ('match_pairs', 'drag_drop') then (
            select coalesce(
              jsonb_agg(
                jsonb_build_object('id', a.id, 'text', split_part(a.text, '|||', 1))
                order by random()
              ),
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
    where q.subject_id = p_subject_id
      and coalesce(q.active, true)
      and (
        (p_general_topic and q.topic_id is null)
        or (not p_general_topic and p_topic_id is null)
        or (not p_general_topic and p_topic_id is not null and q.topic_id = p_topic_id)
      )
      and (
        exists (
          select 1
          from public.subjects s
          where s.id = q.subject_id
            and s.teacher_id = auth.uid()
        )
        or exists (
          select 1
          from public.enrollments e
          where e.subject_id = q.subject_id
            and e.student_id = auth.uid()
        )
      )
  ) safe_questions;
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
  v_topic_id bigint;
  v_is_correct boolean := false;
  v_correct_answer_id bigint := null;
  v_time_limit integer := 30;
  v_remaining_seconds integer := 0;
  v_earned_points integer := 0;
  v_previous_subject_best integer := 0;
  v_previous_topic_best integer := 0;
  v_points_to_add integer := 0;
  v_score_for_best integer := 0;
  v_today_key text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
  v_existing_days text[] := '{}';
  v_payload_ids bigint[];
  v_correct_ids bigint[];
  v_payload_pair jsonb;
  v_pair_left text;
  v_pair_right text;
  v_pair_count integer := 0;
  v_matching_pair_count integer := 0;
  v_attempt public.game_attempts%rowtype;
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
  v_topic_id := v_question.topic_id;
  v_time_limit := coalesce(v_question.time_limit_seconds, 30);

  if not exists (
    select 1
    from public.enrollments
    where student_id = v_user_id
      and subject_id = v_subject_id
  ) then
    raise exception 'Student is not enrolled in this subject';
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

    if v_attempt.subject_id <> v_subject_id then
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
      v_is_correct := exists (
        select 1
        from public.answers a
        where a.question_id = p_question_id
          and coalesce(a.is_correct, true)
          and public.normalize_answer_text(a.text) = public.normalize_answer_text(p_answer_text)
      );

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
      select
        exists (select 1 from expected)
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
      for v_payload_pair in
        select value from jsonb_array_elements(coalesce(p_answer_payload->'pairs', '[]'::jsonb))
      loop
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

  insert into public.attempt_history (
    student_id,
    question_id,
    answer_id,
    is_correct,
    time_taken_seconds,
    attempted_at
  )
  values (
    v_user_id,
    p_question_id,
    p_answer_id,
    v_is_correct,
    p_time_taken_seconds,
    now()
  );

  if v_is_correct then
    v_remaining_seconds := greatest(0, v_time_limit - coalesce(p_time_taken_seconds, v_time_limit));
    v_earned_points := greatest(
      0,
      coalesce(v_question.points_base, 10) + floor(v_remaining_seconds / 2)::integer - case when p_hint_used then 10 else 0 end
    );
  end if;

  if p_attempt_id is not null then
    update public.game_attempts
    set
      total_score = total_score + v_earned_points,
      correct_answers = correct_answers + case when v_is_correct then 1 else 0 end,
      updated_at = now()
    where id = p_attempt_id
    returning total_score into v_score_for_best;
  else
    v_score_for_best := v_earned_points;
  end if;

  select coalesce(max_score, 0), coalesce(played_days, '{}')
  into v_previous_subject_best, v_existing_days
  from public.subject_scores
  where student_id = v_user_id
    and subject_id = v_subject_id;

  if not found then
    insert into public.subject_scores (
      student_id,
      subject_id,
      max_score,
      correct_answers,
      played_days,
      played_at,
      updated_at
    )
    values (
      v_user_id,
      v_subject_id,
      v_score_for_best,
      case when v_is_correct then 1 else 0 end,
      array[v_today_key],
      now(),
      now()
    );
    v_points_to_add := v_score_for_best;
  else
    update public.subject_scores
    set
      max_score = greatest(coalesce(max_score, 0), v_score_for_best),
      correct_answers = coalesce(correct_answers, 0) + case when v_is_correct then 1 else 0 end,
      played_days = (
        select array_agg(distinct day order by day)
        from unnest(coalesce(v_existing_days, '{}') || v_today_key) as day
      ),
      played_at = now(),
      updated_at = now()
    where student_id = v_user_id
      and subject_id = v_subject_id;

    v_points_to_add := greatest(0, v_score_for_best - v_previous_subject_best);
  end if;

  if v_topic_id is not null then
    select coalesce(max_score, 0)
    into v_previous_topic_best
    from public.topic_scores
    where student_id = v_user_id
      and topic_id = v_topic_id;

    if not found then
      insert into public.topic_scores (
        student_id,
        subject_id,
        topic_id,
        max_score,
        played_at,
        updated_at
      )
      values (
        v_user_id,
        v_subject_id,
        v_topic_id,
        v_score_for_best,
        now(),
        now()
      );
    else
      update public.topic_scores
      set
        max_score = greatest(coalesce(max_score, 0), v_score_for_best),
        played_at = now(),
        updated_at = now()
      where student_id = v_user_id
        and topic_id = v_topic_id;
    end if;
  end if;

  if v_points_to_add > 0 then
    update public.profiles
    set points = coalesce(points, 0) + v_points_to_add
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

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'earned_points', v_earned_points,
    'attempt_score', v_score_for_best,
    'correct_answer_id', v_correct_answer_id
  );
end;
$$;

grant execute on function public.start_game_attempt(bigint, bigint, boolean) to authenticated;
grant execute on function public.get_game_questions(bigint, bigint, boolean) to authenticated;
grant execute on function public.submit_answer(bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) to authenticated;

create or replace function public.sync_student_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_correct_answers integer := 0;
  v_completed_classes integer := 0;
  v_total_points integer := 0;
  v_subjects_count integer := 0;
  v_best_score integer := 0;
  v_streak_days integer := 0;
  v_cursor date;
  v_played_days date[] := '{}';
  v_awarded_xp integer := 0;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select
    coalesce(sum(correct_answers), 0),
    coalesce(count(*) filter (where coalesce(max_score, 0) > 0), 0),
    coalesce(max(max_score), 0)
  into v_correct_answers, v_completed_classes, v_best_score
  from public.subject_scores
  where student_id = v_user_id;

  select coalesce(points, 0)
  into v_total_points
  from public.profiles
  where id = v_user_id;

  select count(*)
  into v_subjects_count
  from public.enrollments
  where student_id = v_user_id;

  select coalesce(array_agg(distinct played_day order by played_day), '{}')
  into v_played_days
  from (
    select unnest(coalesce(played_days, '{}'))::date as played_day
    from public.subject_scores
    where student_id = v_user_id
    union
    select played_at::date as played_day
    from public.subject_scores
    where student_id = v_user_id
      and played_at is not null
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
      ('challenge-master', 200),
      ('constant', 100),
      ('class-explorer', 150),
      ('collector', 120),
      ('xp-legend', 250),
      ('high-score', 180)
  ),
  unlocked as (
    select badge_id, reward_xp
    from eligible_badges
    where
      (badge_id = 'first-step' and v_correct_answers >= 1)
      or (badge_id = 'challenge-master' and v_correct_answers >= 50)
      or (badge_id = 'constant' and v_streak_days >= 7)
      or (badge_id = 'class-explorer' and v_completed_classes >= 3)
      or (badge_id = 'collector' and v_subjects_count >= 5)
      or (badge_id = 'xp-legend' and v_total_points >= 2000)
      or (badge_id = 'high-score' and v_best_score >= 1000)
  ),
  inserted as (
    insert into public.student_badges (student_id, badge_id, reward_xp, awarded_at)
    select v_user_id, badge_id, reward_xp, now()
    from unlocked
    on conflict (student_id, badge_id) do nothing
    returning reward_xp
  )
  select coalesce(sum(reward_xp), 0)
  into v_awarded_xp
  from inserted;

  if v_awarded_xp > 0 then
    update public.profiles
    set points = coalesce(points, 0) + v_awarded_xp
    where id = v_user_id;
  end if;

  return jsonb_build_object(
    'awarded_xp', v_awarded_xp,
    'awards',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'badge_id', badge_id,
          'awarded_at', awarded_at,
          'reward_xp', reward_xp
        ))
        from public.student_badges
        where student_id = v_user_id
      ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.sync_student_badges() to authenticated;

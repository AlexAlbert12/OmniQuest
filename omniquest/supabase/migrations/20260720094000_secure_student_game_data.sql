alter table public.questions enable row level security;
alter table public.answers enable row level security;

drop policy if exists "questions_select_teacher_or_enrolled" on public.questions;
drop policy if exists "questions_select_owner_teacher" on public.questions;
create policy "questions_select_owner_teacher"
on public.questions for select to authenticated
using (
  exists (
    select 1
    from public.subjects s
    where s.id = questions.subject_id
      and s.teacher_id = auth.uid()
  )
);

drop policy if exists "answers_select_teacher_or_enrolled" on public.answers;
drop policy if exists "answers_select_owner_teacher" on public.answers;
create policy "answers_select_owner_teacher"
on public.answers for select to authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    where q.id = answers.question_id
      and s.teacher_id = auth.uid()
  )
);

revoke execute on function public.get_game_questions(bigint, bigint, bigint, boolean, integer) from public;
revoke execute on function public.get_game_questions(bigint, bigint, bigint, boolean, integer) from anon;
revoke execute on function public.get_game_questions(bigint, bigint, bigint, boolean, integer) from authenticated;
grant execute on function public.get_game_questions(bigint, bigint, bigint, boolean, integer) to service_role;

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
    where coalesce(q.active, true)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
      and (
        public.is_admin()
        or exists (
          select 1
          from public.subjects s
          where s.id = q.subject_id
            and s.teacher_id = v_user_id
        )
        or exists (
          select 1
          from public.enrollments e
          where e.student_id = v_user_id
            and e.subject_id = q.subject_id
            and (e.classroom_id = q.classroom_id or e.classroom_id is null)
        )
      )
  ) catalog;

  return v_result;
end;
$$;

create or replace function public.get_student_attempt_history(
  p_limit integer default 100,
  p_since timestamptz default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_difficulty integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 5000);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select coalesce(jsonb_agg(attempt_payload order by attempted_at desc, id desc), '[]'::jsonb)
  into v_result
  from (
    select
      ah.id,
      ah.attempted_at,
      jsonb_build_object(
        'id', ah.id,
        'question_id', ah.question_id,
        'answer_id', ah.answer_id,
        'is_correct', ah.is_correct,
        'time_taken_seconds', ah.time_taken_seconds,
        'attempted_at', ah.attempted_at,
        'submitted_answer_text', ah.submitted_answer_text,
        'submitted_answer_payload', ah.submitted_answer_payload,
        'earned_points', ah.earned_points,
        'hint_used', ah.hint_used,
        'was_skipped', ah.was_skipped,
        'manual_review_status', ah.manual_review_status,
        'questions', jsonb_build_object(
          'id', q.id,
          'text', q.text,
          'type', q.type,
          'difficulty', coalesce(q.difficulty, 1),
          'active', coalesce(q.active, true),
          'subject_id', q.subject_id,
          'classroom_id', q.classroom_id,
          'topic_id', q.topic_id,
          'explanation', null,
          'subjects', jsonb_build_object('id', s.id, 'name', s.name),
          'subject_topics', case
            when st.id is null then null
            else jsonb_build_object('id', st.id, 'title', st.title)
          end,
          'answers', '[]'::jsonb
        )
      ) as attempt_payload
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.subjects s on s.id = q.subject_id
    left join public.subject_topics st on st.id = q.topic_id
    where ah.student_id = v_user_id
      and (p_since is null or ah.attempted_at >= p_since)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
      and (p_topic_id is null or q.topic_id = p_topic_id)
      and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
    order by ah.attempted_at desc, ah.id desc
    limit v_limit
  ) safe_attempts;

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

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'requires_manual_review', v_requires_manual_review,
    'manual_review_status', v_manual_review_status,
    'attempt_history_id', v_attempt_history_id,
    'earned_points', v_earned_points,
    'attempt_score', v_score_for_best
  );
end;
$$;

create or replace function public.get_attempt_feedback(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.attempt_history%rowtype;
  v_question public.questions%rowtype;
  v_subject_teacher_id uuid;
  v_correct_answer_id bigint := null;
  v_correct_answer_text text := null;
  v_requires_manual_review boolean := false;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select ah.*
  into v_attempt
  from public.attempt_history ah
  where ah.id = p_attempt_history_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  select q.*
  into v_question
  from public.questions q
  where q.id = v_attempt.question_id;

  if not found then
    raise exception 'Question not found for attempt';
  end if;

  select s.teacher_id
  into v_subject_teacher_id
  from public.subjects s
  where s.id = v_question.subject_id;

  if not found then
    raise exception 'Subject not found for attempt';
  end if;

  if v_attempt.student_id <> v_user_id
     and v_subject_teacher_id <> v_user_id
     and not public.is_admin() then
    raise exception 'No puedes consultar este intento.';
  end if;

  v_requires_manual_review := coalesce(v_attempt.manual_review_status, 'not_required') <> 'not_required';

  if coalesce(v_attempt.manual_review_status, 'not_required') <> 'pending' then
    if v_question.type in ('multiple_choice', 'true_false') then
      select a.id
      into v_correct_answer_id
      from public.answers a
      where a.question_id = v_question.id
        and coalesce(a.is_correct, false)
      order by a.sort_order nulls last, a.id
      limit 1;
    end if;

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
    where a.question_id = v_question.id
      and (
        coalesce(a.is_correct, true)
        or v_question.type in ('ordering', 'match_pairs', 'drag_drop')
      );
  end if;

  return jsonb_build_object(
    'attempt_history_id', v_attempt.id,
    'is_correct', v_attempt.is_correct,
    'requires_manual_review', v_requires_manual_review,
    'manual_review_status', v_attempt.manual_review_status,
    'earned_points', v_attempt.earned_points,
    'correct_answer_id', v_correct_answer_id,
    'correct_answer_text', v_correct_answer_text,
    'explanation', case
      when coalesce(v_attempt.manual_review_status, 'not_required') = 'pending' then null
      else v_question.explanation
    end,
    'review_notes', v_attempt.review_notes
  );
end;
$$;

create or replace function public.get_activity_attempt_detail(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_owner_id uuid;
  v_teacher_id uuid;
  v_review_status text;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select ah.student_id, s.teacher_id, ah.manual_review_status
  into v_owner_id, v_teacher_id, v_review_status
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where ah.id = p_attempt_history_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  if v_owner_id <> v_user_id
     and v_teacher_id <> v_user_id
     and not public.is_admin() then
    raise exception 'No puedes consultar este intento.';
  end if;

  select jsonb_build_object(
    'id', ah.id,
    'question_id', ah.question_id,
    'answer_id', ah.answer_id,
    'is_correct', ah.is_correct,
    'time_taken_seconds', ah.time_taken_seconds,
    'attempted_at', ah.attempted_at,
    'submitted_answer_text', ah.submitted_answer_text,
    'submitted_answer_payload', ah.submitted_answer_payload,
    'earned_points', ah.earned_points,
    'hint_used', ah.hint_used,
    'was_skipped', ah.was_skipped,
    'manual_review_status', ah.manual_review_status,
    'review_notes', ah.review_notes,
    'questions', jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'difficulty', coalesce(q.difficulty, 1),
      'subject_id', q.subject_id,
      'classroom_id', q.classroom_id,
      'topic_id', q.topic_id,
      'explanation', case when v_review_status = 'pending' then null else q.explanation end,
      'subjects', jsonb_build_object('id', s.id, 'name', s.name),
      'subject_topics', case
        when st.id is null then null
        else jsonb_build_object('id', st.id, 'title', st.title)
      end,
      'answers', case
        when v_review_status = 'pending' then '[]'::jsonb
        else coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', a.id,
              'text', a.text,
              'is_correct', a.is_correct,
              'sort_order', a.sort_order
            )
            order by a.sort_order nulls last, a.id
          )
          from public.answers a
          where a.question_id = q.id
        ), '[]'::jsonb)
      end
    )
  )
  into v_result
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  left join public.subject_topics st on st.id = q.topic_id
  where ah.id = p_attempt_history_id;

  return v_result;
end;
$$;

revoke execute on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) from public;
revoke execute on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) from anon;
grant execute on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) to authenticated;

revoke execute on function public.get_student_question_catalog(bigint, bigint) from public;
revoke execute on function public.get_student_question_catalog(bigint, bigint) from anon;
grant execute on function public.get_student_question_catalog(bigint, bigint) to authenticated;

revoke execute on function public.get_student_attempt_history(integer, timestamptz, bigint, bigint, bigint, integer) from public;
revoke execute on function public.get_student_attempt_history(integer, timestamptz, bigint, bigint, bigint, integer) from anon;
grant execute on function public.get_student_attempt_history(integer, timestamptz, bigint, bigint, bigint, integer) to authenticated;

revoke execute on function public.get_attempt_feedback(bigint) from public;
revoke execute on function public.get_attempt_feedback(bigint) from anon;
grant execute on function public.get_attempt_feedback(bigint) to authenticated;

revoke execute on function public.get_activity_attempt_detail(bigint) from public;
revoke execute on function public.get_activity_attempt_detail(bigint) from anon;
grant execute on function public.get_activity_attempt_detail(bigint) to authenticated;

revoke execute on function public.submit_answer(bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) from public;
revoke execute on function public.submit_answer(bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) from anon;
grant execute on function public.submit_answer(bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) to authenticated;

comment on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean)
is 'Returns only playable question fields. It never exposes explanation, is_correct or the answer-key mapping before submission.';

comment on function public.get_attempt_feedback(bigint)
is 'Returns answer feedback only for an existing attempt owned by the student, its teacher, or an administrator.';

comment on function public.get_activity_attempt_detail(bigint)
is 'Returns full post-attempt detail only to the attempt owner, subject teacher, or administrator.';

notify pgrst, 'reload schema';
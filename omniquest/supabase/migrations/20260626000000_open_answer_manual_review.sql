alter table public.attempt_history
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

create index if not exists attempt_history_manual_review_idx
  on public.attempt_history(manual_review_status, attempted_at desc);

create index if not exists attempt_history_attempt_id_idx
  on public.attempt_history(attempt_id);

update public.attempt_history ah
set manual_review_status = case
  when q.type = 'open_answer' and ah.is_correct then 'approved'
  when q.type = 'open_answer' and not ah.is_correct then 'rejected'
  else 'not_required'
end
from public.questions q
where q.id = ah.question_id
  and ah.manual_review_status = 'not_required';

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
  v_previous_subject_best integer := 0;
  v_previous_topic_best integer := 0;
  v_points_to_add integer := 0;
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

  if not exists (
    select 1
    from public.enrollments
    where student_id = v_user_id
      and classroom_id = v_classroom_id
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
    student_id, question_id, answer_id, is_correct, time_taken_seconds, attempted_at,
    submitted_answer_text, submitted_answer_payload, earned_points, hint_used, was_skipped,
    attempt_id, manual_review_status
  )
  values (
    v_user_id, p_question_id, p_answer_id, v_is_correct, p_time_taken_seconds, now(),
    p_answer_text, p_answer_payload, v_earned_points, p_hint_used, p_skipped,
    p_attempt_id, v_manual_review_status
  )
  returning id into v_attempt_history_id;

  if p_attempt_id is not null then
    update public.game_attempts
    set total_score = total_score + v_earned_points,
        correct_answers = correct_answers + case when v_is_correct then 1 else 0 end,
        updated_at = now()
    where id = p_attempt_id
    returning total_score into v_score_for_best;
  else
    v_score_for_best := v_earned_points;
  end if;

  select coalesce(max_score, 0), coalesce(played_days, '{}'::date[])
  into v_previous_subject_best, v_existing_days
  from public.subject_scores
  where student_id = v_user_id
    and classroom_id = v_classroom_id;

  if not found then
    insert into public.subject_scores (
      student_id, subject_id, classroom_id, max_score, correct_answers, played_days, played_at, updated_at
    ) values (
      v_user_id, v_subject_id, v_classroom_id, v_score_for_best,
      case when v_is_correct then 1 else 0 end, array[v_today_key], now(), now()
    );
    v_points_to_add := v_score_for_best;
  else
    update public.subject_scores
    set max_score = greatest(coalesce(max_score, 0), v_score_for_best),
        correct_answers = coalesce(correct_answers, 0) + case when v_is_correct then 1 else 0 end,
        played_days = (
          select array_agg(distinct day order by day)
          from unnest(array_append(coalesce(v_existing_days, '{}'::date[]), v_today_key)) as day
        ),
        played_at = now(),
        updated_at = now()
    where student_id = v_user_id
      and classroom_id = v_classroom_id;

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
        student_id, subject_id, classroom_id, topic_id, max_score, played_at, updated_at
      ) values (
        v_user_id, v_subject_id, v_classroom_id, v_topic_id, v_score_for_best, now(), now()
      );
    else
      update public.topic_scores
      set max_score = greatest(coalesce(max_score, 0), v_score_for_best),
          played_at = now(),
          updated_at = now(),
          classroom_id = v_classroom_id
      where student_id = v_user_id
        and topic_id = v_topic_id;
    end if;
  end if;

  -- profiles.points is recalculated from attempt_history.earned_points
  -- and student_badges.reward_xp by sync_student_points triggers.

  if not v_is_correct and v_question.type in ('multiple_choice', 'true_false') then
    select id into v_correct_answer_id
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

create or replace function public.review_open_answer_attempt(
  p_attempt_history_id bigint,
  p_is_correct boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_attempt public.attempt_history%rowtype;
  v_question public.questions%rowtype;
  v_classroom_id bigint;
  v_delta_points integer := 0;
  v_delta_correct integer := 0;
  v_new_earned_points integer := 0;
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  select *
  into v_attempt
  from public.attempt_history
  where id = p_attempt_history_id
  for update;

  if not found then
    raise exception 'Intento no encontrado.';
  end if;

  select *
  into v_question
  from public.questions
  where id = v_attempt.question_id;

  if not found or v_question.type <> 'open_answer' then
    raise exception 'Solo se pueden revisar respuestas abiertas.';
  end if;

  if not exists (
    select 1
    from public.subjects
    where subjects.id = v_question.subject_id
      and subjects.teacher_id = v_teacher_id
  ) then
    raise exception 'No puedes revisar respuestas de este curso.';
  end if;

  if v_attempt.manual_review_status <> 'pending' then
    raise exception 'Esta respuesta ya ha sido revisada.';
  end if;

  v_classroom_id := coalesce(v_question.classroom_id, public.ensure_default_classroom(v_question.subject_id));
  v_new_earned_points := case when p_is_correct then coalesce(v_question.points_base, 10) else 0 end;
  v_delta_points := v_new_earned_points - coalesce(v_attempt.earned_points, 0);
  v_delta_correct := case when p_is_correct then 1 else 0 end - case when v_attempt.is_correct then 1 else 0 end;

  update public.attempt_history
  set is_correct = p_is_correct,
      earned_points = v_new_earned_points,
      manual_review_status = case when p_is_correct then 'approved' else 'rejected' end,
      reviewed_by = v_teacher_id,
      reviewed_at = now(),
      review_notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_attempt_history_id;

  if v_attempt.attempt_id is not null then
    update public.game_attempts
    set total_score = greatest(0, coalesce(total_score, 0) + v_delta_points),
        correct_answers = greatest(0, coalesce(correct_answers, 0) + v_delta_correct),
        updated_at = now()
    where id = v_attempt.attempt_id;
  end if;

  update public.subject_scores
  set max_score = greatest(coalesce(max_score, 0), coalesce(max_score, 0) + greatest(v_delta_points, 0)),
      correct_answers = greatest(0, coalesce(correct_answers, 0) + v_delta_correct),
      updated_at = now()
  where student_id = v_attempt.student_id
    and classroom_id = v_classroom_id;

  if v_question.topic_id is not null then
    update public.topic_scores
    set max_score = greatest(coalesce(max_score, 0), coalesce(max_score, 0) + greatest(v_delta_points, 0)),
        updated_at = now()
    where student_id = v_attempt.student_id
      and topic_id = v_question.topic_id;
  end if;

  -- profiles.points is recalculated from attempt_history.earned_points
  -- and student_badges.reward_xp by sync_student_points triggers.

  return jsonb_build_object(
    'id', p_attempt_history_id,
    'is_correct', p_is_correct,
    'earned_points', v_new_earned_points,
    'manual_review_status', case when p_is_correct then 'approved' else 'rejected' end
  );
end;
$$;

grant execute on function public.submit_answer(bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) to authenticated;
grant execute on function public.review_open_answer_attempt(bigint, boolean, text) to authenticated;

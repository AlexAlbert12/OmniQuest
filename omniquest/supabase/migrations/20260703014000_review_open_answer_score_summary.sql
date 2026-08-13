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
  v_subject_max_score integer := 0;
  v_subject_correct_answers integer := 0;
  v_topic_max_score integer := 0;
  v_played_day date;
  v_rows integer := 0;
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
  v_played_day := (coalesce(v_attempt.attempted_at, now()) at time zone 'Europe/Madrid')::date;
  v_new_earned_points := case when p_is_correct then coalesce(v_question.points_base, 10) else 0 end;
  v_delta_points := v_new_earned_points - coalesce(v_attempt.earned_points, 0);
  v_delta_correct := case when p_is_correct then 1 else 0 end - case when coalesce(v_attempt.is_correct, false) then 1 else 0 end;

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

  select greatest(
    coalesce((
      select max(coalesce(ga.total_score, 0))::integer
      from public.game_attempts ga
      where ga.student_id = v_attempt.student_id
        and ga.subject_id = v_question.subject_id
        and coalesce(ga.classroom_id, v_classroom_id) = v_classroom_id
    ), 0),
    coalesce((
      select max(coalesce(ah.earned_points, 0))::integer
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.student_id = v_attempt.student_id
        and q.subject_id = v_question.subject_id
        and coalesce(q.classroom_id, public.ensure_default_classroom(q.subject_id)) = v_classroom_id
    ), 0)
  )
  into v_subject_max_score;

  select count(*) filter (where coalesce(ah.is_correct, false))::integer
  into v_subject_correct_answers
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  where ah.student_id = v_attempt.student_id
    and q.subject_id = v_question.subject_id
    and coalesce(q.classroom_id, public.ensure_default_classroom(q.subject_id)) = v_classroom_id;

  update public.subject_scores
  set max_score = v_subject_max_score,
      correct_answers = v_subject_correct_answers,
      played_days = (
        select array_agg(distinct day order by day)
        from unnest(array_append(coalesce(played_days, '{}'::date[]), v_played_day)) as day
      ),
      played_at = greatest(coalesce(played_at, 'epoch'::timestamptz), coalesce(v_attempt.attempted_at, now())),
      updated_at = now(),
      subject_id = v_question.subject_id
  where student_id = v_attempt.student_id
    and classroom_id = v_classroom_id;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.subject_scores (
      student_id,
      subject_id,
      classroom_id,
      max_score,
      correct_answers,
      played_days,
      played_at,
      updated_at
    ) values (
      v_attempt.student_id,
      v_question.subject_id,
      v_classroom_id,
      v_subject_max_score,
      v_subject_correct_answers,
      array[v_played_day],
      coalesce(v_attempt.attempted_at, now()),
      now()
    );
  end if;

  if v_question.topic_id is not null then
    select greatest(
      coalesce((
        select max(coalesce(ga.total_score, 0))::integer
        from public.game_attempts ga
        where ga.student_id = v_attempt.student_id
          and ga.subject_id = v_question.subject_id
          and ga.topic_id = v_question.topic_id
          and coalesce(ga.classroom_id, v_classroom_id) = v_classroom_id
      ), 0),
      coalesce((
        select max(coalesce(ah.earned_points, 0))::integer
        from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        where ah.student_id = v_attempt.student_id
          and q.subject_id = v_question.subject_id
          and q.topic_id = v_question.topic_id
          and coalesce(q.classroom_id, public.ensure_default_classroom(q.subject_id)) = v_classroom_id
      ), 0)
    )
    into v_topic_max_score;

    update public.topic_scores
    set max_score = v_topic_max_score,
        played_at = greatest(coalesce(played_at, 'epoch'::timestamptz), coalesce(v_attempt.attempted_at, now())),
        updated_at = now(),
        classroom_id = v_classroom_id,
        subject_id = v_question.subject_id
    where student_id = v_attempt.student_id
      and topic_id = v_question.topic_id;

    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      insert into public.topic_scores (
        student_id,
        subject_id,
        classroom_id,
        topic_id,
        max_score,
        played_at,
        updated_at
      ) values (
        v_attempt.student_id,
        v_question.subject_id,
        v_classroom_id,
        v_question.topic_id,
        v_topic_max_score,
        coalesce(v_attempt.attempted_at, now()),
        now()
      );
    end if;
  end if;

  perform public.recalculate_student_points(v_attempt.student_id);

  return jsonb_build_object(
    'id', p_attempt_history_id,
    'is_correct', p_is_correct,
    'earned_points', v_new_earned_points,
    'manual_review_status', case when p_is_correct then 'approved' else 'rejected' end,
    'subject_max_score', v_subject_max_score,
    'subject_correct_answers', v_subject_correct_answers,
    'topic_max_score', case when v_question.topic_id is null then null else v_topic_max_score end
  );
end;
$$;

grant execute on function public.review_open_answer_attempt(bigint, boolean, text) to authenticated;

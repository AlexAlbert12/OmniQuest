-- Read-only review index for a learner's own game attempt.
-- The detailed submitted value and solution continue to be loaded through the
-- existing per-attempt authorization RPCs.

create or replace function public.get_game_attempt_review_index(
  p_attempt_id uuid default null,
  p_subject_id bigint default null,
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
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select ga.id
  into v_attempt_id
  from public.game_attempts ga
  where ga.student_id = v_user_id
    and (p_attempt_id is null or ga.id = p_attempt_id)
    and (p_subject_id is null or ga.subject_id = p_subject_id)
    and (p_classroom_id is null or ga.classroom_id = p_classroom_id)
    and (not p_general_topic or ga.topic_id is null)
    and (p_general_topic or p_topic_id is null or ga.topic_id = p_topic_id)
    and exists (
      select 1
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    )
    and (
      p_attempt_id is not null
      or exists (
        select 1
        from public.attempt_history failed
        join public.questions failed_question on failed_question.id = failed.question_id
        where failed.attempt_id = ga.id
          and failed.is_correct = false
          and coalesce(failed.manual_review_status, 'not_required') in ('not_required', 'approved', 'rejected')
          and (p_difficulty is null or coalesce(failed_question.difficulty, 1) = p_difficulty)
          and (not p_general_topic or failed_question.topic_id is null)
          and (p_general_topic or p_topic_id is null or failed_question.topic_id = p_topic_id)
      )
    )
  order by ga.started_at desc, ga.id desc
  limit 1;

  if v_attempt_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'attempt_id', ga.id,
    'subject_id', ga.subject_id,
    'subject_name', s.name,
    'classroom_id', ga.classroom_id,
    'topic_id', ga.topic_id,
    'topic_title', st.title,
    'difficulty', p_difficulty,
    'started_at', ga.started_at,
    'finished_at', ga.finished_at,
    'status', ga.status,
    'total_score', coalesce(ga.total_score, 0),
    'questions_total', (
      select count(*)::integer
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ),
    'correct_total', (
      select count(*)::integer
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and ah.is_correct = true
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ),
    'failed_attempt_history_ids', coalesce((
      select jsonb_agg(ah.id order by ah.attempted_at asc, ah.id asc)
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and ah.is_correct = false
        and coalesce(ah.manual_review_status, 'not_required') in ('not_required', 'approved', 'rejected')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ), '[]'::jsonb),
    'failed_attempts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'history_id', ah.id,
          'submitted_answer_display', case
            when ah.was_skipped then 'Sin respuesta / tiempo agotado'
            when nullif(btrim(ah.submitted_answer_text), '') is not null then btrim(ah.submitted_answer_text)
            when ah.answer_id is not null then (
              select selected_answer.text
              from public.answers selected_answer
              where selected_answer.id = ah.answer_id
                and selected_answer.question_id = q.id
            )
            when q.type = 'ordering' then (
              select string_agg(ordering_answer.text, ' → ' order by submitted_item.ordinality)
              from jsonb_array_elements_text(coalesce(ah.submitted_answer_payload->'answer_ids', '[]'::jsonb))
                with ordinality submitted_item(answer_id, ordinality)
              join public.answers ordering_answer
                on ordering_answer.id = submitted_item.answer_id::bigint
               and ordering_answer.question_id = q.id
            )
            when q.type in ('match_pairs', 'drag_drop') then (
              select string_agg(
                concat(coalesce(pair.value->>'left', ''), ' → ', coalesce(pair.value->>'right', '')),
                E'\n'
                order by pair.ordinality
              )
              from jsonb_array_elements(coalesce(ah.submitted_answer_payload->'pairs', '[]'::jsonb))
                with ordinality pair(value, ordinality)
            )
            else null
          end
        )
        order by ah.attempted_at asc, ah.id asc
      )
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and ah.is_correct = false
        and coalesce(ah.manual_review_status, 'not_required') in ('not_required', 'approved', 'rejected')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ), '[]'::jsonb)
  )
  into v_result
  from public.game_attempts ga
  join public.subjects s on s.id = ga.subject_id
  left join public.subject_topics st on st.id = ga.topic_id
  where ga.id = v_attempt_id;

  return v_result;
end;
$$;

revoke all on function public.get_game_attempt_review_index(uuid, bigint, bigint, bigint, boolean, integer) from public, anon;
grant execute on function public.get_game_attempt_review_index(uuid, bigint, bigint, bigint, boolean, integer) to authenticated;

comment on function public.get_game_attempt_review_index(uuid, bigint, bigint, bigint, boolean, integer)
  is 'Returns the learner-owned game attempt summary and failed attempt-history ids for a read-only review.';

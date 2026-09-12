-- Open-answer review consistency: unresolved manual reviews are neither correct nor incorrect.
-- Adds recent game summaries for students and keeps teacher diagnostics aligned with that rule.

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
    select 1 from public.profiles p
    where p.id = v_user_id and p.role_id = 'student' and coalesce(p.active, true) = true
  ) then
    raise exception 'Student access required.' using errcode = '42501';
  end if;

  with enrolled as (
    select e.subject_id, e.classroom_id, e.joined_at, s.name, s.description, s.icon, s.theme_color,
      c.name as classroom_name, c.code as classroom_code
    from public.enrollments e
    join public.subjects s on s.id = e.subject_id
    left join public.classrooms c on c.id = e.classroom_id
    where e.student_id = v_user_id
      and coalesce(s.active, true) = true
      and coalesce(s.is_archived, false) = false
      and (c.id is null or coalesce(c.active, true) = true)
  ), progress_rows as (
    select
      e.subject_id as id, e.classroom_id, e.classroom_name, e.classroom_code, e.name, e.description, e.icon, e.theme_color, e.joined_at,
      coalesce(question_stats.total_questions, 0)::integer as total_questions,
      coalesce(question_stats.answered_questions, 0)::integer as answered_questions,
      coalesce(question_stats.failed_questions, 0)::integer as failed_questions,
      coalesce(question_stats.pending_review_questions, 0)::integer as pending_review_questions,
      coalesce(topic_stats.total_topics, 0)::integer as total_topics,
      coalesce(topic_stats.completed_topics, 0)::integer as completed_topics,
      coalesce(attempt_stats.total_attempts, 0)::integer as total_attempts,
      coalesce(attempt_stats.evaluated_attempts, 0)::integer as evaluated_attempts,
      coalesce(attempt_stats.pending_review_attempts, 0)::integer as pending_review_attempts,
      coalesce(attempt_stats.correct_attempts, 0)::integer as correct_attempts
    from enrolled e
    left join lateral (
      select
        count(*)::integer as total_questions,
        count(*) filter (where exists (
          select 1 from public.attempt_history ah where ah.student_id = v_user_id and ah.question_id = q.id
        ))::integer as answered_questions,
        count(*) filter (where exists (
          select 1 from public.attempt_history ah
          where ah.student_id = v_user_id and ah.question_id = q.id and ah.is_correct = false
            and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        ))::integer as failed_questions,
        count(*) filter (where exists (
          select 1 from public.attempt_history ah
          where ah.student_id = v_user_id and ah.question_id = q.id
            and coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes')
        ))::integer as pending_review_questions
      from public.questions q
      where q.subject_id = e.subject_id
        and coalesce(q.active, true) = true
        and (e.classroom_id is null or q.classroom_id = e.classroom_id)
        and (q.topic_id is null or exists (
          select 1 from public.subject_topics active_topic
          where active_topic.id = q.topic_id and coalesce(active_topic.active, true) = true
        ))
    ) question_stats on true
    left join lateral (
      select
        count(*)::integer as total_topics,
        count(*) filter (
          where exists (
            select 1 from public.questions q
            where q.topic_id = t.id and coalesce(q.active, true) = true
              and (e.classroom_id is null or q.classroom_id = e.classroom_id)
          )
          and not exists (
            select 1 from public.questions q
            where q.topic_id = t.id and coalesce(q.active, true) = true
              and (e.classroom_id is null or q.classroom_id = e.classroom_id)
              and not exists (
                select 1 from public.attempt_history ah where ah.student_id = v_user_id and ah.question_id = q.id
              )
          )
        )::integer as completed_topics
      from public.subject_topics t
      where t.subject_id = e.subject_id and coalesce(t.active, true) = true
        and (e.classroom_id is null or t.classroom_id = e.classroom_id)
    ) topic_stats on true
    left join lateral (
      select
        count(ah.id)::integer as total_attempts,
        count(ah.id) filter (
          where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        )::integer as evaluated_attempts,
        count(ah.id) filter (
          where coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes')
        )::integer as pending_review_attempts,
        count(ah.id) filter (
          where ah.is_correct = true
            and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        )::integer as correct_attempts
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.student_id = v_user_id and q.subject_id = e.subject_id and coalesce(q.active, true) = true
        and (e.classroom_id is null or q.classroom_id = e.classroom_id)
        and (q.topic_id is null or exists (
          select 1 from public.subject_topics active_topic
          where active_topic.id = q.topic_id and coalesce(active_topic.active, true) = true
        ))
    ) attempt_stats on true
  ), totals as (
    select
      count(*)::integer as total_classes,
      count(*) filter (where total_questions > 0 and answered_questions >= total_questions)::integer as completed_classes,
      coalesce(sum(total_questions), 0)::integer as total_questions,
      coalesce(sum(answered_questions), 0)::integer as answered_questions,
      coalesce(sum(total_attempts), 0)::integer as total_attempts,
      coalesce(sum(evaluated_attempts), 0)::integer as evaluated_attempts,
      coalesce(sum(pending_review_attempts), 0)::integer as pending_review_attempts,
      coalesce(sum(correct_attempts), 0)::integer as correct_attempts
    from progress_rows
  )
  select jsonb_build_object(
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
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
        'pendingReviewQuestions', pr.pending_review_questions,
        'failedQuestions', pr.failed_questions,
        'percent', case when pr.total_questions > 0 then round((pr.answered_questions::numeric / pr.total_questions::numeric) * 100)::integer else 0 end,
        'isCompleted', pr.total_questions > 0 and pr.answered_questions >= pr.total_questions
      ) order by pr.joined_at desc, pr.id)
      from progress_rows pr
    ), '[]'::jsonb),
    'totalClasses', totals.total_classes,
    'completedClasses', totals.completed_classes,
    'totalQuestions', totals.total_questions,
    'answeredQuestions', totals.answered_questions,
    'totalAttempts', totals.total_attempts,
    'evaluatedAttempts', totals.evaluated_attempts,
    'pendingReviewAttempts', totals.pending_review_attempts,
    'correctAttempts', totals.correct_attempts,
    'accuracyPercent', case when totals.evaluated_attempts > 0 then round((totals.correct_attempts::numeric / totals.evaluated_attempts::numeric) * 100)::integer else 0 end,
    'overallPercent', case when totals.total_questions > 0 then round((totals.answered_questions::numeric / totals.total_questions::numeric) * 100)::integer else 0 end
  ) into v_result
  from totals;

  return coalesce(v_result, jsonb_build_object(
    'subjects', '[]'::jsonb, 'totalClasses', 0, 'completedClasses', 0,
    'totalQuestions', 0, 'answeredQuestions', 0, 'totalAttempts', 0,
    'evaluatedAttempts', 0, 'pendingReviewAttempts', 0, 'correctAttempts', 0,
    'accuracyPercent', 0, 'overallPercent', 0
  ));
end;
$$;

revoke all on function public.get_student_progress_summary() from public, anon;
grant execute on function public.get_student_progress_summary() to authenticated;

create or replace function public.get_student_attempt_history_page(
  p_status text default 'all',
  p_search text default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_difficulty integer default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_status text := lower(coalesce(nullif(trim(p_status), ''), 'all'));
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'No authenticated user'; end if;

  with base as (
    select ah.id, ah.question_id, ah.answer_id, ah.is_correct, ah.time_taken_seconds, ah.attempted_at,
      ah.earned_points, ah.hint_used, ah.was_skipped, ah.manual_review_status, ah.reviewed_at,
      q.text as question_text, q.type as question_type, q.difficulty, q.subject_id, q.classroom_id, q.topic_id,
      s.name as subject_name, st.title as topic_title,
      coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes') as unresolved
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.subjects s on s.id = q.subject_id
    left join public.subject_topics st on st.id = q.topic_id
    where ah.student_id = v_user_id
  ), search_scoped as (
    select b.* from base b
    where v_search is null or concat_ws(' ', b.question_text, b.subject_name, b.topic_title) ilike '%' || v_search || '%'
  ), status_scope as (
    select b.* from search_scoped b
    where (p_subject_id is null or b.subject_id = p_subject_id)
      and (p_classroom_id is null or b.classroom_id = p_classroom_id)
      and (p_topic_id is null or b.topic_id = p_topic_id)
      and (p_difficulty is null or coalesce(b.difficulty, 1) = p_difficulty)
  ), subject_scope as (
    select b.* from search_scoped b
    where (
      v_status = 'all'
      or (v_status = 'correct' and b.is_correct and not b.unresolved)
      or (v_status = 'incorrect' and not b.is_correct and not b.unresolved)
      or (v_status = 'pending' and b.unresolved)
    )
      and (p_classroom_id is null or b.classroom_id = p_classroom_id)
      and (p_topic_id is null or b.topic_id = p_topic_id)
      and (p_difficulty is null or coalesce(b.difficulty, 1) = p_difficulty)
  ), topic_scope as (
    select b.* from search_scoped b
    where (
      v_status = 'all'
      or (v_status = 'correct' and b.is_correct and not b.unresolved)
      or (v_status = 'incorrect' and not b.is_correct and not b.unresolved)
      or (v_status = 'pending' and b.unresolved)
    )
      and (p_subject_id is null or b.subject_id = p_subject_id)
      and (p_classroom_id is null or b.classroom_id = p_classroom_id)
      and (p_difficulty is null or coalesce(b.difficulty, 1) = p_difficulty)
  ), filtered as (
    select b.* from status_scope b
    where v_status = 'all'
      or (v_status = 'correct' and b.is_correct and not b.unresolved)
      or (v_status = 'incorrect' and not b.is_correct and not b.unresolved)
      or (v_status = 'pending' and b.unresolved)
  ), ranked as (
    select f.*, count(*) over()::bigint as total_count from filtered f
  ), page as (
    select * from ranked order by attempted_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'question_id', p.question_id, 'answer_id', null, 'is_correct', p.is_correct,
      'time_taken_seconds', p.time_taken_seconds, 'attempted_at', p.attempted_at,
      'submitted_answer_text', null, 'submitted_answer_payload', null, 'earned_points', p.earned_points,
      'hint_used', p.hint_used, 'was_skipped', p.was_skipped,
      'manual_review_status', p.manual_review_status, 'reviewed_at', p.reviewed_at,
      'questions', jsonb_build_object(
        'id', p.question_id, 'text', p.question_text, 'type', p.question_type,
        'difficulty', coalesce(p.difficulty, 1), 'subject_id', p.subject_id,
        'classroom_id', p.classroom_id, 'topic_id', p.topic_id, 'explanation', null,
        'subjects', jsonb_build_object('id', p.subject_id, 'name', p.subject_name),
        'subject_topics', case when p.topic_id is null then null else jsonb_build_object('id', p.topic_id, 'title', p.topic_title) end,
        'answers', '[]'::jsonb
      )
    ) order by p.attempted_at desc, p.id desc) from page p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'status_counts', jsonb_build_object(
      'all', (select count(*) from status_scope),
      'correct', (select count(*) from status_scope where is_correct and not unresolved),
      'incorrect', (select count(*) from status_scope where not is_correct and not unresolved),
      'pending', (select count(*) from status_scope where unresolved)
    ),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
      'id', subject_id, 'label', coalesce(subject_name, 'Clase sin nombre'), 'count', item_count
    ) order by coalesce(subject_name, 'Clase sin nombre')) from (
      select subject_id, max(subject_name) as subject_name, count(*)::integer as item_count
      from subject_scope where subject_id is not null group by subject_id
    ) subject_facets), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object(
      'id', coalesce(topic_id::text, 'general'), 'subject_id', subject_id,
      'label', coalesce(topic_title, 'Tema general'), 'count', item_count
    ) order by coalesce(topic_title, 'Tema general')) from (
      select topic_id, subject_id, max(topic_title) as topic_title, count(*)::integer as item_count
      from topic_scope group by topic_id, subject_id
    ) topic_facets), '[]'::jsonb)
  ) into v_result;

  return coalesce(v_result, jsonb_build_object(
    'rows', '[]'::jsonb, 'total', 0,
    'status_counts', jsonb_build_object('all', 0, 'correct', 0, 'incorrect', 0, 'pending', 0),
    'subjects', '[]'::jsonb, 'topics', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.get_student_attempt_history_page(text, text, bigint, bigint, bigint, integer, integer, integer) from public, anon;
grant execute on function public.get_student_attempt_history_page(text, text, bigint, bigint, bigint, integer, integer, integer) to authenticated;

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
  v_reveal_feedback boolean := false;
  v_comments jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'No authenticated user'; end if;

  select ah.student_id, s.teacher_id, coalesce(ah.manual_review_status, 'not_required')
  into v_owner_id, v_teacher_id, v_review_status
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where ah.id = p_attempt_history_id;

  if not found then raise exception 'Attempt not found'; end if;
  if v_owner_id <> v_user_id and v_teacher_id <> v_user_id and not public.is_admin() then
    raise exception 'No puedes consultar este intento.';
  end if;

  v_reveal_feedback := v_review_status in ('not_required', 'approved', 'rejected');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'author_name', coalesce(p.alias, split_part(p.email, '@', 1), 'Profesor'),
    'body', c.body,
    'created_at', c.created_at
  ) order by c.created_at asc, c.id asc), '[]'::jsonb)
  into v_comments
  from public.manual_review_comments c
  left join public.profiles p on p.id = c.author_id
  where c.attempt_history_id = p_attempt_history_id
    and (v_user_id = v_teacher_id or public.is_admin() or c.audience = 'student');

  select jsonb_build_object(
    'id', ah.id, 'question_id', ah.question_id, 'answer_id', null,
    'is_correct', ah.is_correct, 'time_taken_seconds', ah.time_taken_seconds,
    'attempted_at', ah.attempted_at,
    'submitted_answer_text', coalesce(ah.submitted_answer_text, selected_answer.text),
    'submitted_answer_payload', ah.submitted_answer_payload,
    'earned_points', ah.earned_points, 'hint_used', ah.hint_used, 'was_skipped', ah.was_skipped,
    'manual_review_status', ah.manual_review_status, 'reviewed_at', ah.reviewed_at,
    'review_notes', case when v_user_id = v_teacher_id or public.is_admin() then ah.review_notes else null end,
    'review_comments', v_comments,
    'questions', jsonb_build_object(
      'id', q.id, 'text', q.text, 'type', q.type, 'difficulty', coalesce(q.difficulty, 1),
      'subject_id', q.subject_id, 'classroom_id', q.classroom_id, 'topic_id', q.topic_id,
      'media_type', q.media_type, 'media_url', null, 'media_alt_text', q.media_alt_text, 'media_caption', q.media_caption,
      'explanation', case when v_reveal_feedback then q.explanation else null end,
      'subjects', jsonb_build_object('id', s.id, 'name', s.name),
      'subject_topics', case when st.id is null then null else jsonb_build_object('id', st.id, 'title', st.title) end,
      'answers', '[]'::jsonb
    )
  ) into v_result
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  left join public.subject_topics st on st.id = q.topic_id
  left join public.answers selected_answer on selected_answer.id = ah.answer_id and selected_answer.question_id = q.id
  where ah.id = p_attempt_history_id;

  return v_result;
end;
$$;

revoke all on function public.get_activity_attempt_detail(bigint) from public, anon;
grant execute on function public.get_activity_attempt_detail(bigint) to authenticated;

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
  if v_user_id is null then raise exception 'No authenticated user'; end if;

  select ga.id into v_attempt_id
  from public.game_attempts ga
  where ga.student_id = v_user_id
    and (p_attempt_id is null or ga.id = p_attempt_id)
    and (p_subject_id is null or ga.subject_id = p_subject_id)
    and (p_classroom_id is null or ga.classroom_id = p_classroom_id)
    and (not p_general_topic or ga.topic_id is null)
    and (p_general_topic or p_topic_id is null or ga.topic_id = p_topic_id)
    and exists (
      select 1 from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    )
    and (
      p_attempt_id is not null
      or exists (
        select 1 from public.attempt_history failed
        join public.questions failed_question on failed_question.id = failed.question_id
        where failed.attempt_id = ga.id and failed.is_correct = false
          and coalesce(failed.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
          and (p_difficulty is null or coalesce(failed_question.difficulty, 1) = p_difficulty)
          and (not p_general_topic or failed_question.topic_id is null)
          and (p_general_topic or p_topic_id is null or failed_question.topic_id = p_topic_id)
      )
    )
  order by ga.started_at desc, ga.id desc
  limit 1;

  if v_attempt_id is null then return null; end if;

  select jsonb_build_object(
    'attempt_id', ga.id, 'subject_id', ga.subject_id, 'subject_name', s.name,
    'classroom_id', ga.classroom_id, 'topic_id', ga.topic_id, 'topic_title', st.title,
    'difficulty', coalesce(p_difficulty, (
      select case when min(coalesce(q.difficulty, 1)) = max(coalesce(q.difficulty, 1)) then min(coalesce(q.difficulty, 1)) else null end
      from public.attempt_history ah join public.questions q on q.id = ah.question_id where ah.attempt_id = ga.id
    )),
    'started_at', ga.started_at, 'finished_at', ga.finished_at, 'status', ga.status,
    'total_score', coalesce(ga.total_score, 0),
    'questions_total', (
      select count(*)::integer from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ),
    'evaluated_total', (
      select count(*)::integer from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ),
    'pending_total', (
      select count(*)::integer from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id
        and coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ),
    'correct_total', (
      select count(*)::integer from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id and ah.is_correct = true
        and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ),
    'incorrect_total', (
      select count(*)::integer from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id and ah.is_correct = false
        and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ),
    'failed_attempt_history_ids', coalesce((
      select jsonb_agg(ah.id order by ah.attempted_at asc, ah.id asc)
      from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id and ah.is_correct = false
        and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ), '[]'::jsonb),
    'failed_attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'history_id', ah.id,
        'submitted_answer_display', case
          when ah.was_skipped then 'Sin respuesta / tiempo agotado'
          when nullif(btrim(ah.submitted_answer_text), '') is not null then btrim(ah.submitted_answer_text)
          when ah.answer_id is not null then (
            select selected_answer.text from public.answers selected_answer
            where selected_answer.id = ah.answer_id and selected_answer.question_id = q.id
          )
          when q.type = 'ordering' then (
            select string_agg(ordering_answer.text, ' → ' order by submitted_item.ordinality)
            from jsonb_array_elements_text(coalesce(ah.submitted_answer_payload->'answer_ids', '[]'::jsonb)) with ordinality submitted_item(answer_id, ordinality)
            join public.answers ordering_answer on ordering_answer.id = submitted_item.answer_id::bigint and ordering_answer.question_id = q.id
          )
          when q.type in ('match_pairs', 'drag_drop') then (
            select string_agg(concat(coalesce(pair.value->>'left', ''), ' → ', coalesce(pair.value->>'right', '')), E'\n' order by pair.ordinality)
            from jsonb_array_elements(coalesce(ah.submitted_answer_payload->'pairs', '[]'::jsonb)) with ordinality pair(value, ordinality)
          )
          else null
        end
      ) order by ah.attempted_at asc, ah.id asc)
      from public.attempt_history ah join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id and ah.is_correct = false
        and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
        and (not p_general_topic or q.topic_id is null)
        and (p_general_topic or p_topic_id is null or q.topic_id = p_topic_id)
    ), '[]'::jsonb)
  ) into v_result
  from public.game_attempts ga
  join public.subjects s on s.id = ga.subject_id
  left join public.subject_topics st on st.id = ga.topic_id
  where ga.id = v_attempt_id;

  return v_result;
end;
$$;

revoke all on function public.get_game_attempt_review_index(uuid, bigint, bigint, bigint, boolean, integer) from public, anon;
grant execute on function public.get_game_attempt_review_index(uuid, bigint, bigint, bigint, boolean, integer) to authenticated;

create or replace function public.get_student_recent_game_attempts(p_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role_id = 'student' and coalesce(p.active, true) = true
  ) then
    raise exception 'Student access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(recent_rows) - 'sort_at' order by recent_rows.sort_at desc, recent_rows.id desc), '[]'::jsonb)
  into v_result
  from (
    select
      ga.id,
      ga.subject_id as "subjectId",
      s.name as "subjectName",
      ga.classroom_id as "classroomId",
      c.name as "classroomName",
      ga.topic_id as "topicId",
      st.title as "topicName",
      stats.difficulty,
      ga.started_at as "startedAt",
      ga.finished_at as "finishedAt",
      coalesce(ga.total_score, 0)::integer as "totalScore",
      stats.questions_total as "questionsTotal",
      stats.evaluated_total as "evaluatedTotal",
      stats.correct_total as "correctTotal",
      stats.incorrect_total as "incorrectTotal",
      stats.pending_total as "pendingTotal",
      case when ga.finished_at is null then null else greatest(0, extract(epoch from (ga.finished_at - ga.started_at))::integer) end as "durationSeconds",
      coalesce(ga.finished_at, ga.updated_at, ga.started_at) as sort_at
    from public.game_attempts ga
    join public.subjects s on s.id = ga.subject_id
    left join public.classrooms c on c.id = ga.classroom_id
    left join public.subject_topics st on st.id = ga.topic_id
    join lateral (
      select
        count(*)::integer as questions_total,
        count(*) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::integer as evaluated_total,
        count(*) filter (where ah.is_correct = true and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::integer as correct_total,
        count(*) filter (where ah.is_correct = false and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::integer as incorrect_total,
        count(*) filter (where coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes'))::integer as pending_total,
        case when min(coalesce(q.difficulty, 1)) = max(coalesce(q.difficulty, 1)) then min(coalesce(q.difficulty, 1)) else null end as difficulty
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.attempt_id = ga.id and ah.student_id = v_user_id
    ) stats on true
    where ga.student_id = v_user_id and ga.status = 'finished' and stats.questions_total > 0
    order by coalesce(ga.finished_at, ga.updated_at, ga.started_at) desc, ga.id desc
    limit v_limit
  ) recent_rows;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function public.get_student_recent_game_attempts(integer) from public, anon;
grant execute on function public.get_student_recent_game_attempts(integer) to authenticated;

create or replace function public.get_teacher_question_report(
  p_question_id bigint,
  p_classroom_id bigint default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subject_id bigint;
  v_result jsonb;
begin
  select q.subject_id into v_subject_id
  from public.questions q join public.subjects s on s.id = q.subject_id
  where q.id = p_question_id and (public.is_admin() or s.teacher_id = v_user_id);
  if not found then raise exception 'Question report access denied'; end if;

  with attempts as (
    select ah.*, coalesce(ga.classroom_id, q.classroom_id) as resolved_classroom_id,
      coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes') as unresolved
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.game_attempts ga on ga.id = ah.attempt_id
    where ah.question_id = p_question_id
      and (p_classroom_id is null or coalesce(ga.classroom_id, q.classroom_id) = p_classroom_id)
      and (p_date_from is null or ah.attempted_at >= p_date_from)
      and (p_date_to is null or ah.attempted_at < p_date_to)
  ), summary as (
    select count(*)::integer as total_attempts,
      count(*) filter (where not unresolved)::integer as evaluated_attempts,
      count(*) filter (where unresolved)::integer as pending_attempts,
      count(*) filter (where is_correct and not unresolved)::integer as correct_attempts,
      count(*) filter (where not is_correct and not unresolved)::integer as failed_attempts,
      count(*) filter (where was_skipped)::integer as skipped_attempts,
      count(distinct student_id)::integer as sample_size,
      round(avg(time_taken_seconds) filter (where time_taken_seconds is not null), 1) as average_time_seconds,
      round(100.0 * count(*) filter (where was_skipped) / nullif(count(*), 0), 1) as abandonment_percent
    from attempts
  ), answer_distribution as (
    select coalesce(a.text, case when at.was_skipped then 'Omitida' when q.type = 'open_answer' then 'Respuesta libre' else 'Respuesta interactiva' end) as label,
      count(*)::integer as count, bool_or(coalesce(a.is_correct, at.is_correct)) as correct
    from attempts at join public.questions q on q.id = at.question_id left join public.answers a on a.id = at.answer_id
    group by 1
  ), class_comparison as (
    select coalesce(at.resolved_classroom_id, 0) as classroom_id, coalesce(c.name, 'Sin clase') as classroom_name,
      count(*)::integer as attempts,
      count(*) filter (where not at.unresolved)::integer as evaluated,
      count(*) filter (where at.unresolved)::integer as pending,
      count(*) filter (where at.is_correct and not at.unresolved)::integer as correct,
      count(*) filter (where not at.is_correct and not at.unresolved)::integer as failed,
      round(100.0 * count(*) filter (where not at.is_correct and not at.unresolved) / nullif(count(*) filter (where not at.unresolved), 0), 1) as failure_percent,
      round(avg(at.time_taken_seconds) filter (where at.time_taken_seconds is not null), 1) as average_time_seconds
    from attempts at left join public.classrooms c on c.id = at.resolved_classroom_id
    group by 1, 2
  ), temporal as (
    select date_trunc('day', attempted_at)::date as "day", count(*)::integer as attempts,
      round(100.0 * count(*) filter (where not is_correct and not unresolved) / nullif(count(*) filter (where not unresolved), 0), 1) as failure_percent,
      round(avg(time_taken_seconds) filter (where time_taken_seconds is not null), 1) as average_time_seconds
    from attempts where attempted_at >= now() - interval '30 days' group by 1 order by 1
  ), subject_student_scores as (
    select ah.student_id,
      avg(case
        when coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes') then null
        when ah.is_correct then 1.0 else 0.0 end
      ) as subject_accuracy
    from public.attempt_history ah join public.questions q on q.id = ah.question_id
    where q.subject_id = v_subject_id
    group by ah.student_id
  ), ranked as (
    select student_id, subject_accuracy, percent_rank() over(order by subject_accuracy) as pr
    from subject_student_scores where subject_accuracy is not null
  ), discrimination as (
    select round((
      avg(case when a.is_correct then 1.0 else 0.0 end) filter (where r.pr >= 0.73 and not a.unresolved)
      - avg(case when a.is_correct then 1.0 else 0.0 end) filter (where r.pr <= 0.27 and not a.unresolved)
    )::numeric, 3) as value
    from attempts a join ranked r on r.student_id = a.student_id
  ), recent as (
    select
      round(100.0 * count(*) filter (where not is_correct and not unresolved and attempted_at >= now() - interval '7 days') /
        nullif(count(*) filter (where not unresolved and attempted_at >= now() - interval '7 days'), 0), 1) as current_failure,
      round(100.0 * count(*) filter (where not is_correct and not unresolved and attempted_at >= now() - interval '14 days' and attempted_at < now() - interval '7 days') /
        nullif(count(*) filter (where not unresolved and attempted_at >= now() - interval '14 days' and attempted_at < now() - interval '7 days'), 0), 1) as previous_failure
    from attempts
  )
  select jsonb_build_object(
    'question', (select jsonb_build_object(
      'id', q.id, 'text', q.text, 'type', q.type, 'subjectId', q.subject_id, 'classroomId', q.classroom_id,
      'topicId', q.topic_id, 'explanation', q.explanation, 'mediaType', q.media_type, 'mediaPath', q.media_path,
      'mediaAltText', q.media_alt_text, 'mediaCaption', q.media_caption, 'pointsBase', q.points_base,
      'timeLimitSeconds', q.time_limit_seconds, 'difficulty', q.difficulty, 'active', q.active,
      'subjectName', s.name, 'classroomName', c.name, 'topicName', st.title
    ) from public.questions q join public.subjects s on s.id = q.subject_id
      left join public.classrooms c on c.id = q.classroom_id left join public.subject_topics st on st.id = q.topic_id
      where q.id = p_question_id),
    'summary', (select jsonb_build_object(
      'totalAttempts', coalesce(total_attempts, 0),
      'evaluatedAttempts', coalesce(evaluated_attempts, 0),
      'pendingAttempts', coalesce(pending_attempts, 0),
      'correctAttempts', coalesce(correct_attempts, 0),
      'failedAttempts', coalesce(failed_attempts, 0),
      'sampleSize', coalesce(sample_size, 0), 'lowSample', coalesce(sample_size, 0) < 10,
      'abandonmentPercent', coalesce(abandonment_percent, 0), 'averageTimeSeconds', average_time_seconds,
      'discrimination', (select value from discrimination),
      'failureTrendPoints', coalesce((select current_failure - previous_failure from recent), 0)
    ) from summary),
    'answerDistribution', coalesce((select jsonb_agg(jsonb_build_object(
      'label', label, 'count', count, 'correct', correct,
      'percent', round(100.0 * count / nullif((select total_attempts from summary), 0), 1)
    ) order by count desc) from answer_distribution), '[]'::jsonb),
    'classComparison', coalesce((select jsonb_agg(to_jsonb(class_comparison) order by failure_percent desc nulls last) from class_comparison), '[]'::jsonb),
    'temporalTrend', coalesce((select jsonb_agg(to_jsonb(temporal) order by temporal."day") from temporal), '[]'::jsonb),
    'classOptions', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
      from public.classrooms c where c.subject_id = v_subject_id and c.active), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_question_report(bigint,bigint,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_teacher_question_report(bigint,bigint,timestamptz,timestamptz) to authenticated;

create or replace function public.get_teacher_question_affected_students_page(
  p_question_id bigint,
  p_classroom_id bigint default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if not exists (
    select 1 from public.questions q join public.subjects s on s.id = q.subject_id
    where q.id = p_question_id and (public.is_admin() or s.teacher_id = v_user_id)
  ) then raise exception 'Question report access denied'; end if;

  with attempts as (
    select ah.*, coalesce(ga.classroom_id, q.classroom_id) as resolved_classroom_id
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.game_attempts ga on ga.id = ah.attempt_id
    where ah.question_id = p_question_id
      and ah.is_correct = false
      and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
      and (p_classroom_id is null or coalesce(ga.classroom_id, q.classroom_id) = p_classroom_id)
      and (p_date_from is null or ah.attempted_at >= p_date_from)
      and (p_date_to is null or ah.attempted_at < p_date_to)
  ), grouped as (
    select a.student_id, coalesce(p.alias, 'Alumno') as alias, p.avatar,
      count(*)::integer as failures, count(*)::integer as attempts,
      round(avg(a.time_taken_seconds) filter (where a.time_taken_seconds is not null), 1) as average_time_seconds,
      max(a.attempted_at) as last_attempt_at, coalesce(max(c.name), 'Sin clase') as classroom_name
    from attempts a left join public.profiles p on p.id = a.student_id
    left join public.classrooms c on c.id = a.resolved_classroom_id
    group by a.student_id, p.alias, p.avatar
  ), page as (
    select * from grouped order by failures desc, last_attempt_at desc nulls last limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) order by failures desc, last_attempt_at desc nulls last) from page), '[]'::jsonb),
    'total', (select count(*) from grouped)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_question_affected_students_page(bigint,bigint,timestamptz,timestamptz,integer,integer) from public, anon;
grant execute on function public.get_teacher_question_affected_students_page(bigint,bigint,timestamptz,timestamptz,integer,integer) to authenticated;

-- Review-failed mode must only include a definitively evaluated failure.
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
  if v_user_id is null then raise exception 'No authenticated user'; end if;
  if p_difficulty is not null and p_difficulty not in (1, 2, 3) then raise exception 'Invalid difficulty'; end if;

  if not exists (
    select 1 from public.subjects s
    where s.id = p_subject_id and s.active is true and coalesce(s.is_archived, false) is false
  ) then raise exception 'Este curso no está disponible para jugar.'; end if;

  if p_topic_id is not null then perform public.assert_topic_playable(p_topic_id); end if;
  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1 from public.classrooms c join public.subjects s on s.id = c.subject_id
    where c.id = v_classroom_id and c.subject_id = p_subject_id and coalesce(c.active, true)
      and (s.teacher_id = v_user_id or public.is_admin() or exists (
        select 1 from public.enrollments e
        where e.student_id = v_user_id and e.subject_id = p_subject_id and (e.classroom_id = c.id or e.classroom_id is null)
      ))
  ) then raise exception 'No puedes acceder a esta clase.'; end if;

  select coalesce(jsonb_agg(question_payload order by random()), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', q.id, 'text', q.text, 'type', q.type, 'difficulty', coalesce(q.difficulty, 1),
      'points_base', q.points_base, 'time_limit_seconds', q.time_limit_seconds,
      'topic_id', q.topic_id, 'classroom_id', q.classroom_id, 'question_updated_at', q.updated_at,
      'media_type', q.media_type, 'media_url', null, 'media_alt_text', q.media_alt_text, 'media_caption', q.media_caption,
      'blank_count', case when q.type = 'fill_blank' then (
        select count(*) from public.answers a where a.question_id = q.id and coalesce(a.is_correct, true) and public.normalize_answer_text(a.text) <> ''
      ) else null end,
      'answers', case
        when q.type in ('open_answer', 'fill_blank') then '[]'::jsonb
        when q.type in ('match_pairs', 'drag_drop') then (
          select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'text', split_part(a.text, '|||', 1)) order by random()), '[]'::jsonb)
          from public.answers a where a.question_id = q.id
        )
        else (
          select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'text', a.text) order by random()), '[]'::jsonb)
          from public.answers a where a.question_id = q.id
        )
      end,
      'pair_options', case when q.type in ('match_pairs', 'drag_drop') then (
        select coalesce(jsonb_agg(pair_right order by random()), '[]'::jsonb)
        from (select split_part(a.text, '|||', 2) as pair_right from public.answers a where a.question_id = q.id and split_part(a.text, '|||', 2) <> '') pairs
      ) else '[]'::jsonb end
    ) as question_payload
    from public.questions q
    left join public.subject_topics st on st.id = q.topic_id
    where q.subject_id = p_subject_id and q.classroom_id = v_classroom_id and coalesce(q.active, true)
      and (q.topic_id is null or coalesce(st.active, true))
      and (q.topic_id is null or st.available_until is null or st.available_until > now())
      and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
      and ((p_general_topic and q.topic_id is null) or (not p_general_topic and p_topic_id is null) or (not p_general_topic and p_topic_id is not null and q.topic_id = p_topic_id))
      and (
        not p_review_failed
        or exists (
          select 1 from (
            select distinct on (ah.question_id) ah.question_id, ah.is_correct, ah.manual_review_status
            from public.attempt_history ah
            where ah.student_id = v_user_id
            order by ah.question_id, ah.attempted_at desc, ah.id desc
          ) latest
          where latest.question_id = q.id and latest.is_correct = false
            and coalesce(latest.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
        )
      )
  ) safe_questions;

  return v_result;
end;
$$;

revoke all on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) from public, anon;
grant execute on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) to authenticated;


-- Keep teacher-facing course/student analytics aligned: unresolved manual reviews are not failures.

create or replace function public.get_teacher_subject_students_page(
  p_subject_id bigint,
  p_classroom_id bigint,
  p_search text default null,
  p_status text default null,
  p_sort text default 'xp',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_sort text := case when p_sort in ('xp', 'progress', 'grade', 'recent', 'last_activity') then p_sort else 'xp' end;
  v_question_count integer;
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  if not exists (
    select 1 from public.classrooms c where c.id = p_classroom_id and c.subject_id = p_subject_id and coalesce(c.active, true)
  ) then
    raise exception 'Classroom not found';
  end if;

  select count(*)::int into v_question_count
  from public.questions q
  where q.subject_id = p_subject_id and q.classroom_id = p_classroom_id and coalesce(q.active, true);

  with attempts as (
    select ah.student_id,
      count(*)::int as total_answers,
      count(*) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as evaluated_answers,
      count(*) filter (where ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as correct_answers,
      count(*) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as failed_answers,
      count(*) filter (where coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes'))::int as pending_answers,
      max(ah.attempted_at) as last_activity
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    where q.subject_id = p_subject_id and q.classroom_id = p_classroom_id
    group by ah.student_id
  ),
  base_rows as (
    select
      e.student_id as id,
      coalesce(p.alias, 'Alumno') as name,
      coalesce(ss.max_score, 0)::int as score,
      coalesce(a.total_answers, 0)::int as total_answers,
      coalesce(a.evaluated_answers, 0)::int as evaluated_answers,
      coalesce(a.correct_answers, 0)::int as correct_answers,
      coalesce(a.failed_answers, 0)::int as failed_answers,
      coalesce(a.pending_answers, 0)::int as pending_answers,
      a.last_activity,
      case when coalesce(a.evaluated_answers, 0) > 0 then round(100.0 * a.correct_answers / a.evaluated_answers)::int else 0 end as accuracy_percent,
      case when coalesce(a.evaluated_answers, 0) > 0 then round((10.0 * a.correct_answers / a.evaluated_answers)::numeric, 1) else 0 end as grade,
      case when v_question_count > 0 then least(100, round(100.0 * coalesce(a.total_answers, 0) / v_question_count)::int) else 0 end as participation,
      case when v_question_count > 0 then ceil(coalesce(a.total_answers, 0)::numeric / v_question_count)::int else case when coalesce(a.total_answers, 0) > 0 then 1 else 0 end end as played_sessions,
      (coalesce(a.total_answers, 0) > 0) as has_activity
    from public.enrollments e
    left join public.profiles p on p.id = e.student_id
    left join public.subject_scores ss on ss.student_id = e.student_id and ss.subject_id = p_subject_id and ss.classroom_id = p_classroom_id
    left join attempts a on a.student_id = e.student_id
    where e.subject_id = p_subject_id and e.classroom_id = p_classroom_id and coalesce(p.active, true)
  ),
  rows as (
    select b.*,
      case
        when not b.has_activity then 'no_activity'
        when b.participation < 35 or (b.evaluated_answers > 0 and b.grade < 5) then 'needs_help'
        when b.last_activity < now() - interval '14 days' or b.participation < 60 then 'inactive'
        else 'active'
      end as status
    from base_rows b
  ),
  filtered as (
    select * from rows
    where (v_search is null or name ilike '%' || v_search || '%')
      and (v_status is null or v_status = 'all' or status = v_status)
  ),
  page_rows as (
    select * from filtered
    order by
      case when v_sort = 'progress' then participation end desc,
      case when v_sort = 'grade' then grade end desc,
      case when v_sort in ('recent', 'last_activity') then last_activity end desc nulls last,
      case when v_sort = 'xp' then score end desc,
      name asc, id asc
    limit v_limit offset v_offset
  ),
  best_student as (
    select * from rows where has_activity
    order by score desc, participation desc, grade desc, name asc, id asc
    limit 1
  ),
  attention_rows as (
    select * from rows where status in ('needs_help', 'no_activity')
    order by case status when 'needs_help' then 0 else 1 end, grade asc, participation asc, last_activity asc nulls first, name asc
    limit 4
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'score', score, 'grade', grade, 'accuracyPercent', accuracy_percent,
        'correctAnswers', correct_answers, 'failedAnswers', failed_answers, 'pendingAnswers', pending_answers, 'evaluatedAnswers', evaluated_answers, 'participation', participation,
        'playedSessions', played_sessions, 'lastActivity', last_activity, 'hasActivity', has_activity, 'status', status
      ) order by
        case when v_sort = 'progress' then participation end desc,
        case when v_sort = 'grade' then grade end desc,
        case when v_sort in ('recent', 'last_activity') then last_activity end desc nulls last,
        case when v_sort = 'xp' then score end desc,
        name asc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from filtered),
    'summary', jsonb_build_object(
      'enrolled', (select count(*)::int from rows),
      'answered', (select count(*) filter (where has_activity)::int from rows),
      'unassessed', (select count(*) filter (where not has_activity)::int from rows),
      'participation', (select case when count(*) > 0 then round(100.0 * count(*) filter (where has_activity) / count(*))::int else 0 end from rows),
      'activeThisWeek', (select count(*) filter (where has_activity and last_activity >= now() - interval '7 days')::int from rows),
      'averageGrade', (select coalesce(round(avg(grade)::numeric, 1), 0) from rows where evaluated_answers > 0),
      'averageAccuracy', (select case when coalesce(sum(evaluated_answers), 0) > 0 then round(100.0 * sum(correct_answers) / sum(evaluated_answers))::int else 0 end from rows),
      'failedAnswers', (select coalesce(sum(failed_answers), 0)::int from rows),
      'correctAnswers', (select coalesce(sum(correct_answers), 0)::int from rows),
      'averageXp', (select coalesce(round(avg(score)), 0)::int from rows),
      'generatedXp', (select coalesce(sum(score), 0)::int from rows),
      'playedSessionsTotal', (select coalesce(sum(played_sessions), 0)::int from rows),
      'questionsCount', v_question_count,
      'bestStudent', (select jsonb_build_object(
        'id', id, 'name', name, 'score', score, 'grade', grade, 'accuracyPercent', accuracy_percent,
        'correctAnswers', correct_answers, 'failedAnswers', failed_answers, 'pendingAnswers', pending_answers, 'evaluatedAnswers', evaluated_answers, 'participation', participation,
        'playedSessions', played_sessions, 'lastActivity', last_activity, 'hasActivity', has_activity, 'status', status
      ) from best_student),
      'attention', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'score', score, 'grade', grade, 'accuracyPercent', accuracy_percent,
        'correctAnswers', correct_answers, 'failedAnswers', failed_answers, 'pendingAnswers', pending_answers, 'evaluatedAnswers', evaluated_answers, 'participation', participation,
        'playedSessions', played_sessions, 'lastActivity', last_activity, 'hasActivity', has_activity, 'status', status
      ) order by case status when 'needs_help' then 0 else 1 end, grade asc, participation asc, name asc) from attention_rows), '[]'::jsonb)
    ),
    'gradeDistribution', jsonb_build_array(
      jsonb_build_object('label', 'Excelente (9-10)', 'count', (select count(*)::int from rows where evaluated_answers > 0 and grade >= 9)),
      jsonb_build_object('label', 'Notable (7-8,9)', 'count', (select count(*)::int from rows where evaluated_answers > 0 and grade >= 7 and grade < 9)),
      jsonb_build_object('label', 'Aprobado (5-6,9)', 'count', (select count(*)::int from rows where evaluated_answers > 0 and grade >= 5 and grade < 7)),
      jsonb_build_object('label', 'Suspenso (<5)', 'count', (select count(*)::int from rows where evaluated_answers > 0 and grade < 5))
    ),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_subject_analytics(
  p_subject_id bigint,
  p_classroom_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_students jsonb;
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  v_students := public.get_teacher_subject_students_page(p_subject_id, p_classroom_id, null, null, 'xp', 200, 0);

  with failed_questions as (
    select q.id, q.text, coalesce(t.title, 'Tema general') as topic,
      count(*) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as failures,
      count(*) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as total_attempts,
      case when count(*) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) > 0 then round(100.0 * count(*) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) / count(*) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')))::int else 0 end as failure_rate
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.subject_topics t on t.id = q.topic_id
    where q.subject_id = p_subject_id and q.classroom_id = p_classroom_id
    group by q.id, q.text, t.title
    having count(*) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) > 0
    order by failures desc, failure_rate desc
    limit 8
  ),
  weeks as (select generate_series(0, 5) as index),
  evolution as (
    select w.index,
      date_trunc('week', now()) - ((5 - w.index) * interval '7 days') as starts_at,
      date_trunc('week', now()) - ((4 - w.index) * interval '7 days') as ends_at
    from weeks w
  ),
  evolution_rows as (
    select e.index, e.starts_at, count(ah.id)::int as activity_count,
      coalesce(round(avg(coalesce(ah.earned_points, 0)) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))), 0)::int as average_score
    from evolution e
    left join public.questions q on q.subject_id = p_subject_id and q.classroom_id = p_classroom_id
    left join public.attempt_history ah on ah.question_id = q.id and ah.attempted_at >= e.starts_at and ah.attempted_at < e.ends_at
    group by e.index, e.starts_at
    order by e.index
  )
  select v_students || jsonb_build_object(
    'failedQuestions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'text', text, 'topic', topic, 'actualFailures', failures, 'totalAttempts', total_attempts, 'failureRate', failure_rate
    ) order by failures desc, failure_rate desc) from failed_questions), '[]'::jsonb),
    'temporalEvolution', coalesce((select jsonb_agg(jsonb_build_object(
      'label', to_char(starts_at, 'DD Mon'), 'activityCount', activity_count, 'averageScore', average_score
    ) order by index) from evolution_rows), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

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
      and (q.topic_id is null or exists (select 1 from public.subject_topics active_topic where active_topic.id = q.topic_id and coalesce(active_topic.active, true)))
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
      count(ah.id) filter (where q.id is not null and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as evaluated_count,
      count(ah.id) filter (where q.id is not null and ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as correct_count,
      count(ah.id) filter (where q.id is not null and coalesce(ah.manual_review_status, 'not_required') in ('pending', 'in_review', 'needs_changes'))::int as pending_review_count,
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
      coalesce(aa.evaluated_count, 0)::int as evaluated_count,
      coalesce(aa.pending_review_count, 0)::int as pending_review_count,
      coalesce(aa.correct_count, 0)::int as correct_count,
      coalesce(aa.answered_questions, 0)::int as answered_questions,
      coalesce(aqc.available_questions, 0)::int as available_questions,
      case when coalesce(aa.evaluated_count, 0) > 0 then round(100.0 * coalesce(aa.correct_count, 0) / aa.evaluated_count)::int else 0 end as accuracy_percent,
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
        when coalesce(aa.evaluated_count, 0) >= 3 and (100.0 * coalesce(aa.correct_count, 0) / nullif(aa.evaluated_count, 0)) < 50 then 'needs_help'
        when greatest(aa.last_activity_at, sa.score_activity_at) < now() - interval '14 days' then 'inactive'
        when coalesce(aa.evaluated_count, 0) >= 5 and (100.0 * coalesce(aa.correct_count, 0) / nullif(aa.evaluated_count, 0)) >= 85 then 'excellent'
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
            count(ah.id) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as mistakes,
            case when count(ah.id) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) > 0 then round(100.0 * count(ah.id) filter (where ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) / count(ah.id) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')))::int else 0 end as accuracy_percent
          from public.attempt_history ah
          join scoped_questions q on q.id = ah.question_id
          join public.subjects s on s.id = q.subject_id
          left join public.subject_topics t on t.id = q.topic_id
          where ah.student_id = p.student_id
          group by t.id, t.title, s.id, s.name
          having count(ah.id) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) > 0
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
          'manualReviewStatus', r.manual_review_status,
          'attemptedAt', r.attempted_at,
          'earnedPoints', r.earned_points
        ) order by r.attempted_at desc, r.id desc)
        from (
          select ah.id, q.text as question_text, coalesce(t.title, 'Práctica general') as topic_title,
            s.name as subject_name, ah.is_correct, coalesce(ah.manual_review_status, 'not_required') as manual_review_status, ah.attempted_at, coalesce(ah.earned_points, 0)::int as earned_points
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
            count(ah.id) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes'))::int as mistakes,
            case when count(ah.id) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) > 0 then round(100.0 * count(ah.id) filter (where ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) / count(ah.id) filter (where coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')))::int else 0 end as accuracy_percent
          from public.attempt_history ah
          join scoped_questions q on q.id = ah.question_id
          join public.subjects s on s.id = q.subject_id
          left join public.subject_topics t on t.id = q.topic_id
          where ah.student_id = p.student_id
          group by t.id, t.title, s.id, s.name
          having count(ah.id) filter (where not ah.is_correct and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')) > 0
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
          'manualReviewStatus', r.manual_review_status,
          'attemptedAt', r.attempted_at,
          'earnedPoints', r.earned_points
        ) order by r.attempted_at desc, r.id desc)
        from (
          select ah.id, q.text as question_text, coalesce(t.title, 'Práctica general') as topic_title,
            s.name as subject_name, ah.is_correct, coalesce(ah.manual_review_status, 'not_required') as manual_review_status, ah.attempted_at, coalesce(ah.earned_points, 0)::int as earned_points
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
        'evaluatedAttempts', i.evaluated_count,
        'pendingReviewAttempts', i.pending_review_count,
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

create or replace function public.get_teacher_student_history_summary(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 30), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e
    join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with contexts as (
    select e.id, e.student_id, e.subject_id, e.classroom_id, e.joined_at,
      s.name as subject_name, s.academic_year as subject_year,
      c.name as classroom_name, c.code as classroom_code, c.academic_year as classroom_year
    from public.enrollments e
    join public.subjects s on s.id = e.subject_id and s.teacher_id = v_teacher_id
    left join public.classrooms c on c.id = e.classroom_id
    where e.student_id = p_student_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ),
  scoped_questions as (
    select q.id, q.subject_id, q.classroom_id, q.topic_id, q.type, q.active
    from public.questions q
    where exists (
      select 1 from contexts c
      where c.subject_id = q.subject_id
        and (c.classroom_id is null or q.classroom_id is null or q.classroom_id = c.classroom_id)
    )
  ),
  scoped_attempts as (
    select ah.id, ah.student_id, ah.question_id, ah.is_correct, ah.earned_points, ah.attempted_at,
      coalesce(ah.manual_review_status, 'not_required') as manual_review_status,
      q.subject_id, q.classroom_id, q.topic_id, q.type as question_type, coalesce(q.active, true) as question_active
    from public.attempt_history ah
    join scoped_questions q on q.id = ah.question_id
    where ah.student_id = p_student_id
  ),
  current_period as (
    select * from scoped_attempts where attempted_at >= now() - make_interval(days => v_days)
  ),
  previous_period as (
    select * from scoped_attempts
    where attempted_at >= now() - make_interval(days => v_days * 2)
      and attempted_at < now() - make_interval(days => v_days)
  ),
  weak_topic as (
    select a.subject_id, a.classroom_id, a.topic_id, coalesce(t.title, 'Práctica general') as topic_title,
      count(*)::int as attempts,
      count(*) filter (where not a.is_correct)::int as mistakes,
      case when count(*) > 0 then round(100.0 * count(*) filter (where a.is_correct) / count(*))::int else 0 end as accuracy
    from current_period a
    left join public.subject_topics t on t.id = a.topic_id
    where a.manual_review_status not in ('pending', 'in_review', 'needs_changes')
    group by a.subject_id, a.classroom_id, a.topic_id, t.title
    having count(*) filter (where not a.is_correct) > 0
    order by mistakes desc, accuracy asc, attempts desc
    limit 1
  ),
  metrics as (
    select
      (select count(*)::int from current_period) as current_attempts,
      (select count(*)::int from current_period where manual_review_status not in ('pending', 'in_review', 'needs_changes')) as current_evaluated,
      (select count(*)::int from current_period where manual_review_status not in ('pending', 'in_review', 'needs_changes') and is_correct) as current_correct,
      (select count(*)::int from current_period where manual_review_status in ('pending', 'in_review', 'needs_changes')) as current_pending,
      (select coalesce(sum(coalesce(earned_points, 0)), 0)::int from current_period) as current_xp,
      (select count(*)::int from previous_period) as previous_attempts,
      (select count(*)::int from previous_period where manual_review_status not in ('pending', 'in_review', 'needs_changes')) as previous_evaluated,
      (select count(*)::int from previous_period where manual_review_status not in ('pending', 'in_review', 'needs_changes') and is_correct) as previous_correct,
      (select coalesce(sum(coalesce(earned_points, 0)), 0)::int from previous_period) as previous_xp,
      (select max(attempted_at) from scoped_attempts) as last_activity,
      (select count(*)::int from scoped_attempts where manual_review_status in ('pending', 'in_review', 'needs_changes')) as pending_reviews,
      (select count(distinct question_id)::int from current_period where question_active) as answered_questions,
      (select count(*)::int from scoped_questions where coalesce(active, true)) as available_questions
  )
  select jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'alias', p.alias, 'avatar', p.avatar, 'points', p.points, 'active', p.active, 'createdAt', p.created_at),
    'subjectsCount', (select count(*)::int from public.subjects s where s.teacher_id = v_teacher_id and coalesce(s.active, true) and not coalesce(s.is_archived, false)),
    'courseContexts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'enrollmentId', c.id, 'subjectId', c.subject_id, 'subjectName', c.subject_name,
        'classroomId', c.classroom_id, 'classroomName', coalesce(c.classroom_name, 'Clase principal'),
        'classroomCode', c.classroom_code, 'academicYear', coalesce(c.classroom_year, c.subject_year), 'joinedAt', c.joined_at
      ) order by c.joined_at, c.id) from contexts c
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'periodDays', v_days,
      'attempts', m.current_attempts,
      'evaluatedAttempts', m.current_evaluated,
      'pendingEvaluation', m.current_pending,
      'correct', m.current_correct,
      'accuracyPercent', case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int else null end,
      'earnedXp', m.current_xp,
      'lastActivityAt', m.last_activity,
      'pendingReviews', m.pending_reviews,
      'answeredQuestions', m.answered_questions,
      'availableQuestions', m.available_questions,
      'coveragePercent', case when m.available_questions > 0 then least(100, round(100.0 * m.answered_questions / m.available_questions)::int) else null end
    ),
    'comparison', jsonb_build_object(
      'current', jsonb_build_object(
        'attempts', m.current_attempts,
        'evaluatedAttempts', m.current_evaluated,
        'accuracyPercent', case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int else null end,
        'earnedXp', m.current_xp
      ),
      'previous', jsonb_build_object(
        'attempts', m.previous_attempts,
        'evaluatedAttempts', m.previous_evaluated,
        'accuracyPercent', case when m.previous_evaluated > 0 then round(100.0 * m.previous_correct / m.previous_evaluated)::int else null end,
        'earnedXp', m.previous_xp
      ),
      'delta', jsonb_build_object(
        'attempts', m.current_attempts - m.previous_attempts,
        'accuracyPoints', coalesce(case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int end, 0)
          - coalesce(case when m.previous_evaluated > 0 then round(100.0 * m.previous_correct / m.previous_evaluated)::int end, 0),
        'earnedXp', m.current_xp - m.previous_xp
      )
    ),
    'recommendation', case
      when m.current_attempts = 0 and m.last_activity is null then jsonb_build_object(
        'code', 'start', 'title', 'Ayudarle a empezar',
        'reason', 'No se ha registrado ninguna respuesta en los cursos seleccionados.',
        'actionLabel', 'Enviar recordatorio', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      when m.pending_reviews > 0 then jsonb_build_object(
        'code', 'review', 'title', 'Revisar respuestas pendientes',
        'reason', case when m.pending_reviews = 1 then 'Hay 1 respuesta esperando una decisión docente.' else format('Hay %s respuestas esperando una decisión docente.', m.pending_reviews) end,
        'actionLabel', 'Abrir revisiones', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      when exists (select 1 from weak_topic) then jsonb_build_object(
        'code', 'practice', 'title', 'Reforzar ' || (select topic_title from weak_topic),
        'reason', format('La precisión del tema es %s%% y acumula %s.', (select accuracy from weak_topic),
          case when (select mistakes from weak_topic) = 1 then '1 error' else (select mistakes from weak_topic)::text || ' errores' end),
        'actionLabel', 'Preparar práctica',
        'subjectId', (select subject_id from weak_topic),
        'classroomId', (select classroom_id from weak_topic),
        'topicId', (select topic_id from weak_topic)
      )
      when m.last_activity < now() - interval '14 days' then jsonb_build_object(
        'code', 'reengage', 'title', 'Recuperar la constancia',
        'reason', 'La última actividad supera los 14 días.',
        'actionLabel', 'Enviar recordatorio', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      else jsonb_build_object(
        'code', 'challenge', 'title', 'Proponer un nuevo reto',
        'reason', 'Mantiene una actividad estable y puede avanzar a contenido más exigente.',
        'actionLabel', 'Crear pregunta', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
    end,
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'subjectId', n.subject_id, 'classroomId', n.classroom_id, 'createdAt', n.created_at, 'updatedAt', n.updated_at) order by n.created_at desc, n.id desc)
      from (
        select n.id, n.body, n.subject_id, n.classroom_id, n.created_at, n.updated_at
        from public.teacher_student_notes n
        where n.teacher_id = v_teacher_id and n.student_id = p_student_id
          and (p_subject_id is null or n.subject_id is null or n.subject_id = p_subject_id)
          and (p_classroom_id is null or n.classroom_id is null or n.classroom_id = p_classroom_id)
        order by n.created_at desc, n.id desc limit 5
      ) n
    ), '[]'::jsonb),
    'notesTotal', (
      select count(*)::int from public.teacher_student_notes n
      where n.teacher_id = v_teacher_id and n.student_id = p_student_id
        and (p_subject_id is null or n.subject_id is null or n.subject_id = p_subject_id)
        and (p_classroom_id is null or n.classroom_id is null or n.classroom_id = p_classroom_id)
    )
  ) into v_result
  from public.profiles p cross join metrics m
  where p.id = p_student_id;

  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_weaknesses(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 90), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with rows as (
    select q.subject_id, s.name as subject_name, q.topic_id, coalesce(t.title, 'Práctica general') as topic_title,
      count(ah.id)::int as attempts,
      count(ah.id) filter (where not ah.is_correct)::int as mistakes,
      round(100.0 * count(ah.id) filter (where ah.is_correct) / nullif(count(ah.id), 0))::int as accuracy_percent,
      max(ah.attempted_at) as last_attempt_at
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and ah.attempted_at >= now() - make_interval(days => v_days)
      and coalesce(ah.manual_review_status, 'not_required') not in ('pending', 'in_review', 'needs_changes')
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
    group by q.subject_id, s.name, q.topic_id, t.title
    having count(ah.id) filter (where not ah.is_correct) > 0
    order by mistakes desc, accuracy_percent asc, last_attempt_at desc
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(r) order by r.mistakes desc, r.accuracy_percent asc) from rows r), '[]'::jsonb),
    'periodDays', v_days
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_metrics(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 90), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with attempts as (
    select ah.attempted_at, ah.is_correct, coalesce(ah.earned_points, 0)::int as earned_points,
      coalesce(ah.manual_review_status, 'not_required') as manual_review_status,
      q.subject_id, q.classroom_id, q.topic_id, s.name as subject_name,
      coalesce(t.title, 'Práctica general') as topic_title
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and ah.attempted_at >= now() - make_interval(days => v_days)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
  ), daily as (
    select attempted_at::date as day,
      count(*)::int as attempts,
      count(*) filter (where manual_review_status not in ('pending', 'in_review', 'needs_changes'))::int as evaluated,
      count(*) filter (where manual_review_status in ('pending', 'in_review', 'needs_changes'))::int as pending,
      count(*) filter (where manual_review_status not in ('pending', 'in_review', 'needs_changes') and is_correct)::int as correct,
      coalesce(sum(earned_points), 0)::int as earned_xp
    from attempts group by attempted_at::date order by day
  ), topic_rows as (
    select subject_id, subject_name, topic_id, topic_title,
      count(*)::int as attempts,
      count(*) filter (where manual_review_status not in ('pending', 'in_review', 'needs_changes'))::int as evaluated,
      count(*) filter (where manual_review_status in ('pending', 'in_review', 'needs_changes'))::int as pending,
      count(*) filter (where manual_review_status not in ('pending', 'in_review', 'needs_changes') and is_correct)::int as correct,
      case when count(*) filter (where manual_review_status not in ('pending', 'in_review', 'needs_changes')) > 0
        then round(100.0 * count(*) filter (where manual_review_status not in ('pending', 'in_review', 'needs_changes') and is_correct)
          / count(*) filter (where manual_review_status not in ('pending', 'in_review', 'needs_changes')))::int else null end as accuracy_percent,
      coalesce(sum(earned_points), 0)::int as earned_xp,
      max(attempted_at) as last_activity_at
    from attempts group by subject_id, subject_name, topic_id, topic_title
  )
  select jsonb_build_object(
    'periodDays', v_days,
    'evolution', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.day, 'attempts', d.attempts, 'evaluated', d.evaluated, 'pending', d.pending, 'correct', d.correct,
        'accuracyPercent', case when d.evaluated > 0 then round(100.0 * d.correct / d.evaluated)::int else null end,
        'earnedXp', d.earned_xp
      ) order by d.day) from daily d
    ), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(to_jsonb(t) order by t.last_activity_at desc, t.topic_title) from topic_rows t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;


revoke all on function public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer) from public, anon;
grant execute on function public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer) to authenticated;
revoke all on function public.get_teacher_subject_analytics(bigint,bigint) from public, anon;
grant execute on function public.get_teacher_subject_analytics(bigint,bigint) to authenticated;
revoke all on function public.get_teacher_students_page(bigint,bigint,text,text,text,integer,integer) from public, anon;
grant execute on function public.get_teacher_students_page(bigint,bigint,text,text,text,integer,integer) to authenticated;
revoke all on function public.get_teacher_student_history_summary(uuid,bigint,bigint,integer) from public, anon;
grant execute on function public.get_teacher_student_history_summary(uuid,bigint,bigint,integer) to authenticated;
revoke all on function public.get_teacher_student_history_weaknesses(uuid,bigint,bigint,integer) from public, anon;
grant execute on function public.get_teacher_student_history_weaknesses(uuid,bigint,bigint,integer) to authenticated;
revoke all on function public.get_teacher_student_history_metrics(uuid,bigint,bigint,integer) from public, anon;
grant execute on function public.get_teacher_student_history_metrics(uuid,bigint,bigint,integer) to authenticated;

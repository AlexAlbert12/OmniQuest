-- Teacher topic/question lifecycle hardening:
-- archive is reversible, restore validates parent availability, and hard delete is allowed only without academic history.

create or replace function public.set_teacher_topic_archived(
  p_topic_id bigint,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_topic public.subject_topics%rowtype;
  v_subject_active boolean;
  v_subject_archived boolean;
  v_next_active boolean := not coalesce(p_archived, true);
begin
  if v_teacher_id is null then
    raise exception 'Teacher session required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_teacher_id and role_id = 'teacher' and coalesce(active, true)
  ) then
    raise exception 'Teacher access required';
  end if;

  select t.*
  into v_topic
  from public.subject_topics t
  join public.subjects s on s.id = t.subject_id
  where t.id = p_topic_id and s.teacher_id = v_teacher_id
  for update of t;

  if not found then
    raise exception 'Topic not found or access denied';
  end if;

  select coalesce(s.active, true), coalesce(s.is_archived, false)
  into v_subject_active, v_subject_archived
  from public.subjects s
  where s.id = v_topic.subject_id;

  if v_next_active and (not v_subject_active or v_subject_archived) then
    raise exception 'No se puede restaurar el tema mientras el curso esté archivado o inactivo. Restaura primero el curso.';
  end if;

  if coalesce(v_topic.active, true) is distinct from v_next_active then
    update public.subject_topics set active = v_next_active where id = v_topic.id;

    insert into public.teacher_audit_logs (
      teacher_id, action, target_table, target_id, metadata, before_state, after_state
    ) values (
      v_teacher_id,
      case when v_next_active then 'teacher.topic.restore' else 'teacher.topic.archive' end,
      'subject_topics',
      v_topic.id::text,
      jsonb_build_object('subject_id', v_topic.subject_id, 'classroom_id', v_topic.classroom_id),
      jsonb_build_object('title', v_topic.title, 'active', coalesce(v_topic.active, true)),
      jsonb_build_object('title', v_topic.title, 'active', v_next_active)
    );
  end if;

  -- Deliberately do not mutate questions.active here. Their individual archived state must survive topic archive/restore.
  return jsonb_build_object('id', v_topic.id, 'active', v_next_active);
end;
$$;

revoke all on function public.set_teacher_topic_archived(bigint, boolean) from public, anon;
grant execute on function public.set_teacher_topic_archived(bigint, boolean) to authenticated;

create or replace function public.archive_teacher_topic(p_topic_id bigint)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.set_teacher_topic_archived(p_topic_id, true);
$$;

revoke all on function public.archive_teacher_topic(bigint) from public, anon;
grant execute on function public.archive_teacher_topic(bigint) to authenticated;

create or replace function public.set_teacher_question_archived(
  p_question_id bigint,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_question public.questions%rowtype;
  v_subject_active boolean;
  v_subject_archived boolean;
  v_topic_active boolean;
  v_next_active boolean := not coalesce(p_archived, true);
begin
  if v_teacher_id is null then
    raise exception 'Teacher session required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_teacher_id and role_id = 'teacher' and coalesce(active, true)
  ) then
    raise exception 'Teacher access required';
  end if;

  select q.*
  into v_question
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where q.id = p_question_id and s.teacher_id = v_teacher_id
  for update of q;

  if not found then
    raise exception 'Question not found or access denied';
  end if;

  select coalesce(s.active, true), coalesce(s.is_archived, false)
  into v_subject_active, v_subject_archived
  from public.subjects s
  where s.id = v_question.subject_id;

  if v_question.topic_id is null then
    v_topic_active := true;
  else
    select coalesce(t.active, true) into v_topic_active
    from public.subject_topics t
    where t.id = v_question.topic_id;
    v_topic_active := coalesce(v_topic_active, false);
  end if;

  if v_next_active and (not v_subject_active or v_subject_archived) then
    raise exception 'No se puede restaurar la pregunta mientras el curso esté archivado o inactivo. Restaura primero el curso.';
  end if;

  if v_next_active and v_question.topic_id is not null and not v_topic_active then
    raise exception 'No se puede restaurar la pregunta porque su tema está archivado. Restaura primero el tema.';
  end if;

  if coalesce(v_question.active, true) is distinct from v_next_active then
    update public.questions set active = v_next_active where id = v_question.id;

    insert into public.teacher_audit_logs (
      teacher_id, action, target_table, target_id, metadata, before_state, after_state
    ) values (
      v_teacher_id,
      case when v_next_active then 'teacher.question.restore' else 'teacher.question.archive' end,
      'questions',
      v_question.id::text,
      jsonb_build_object(
        'subject_id', v_question.subject_id,
        'classroom_id', v_question.classroom_id,
        'topic_id', v_question.topic_id,
        'type', v_question.type
      ),
      jsonb_build_object('text', v_question.text, 'type', v_question.type, 'active', coalesce(v_question.active, true)),
      jsonb_build_object('text', v_question.text, 'type', v_question.type, 'active', v_next_active)
    );
  end if;

  return jsonb_build_object('id', v_question.id, 'active', v_next_active);
end;
$$;

revoke all on function public.set_teacher_question_archived(bigint, boolean) from public, anon;
grant execute on function public.set_teacher_question_archived(bigint, boolean) to authenticated;

create or replace function public.archive_teacher_question(p_question_id bigint)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.set_teacher_question_archived(p_question_id, true);
$$;

revoke all on function public.archive_teacher_question(bigint) from public, anon;
grant execute on function public.archive_teacher_question(bigint) to authenticated;

create or replace function public.delete_teacher_question(p_question_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_question public.questions%rowtype;
  v_subject_active boolean;
  v_subject_archived boolean;
  v_attempts bigint;
begin
  if v_teacher_id is null then
    raise exception 'Teacher session required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_teacher_id and role_id = 'teacher' and coalesce(active, true)
  ) then
    raise exception 'Teacher access required';
  end if;

  select q.*
  into v_question
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where q.id = p_question_id and s.teacher_id = v_teacher_id
  for update of q;

  if not found then
    raise exception 'Question not found or access denied';
  end if;

  select coalesce(s.active, true), coalesce(s.is_archived, false)
  into v_subject_active, v_subject_archived
  from public.subjects s
  where s.id = v_question.subject_id;

  if v_subject_archived or not v_subject_active then
    raise exception 'No se puede eliminar contenido mientras el curso esté archivado o inactivo.';
  end if;

  if coalesce(v_question.active, true) then
    raise exception 'Archiva la pregunta antes de eliminarla definitivamente.';
  end if;

  select count(*) into v_attempts from public.attempt_history where question_id = v_question.id;
  if v_attempts > 0 then
    raise exception 'Esta pregunta no se puede eliminar porque ya ha sido utilizada por alumnos y forma parte de su historial. Puedes mantenerla archivada para impedir que vuelva a utilizarse.';
  end if;

  insert into public.teacher_audit_logs (
    teacher_id, action, target_table, target_id, metadata, before_state, after_state
  ) values (
    v_teacher_id,
    'teacher.question.delete',
    'questions',
    v_question.id::text,
    jsonb_build_object('subject_id', v_question.subject_id, 'classroom_id', v_question.classroom_id, 'topic_id', v_question.topic_id),
    jsonb_build_object('id', v_question.id, 'text', v_question.text, 'type', v_question.type, 'active', coalesce(v_question.active, true)),
    '{}'::jsonb
  );

  update public.question_media_assets
  set attached_question_id = null,
      orphaned_at = coalesce(orphaned_at, now())
  where attached_question_id = v_question.id;

  delete from public.answers where question_id = v_question.id;
  delete from public.questions where id = v_question.id;

  return jsonb_build_object('id', v_question.id, 'deleted', true);
end;
$$;

revoke all on function public.delete_teacher_question(bigint) from public, anon;
grant execute on function public.delete_teacher_question(bigint) to authenticated;

create or replace function public.delete_teacher_topic(p_topic_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_topic public.subject_topics%rowtype;
  v_subject_active boolean;
  v_subject_archived boolean;
  v_question_count integer;
  v_attempts bigint;
  v_game_attempts bigint;
  v_topic_scores bigint;
  v_learning_tasks bigint;
begin
  if v_teacher_id is null then
    raise exception 'Teacher session required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_teacher_id and role_id = 'teacher' and coalesce(active, true)
  ) then
    raise exception 'Teacher access required';
  end if;

  select t.*
  into v_topic
  from public.subject_topics t
  join public.subjects s on s.id = t.subject_id
  where t.id = p_topic_id and s.teacher_id = v_teacher_id
  for update of t;

  if not found then
    raise exception 'Topic not found or access denied';
  end if;

  select coalesce(s.active, true), coalesce(s.is_archived, false)
  into v_subject_active, v_subject_archived
  from public.subjects s
  where s.id = v_topic.subject_id;

  if v_subject_archived or not v_subject_active then
    raise exception 'No se puede eliminar contenido mientras el curso esté archivado o inactivo.';
  end if;

  if coalesce(v_topic.active, true) then
    raise exception 'Archiva el tema antes de eliminarlo definitivamente.';
  end if;

  select count(*)::integer into v_question_count from public.questions where topic_id = v_topic.id;
  select count(*) into v_attempts
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  where q.topic_id = v_topic.id;
  select count(*) into v_game_attempts from public.game_attempts where topic_id = v_topic.id;
  select count(*) into v_topic_scores from public.topic_scores where topic_id = v_topic.id;
  select count(*) into v_learning_tasks from public.learning_tasks where topic_id = v_topic.id;

  if v_attempts > 0 or v_game_attempts > 0 or v_topic_scores > 0 then
    raise exception 'Este tema no se puede eliminar porque contiene preguntas o progreso que ya forman parte del historial del alumnado. Para conservar su historial debe permanecer archivado.';
  end if;

  if v_learning_tasks > 0 then
    raise exception 'Este tema no se puede eliminar porque tiene tareas docentes asociadas. Retira esas tareas antes de eliminarlo definitivamente.';
  end if;

  insert into public.teacher_audit_logs (
    teacher_id, action, target_table, target_id, metadata, before_state, after_state
  ) values (
    v_teacher_id,
    'teacher.topic.delete',
    'subject_topics',
    v_topic.id::text,
    jsonb_build_object('subject_id', v_topic.subject_id, 'classroom_id', v_topic.classroom_id),
    jsonb_build_object('id', v_topic.id, 'title', v_topic.title, 'active', coalesce(v_topic.active, true), 'question_count', v_question_count),
    '{}'::jsonb
  );

  update public.question_media_assets a
  set attached_question_id = null,
      orphaned_at = coalesce(a.orphaned_at, now())
  where a.attached_question_id in (select q.id from public.questions q where q.topic_id = v_topic.id);

  delete from public.answers a
  using public.questions q
  where a.question_id = q.id and q.topic_id = v_topic.id;

  delete from public.questions where topic_id = v_topic.id;
  delete from public.subject_topics where id = v_topic.id;

  return jsonb_build_object('id', v_topic.id, 'deleted', true, 'deletedQuestions', v_question_count);
end;
$$;

revoke all on function public.delete_teacher_topic(bigint) from public, anon;
grant execute on function public.delete_teacher_topic(bigint) to authenticated;

-- Replace the subject topic page RPC with a final optional visibility parameter while preserving positional compatibility.
drop function if exists public.get_teacher_subject_topics_page(bigint, bigint, integer, integer);
create function public.get_teacher_subject_topics_page(
  p_subject_id bigint,
  p_classroom_id bigint,
  p_limit integer default 50,
  p_offset integer default 0,
  p_visibility text default 'active'
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
  v_visibility text := lower(trim(coalesce(p_visibility, 'active')));
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  if v_visibility not in ('active', 'archived') then
    raise exception 'Invalid topic visibility';
  end if;

  if not exists (
    select 1 from public.classrooms c where c.id = p_classroom_id and c.subject_id = p_subject_id and coalesce(c.active, true)
  ) then
    raise exception 'Classroom not found';
  end if;

  with topic_rows as (
    select
      t.id::text as row_id,
      t.id,
      t.title,
      t.description,
      t.icon,
      t.sort_order,
      t.available_until,
      coalesce(t.active, true) as active,
      case when v_visibility = 'archived'
        then count(distinct q.id)::int
        else count(distinct q.id) filter (where coalesce(q.active, true))::int
      end as questions_count,
      count(distinct ts.student_id)::int as played_count,
      coalesce(round(avg(coalesce(ts.max_score, 0))), 0)::int as average_score,
      t.created_at
    from public.subject_topics t
    left join public.questions q on q.topic_id = t.id and q.classroom_id = p_classroom_id
    left join public.topic_scores ts on ts.topic_id = t.id and ts.classroom_id = p_classroom_id
    where t.subject_id = p_subject_id
      and t.classroom_id = p_classroom_id
      and ((v_visibility = 'active' and coalesce(t.active, true)) or (v_visibility = 'archived' and not coalesce(t.active, true)))
    group by t.id, t.title, t.description, t.icon, t.sort_order, t.available_until, t.active, t.created_at

    union all

    select
      'general'::text as row_id,
      null::bigint as id,
      'Tema general'::text as title,
      'Preguntas todavía no organizadas en un tema.'::text as description,
      'layers-outline'::text as icon,
      0::int as sort_order,
      null::timestamptz as available_until,
      true as active,
      count(distinct q.id)::int as questions_count,
      count(distinct ah.student_id)::int as played_count,
      coalesce(round(avg(coalesce(ah.earned_points, 0))), 0)::int as average_score,
      min(q.created_at) as created_at
    from public.questions q
    left join public.attempt_history ah on ah.question_id = q.id
    where v_visibility = 'active'
      and q.subject_id = p_subject_id
      and q.classroom_id = p_classroom_id
      and q.topic_id is null
      and coalesce(q.active, true)
    having count(q.id) > 0
  ),
  page_rows as (
    select * from topic_rows order by sort_order asc, created_at asc nulls last, row_id asc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', case when row_id = 'general' then to_jsonb('general'::text) else to_jsonb(id) end,
        'title', title,
        'description', description,
        'icon', icon,
        'sortOrder', sort_order,
        'availableUntil', available_until,
        'active', active,
        'questionsCount', questions_count,
        'playedCount', played_count,
        'averageScore', average_score
      ) order by sort_order asc, created_at asc nulls last, row_id asc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from topic_rows),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_subject_topics_page(bigint, bigint, integer, integer, text) from public, anon;
grant execute on function public.get_teacher_subject_topics_page(bigint, bigint, integer, integer, text) to authenticated;

-- Replace the subject question page RPC with an optional visibility parameter and include active in the payload.
drop function if exists public.get_teacher_subject_questions_page(bigint, bigint, bigint, boolean, integer, text, integer, integer);
create function public.get_teacher_subject_questions_page(
  p_subject_id bigint,
  p_classroom_id bigint,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_visibility text default 'visible'
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
  v_visibility text := lower(trim(coalesce(p_visibility, 'visible')));
  v_result jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.subjects s where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Course not found';
  end if;

  if v_visibility not in ('all', 'visible', 'archived') then
    raise exception 'Invalid question visibility';
  end if;

  with rows as (
    select
      q.id, q.text, q.type, q.points_base, q.time_limit_seconds, q.difficulty,
      q.explanation, q.topic_id, q.classroom_id, q.created_at, q.updated_at,
      q.media_type, q.media_path, q.media_alt_text, q.media_caption,
      coalesce(q.active, true) as active,
      t.title as topic_title,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'text', a.text,
          'is_correct', a.is_correct,
          'sort_order', a.sort_order
        ) order by a.sort_order asc, a.id asc)
        from public.answers a where a.question_id = q.id
      ), '[]'::jsonb) as answers
    from public.questions q
    left join public.subject_topics t on t.id = q.topic_id
    where q.subject_id = p_subject_id
      and q.classroom_id = p_classroom_id
      and (v_visibility = 'all'
        or (v_visibility = 'visible' and coalesce(q.active, true) and (q.topic_id is null or coalesce(t.active, true)))
        or (v_visibility = 'archived' and not coalesce(q.active, true)))
      and (p_topic_id is null or q.topic_id = p_topic_id)
      and (not p_general_topic or q.topic_id is null)
      and (p_difficulty is null or q.difficulty = p_difficulty)
      and (v_search is null or concat_ws(' ', q.text, q.explanation, t.title, q.type) ilike '%' || v_search || '%')
  ),
  page_rows as (
    select * from rows order by created_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'text', text,
        'type', type,
        'points_base', points_base,
        'time_limit_seconds', time_limit_seconds,
        'difficulty', difficulty,
        'explanation', explanation,
        'topic_id', topic_id,
        'classroom_id', classroom_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'media_type', media_type,
        'media_path', media_path,
        'media_alt_text', media_alt_text,
        'media_caption', media_caption,
        'active', active,
        'topicTitle', topic_title,
        'answers', answers
      ) order by created_at desc, id desc)
      from page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::int from rows),
    'limit', v_limit,
    'offset', v_offset
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_subject_questions_page(bigint, bigint, bigint, boolean, integer, text, integer, integer, text) from public, anon;
grant execute on function public.get_teacher_subject_questions_page(bigint, bigint, bigint, boolean, integer, text, integer, integer, text) to authenticated;

-- A question inside an archived topic must never be playable, even when the caller requests the whole classroom.
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
  ) then
    raise exception 'Este curso no está disponible para jugar.';
  end if;

  if p_topic_id is not null then perform public.assert_topic_playable(p_topic_id); end if;

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
          select 1 from public.enrollments e
          where e.student_id = v_user_id and e.subject_id = p_subject_id
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
      'blank_count', case when q.type = 'fill_blank' then (
        select count(*) from public.answers a
        where a.question_id = q.id and coalesce(a.is_correct, true) and public.normalize_answer_text(a.text) <> ''
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
        from (
          select split_part(a.text, '|||', 2) as pair_right
          from public.answers a
          where a.question_id = q.id and split_part(a.text, '|||', 2) <> ''
        ) pairs
      ) else '[]'::jsonb end
    ) as question_payload
    from public.questions q
    left join public.subject_topics st on st.id = q.topic_id
    where q.subject_id = p_subject_id
      and q.classroom_id = v_classroom_id
      and coalesce(q.active, true)
      and (q.topic_id is null or coalesce(st.active, true))
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
            select distinct on (ah.question_id) ah.question_id, ah.is_correct
            from public.attempt_history ah
            where ah.student_id = v_user_id
            order by ah.question_id, ah.attempted_at desc, ah.id desc
          ) latest
          where latest.question_id = q.id and latest.is_correct = false
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
  if v_user_id is null then raise exception 'No authenticated user'; end if;

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
    q.id, q.subject_id, q.classroom_id, q.topic_id
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    left join public.subject_topics st on st.id = q.topic_id
    where coalesce(q.active, true)
      and (q.topic_id is null or coalesce(st.active, true))
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
      and (
        public.is_admin()
        or s.teacher_id = v_user_id
        or (
          s.active is true
          and coalesce(s.is_archived, false) is false
          and exists (
            select 1 from public.enrollments e
            where e.student_id = v_user_id and e.subject_id = q.subject_id
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

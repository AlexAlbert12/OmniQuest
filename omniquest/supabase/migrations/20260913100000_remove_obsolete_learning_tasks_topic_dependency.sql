-- learning_tasks was removed in 20260721140000_remove_learning_tasks.sql.
-- Keep permanent topic deletion atomic without referencing that retired table.

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

  if v_attempts > 0 or v_game_attempts > 0 or v_topic_scores > 0 then
    raise exception 'Este tema no se puede eliminar porque contiene preguntas o progreso que ya forman parte del historial del alumnado. Para conservar su historial debe permanecer archivado.';
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

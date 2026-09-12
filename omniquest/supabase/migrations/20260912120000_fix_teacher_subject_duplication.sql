create or replace function public.duplicate_teacher_subject(
  p_subject_id bigint,
  p_name_suffix text default ' (Copia)'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_source public.subjects%rowtype;
  v_new_subject_id bigint;
  v_new_code text;
  v_classroom record;
  v_topic record;
  v_question record;
  v_new_classroom_id bigint;
  v_new_topic_id bigint;
  v_new_question_id bigint;
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  select *
  into v_source
  from public.subjects
  where id = p_subject_id
    and teacher_id = v_teacher_id;

  if not found then
    raise exception 'No puedes duplicar este curso.';
  end if;

  -- Legacy courses may not have a classroom yet. Normalize the source before
  -- building the ID maps so every copied topic and question has a target.
  perform public.ensure_default_classroom(p_subject_id);

  v_new_code := public.generate_unique_subject_code();

  insert into public.subjects (
    name,
    description,
    icon,
    code,
    education_level,
    academic_year,
    subject_label,
    teacher_id,
    theme_color,
    active,
    is_archived
  )
  values (
    v_source.name || coalesce(p_name_suffix, ' (Copia)'),
    v_source.description,
    v_source.icon,
    v_new_code,
    v_source.education_level,
    v_source.academic_year,
    v_source.subject_label,
    v_teacher_id,
    v_source.theme_color,
    true,
    false
  )
  returning id into v_new_subject_id;

  -- CREATE TEMPORARY TABLE must not use a schema-qualified name. PostgreSQL
  -- creates these relations in pg_temp automatically; qualifying CREATE with
  -- pg_temp makes the RPC fail at runtime.
  create temporary table if not exists omniquest_duplicate_classroom_map (
    source_id bigint primary key,
    target_id bigint not null
  ) on commit drop;

  create temporary table if not exists omniquest_duplicate_topic_map (
    source_id bigint primary key,
    target_id bigint not null
  ) on commit drop;

  create temporary table if not exists omniquest_duplicate_question_map (
    source_id bigint primary key,
    target_id bigint not null
  ) on commit drop;

  delete from pg_temp.omniquest_duplicate_classroom_map;
  delete from pg_temp.omniquest_duplicate_topic_map;
  delete from pg_temp.omniquest_duplicate_question_map;

  for v_classroom in
    select id, name, academic_year, active
    from public.classrooms
    where subject_id = p_subject_id
    order by created_at, id
  loop
    insert into public.classrooms (
      subject_id,
      name,
      academic_year,
      code,
      active
    )
    values (
      v_new_subject_id,
      v_classroom.name,
      v_classroom.academic_year,
      public.generate_unique_subject_code(),
      coalesce(v_classroom.active, true)
    )
    returning id into v_new_classroom_id;

    insert into pg_temp.omniquest_duplicate_classroom_map (source_id, target_id)
    values (v_classroom.id, v_new_classroom_id);
  end loop;

  for v_topic in
    select id, classroom_id, title, description, icon, sort_order, active, available_until
    from public.subject_topics
    where subject_id = p_subject_id
    order by classroom_id, sort_order nulls last, created_at, id
  loop
    insert into public.subject_topics (
      subject_id,
      classroom_id,
      title,
      description,
      icon,
      sort_order,
      active,
      available_until
    )
    values (
      v_new_subject_id,
      (select target_id from pg_temp.omniquest_duplicate_classroom_map where source_id = v_topic.classroom_id),
      v_topic.title,
      v_topic.description,
      v_topic.icon,
      v_topic.sort_order,
      v_topic.active,
      v_topic.available_until
    )
    returning id into v_new_topic_id;

    insert into pg_temp.omniquest_duplicate_topic_map (source_id, target_id)
    values (v_topic.id, v_new_topic_id);
  end loop;

  for v_question in
    select
      id,
      classroom_id,
      type,
      text,
      points_base,
      time_limit_seconds,
      topic_id,
      difficulty,
      explanation,
      hint,
      active
    from public.questions
    where subject_id = p_subject_id
    order by classroom_id, created_at, id
  loop
    insert into public.questions (
      subject_id,
      classroom_id,
      topic_id,
      type,
      text,
      points_base,
      time_limit_seconds,
      difficulty,
      explanation,
      hint,
      active
    )
    values (
      v_new_subject_id,
      (select target_id from pg_temp.omniquest_duplicate_classroom_map where source_id = v_question.classroom_id),
      (select target_id from pg_temp.omniquest_duplicate_topic_map where source_id = v_question.topic_id),
      v_question.type,
      v_question.text,
      v_question.points_base,
      v_question.time_limit_seconds,
      v_question.difficulty,
      v_question.explanation,
      v_question.hint,
      v_question.active
    )
    returning id into v_new_question_id;

    insert into pg_temp.omniquest_duplicate_question_map (source_id, target_id)
    values (v_question.id, v_new_question_id);
  end loop;

  insert into public.answers (question_id, text, is_correct, sort_order)
  select question_map.target_id, answer.text, answer.is_correct, answer.sort_order
  from public.answers answer
  join pg_temp.omniquest_duplicate_question_map question_map
    on question_map.source_id = answer.question_id
  order by answer.question_id, answer.sort_order nulls last, answer.id;

  return jsonb_build_object('id', v_new_subject_id, 'code', v_new_code);
end;
$$;

revoke all on function public.duplicate_teacher_subject(bigint, text) from public, anon;
grant execute on function public.duplicate_teacher_subject(bigint, text) to authenticated, service_role;

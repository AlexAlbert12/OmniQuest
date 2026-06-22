create or replace function public.generate_unique_subject_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
begin
  for attempt in 1..50 loop
    v_code := '';
    for index in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;

    if not exists (select 1 from public.subjects where code = v_code) then
      return v_code;
    end if;
  end loop;

  raise exception 'No se pudo generar un código único. Inténtalo de nuevo.';
end;
$$;

create or replace function public.create_subject_with_default_topic(
  p_name text,
  p_description text default null,
  p_icon text default null,
  p_code text default null,
  p_education_level text default null,
  p_academic_year text default null,
  p_subject_label text default null,
  p_theme_color text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_subject_id bigint;
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'El nombre de la asignatura es obligatorio.';
  end if;

  if v_code = '' then
    v_code := public.generate_unique_subject_code();
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'El código de invitación no es válido.';
  end if;

  insert into public.subjects (
    name,
    description,
    icon,
    code,
    education_level,
    academic_year,
    subject_label,
    theme_color,
    teacher_id
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_icon,
    v_code,
    p_education_level,
    p_academic_year,
    nullif(trim(coalesce(p_subject_label, '')), ''),
    p_theme_color,
    v_teacher_id
  )
  returning id into v_subject_id;

  insert into public.subject_topics (
    subject_id,
    title,
    description,
    icon,
    sort_order
  )
  values (
    v_subject_id,
    'Tema 1',
    'Primer tema de la clase',
    '📘',
    1
  );

  return jsonb_build_object('id', v_subject_id, 'code', v_code);
exception
  when unique_violation then
    raise exception 'Ese código de invitación ya existe. Elige otro o genera uno nuevo.';
end;
$$;

create or replace function public.save_teacher_question(
  p_subject_id bigint,
  p_question_id bigint default null,
  p_topic_id bigint default null,
  p_type text default 'multiple_choice',
  p_text text default '',
  p_points_base integer default 10,
  p_time_limit_seconds integer default 30,
  p_explanation text default null,
  p_answers jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_question_id bigint;
  v_answer jsonb;
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if not exists (
    select 1
    from public.subjects
    where id = p_subject_id
      and teacher_id = v_teacher_id
  ) then
    raise exception 'No puedes modificar preguntas de esta clase.';
  end if;

  if p_topic_id is not null and not exists (
    select 1
    from public.subject_topics
    where id = p_topic_id
      and subject_id = p_subject_id
  ) then
    raise exception 'El tema seleccionado no pertenece a esta clase.';
  end if;

  if p_points_base < 1 or p_points_base > 100 then
    raise exception 'Los puntos deben estar entre 1 y 100.';
  end if;

  if p_time_limit_seconds < 5 or p_time_limit_seconds > 300 then
    raise exception 'El tiempo debe estar entre 5 y 300 segundos.';
  end if;

  if nullif(trim(p_text), '') is null then
    raise exception 'El enunciado de la pregunta es obligatorio.';
  end if;

  if p_question_id is null then
    insert into public.questions (
      subject_id,
      topic_id,
      type,
      text,
      points_base,
      time_limit_seconds,
      explanation
    )
    values (
      p_subject_id,
      p_topic_id,
      p_type,
      trim(p_text),
      p_points_base,
      p_time_limit_seconds,
      nullif(trim(coalesce(p_explanation, '')), '')
    )
    returning id into v_question_id;
  else
    update public.questions
    set
      subject_id = p_subject_id,
      topic_id = p_topic_id,
      type = p_type,
      text = trim(p_text),
      points_base = p_points_base,
      time_limit_seconds = p_time_limit_seconds,
      explanation = nullif(trim(coalesce(p_explanation, '')), '')
    where id = p_question_id
      and subject_id = p_subject_id
    returning id into v_question_id;

    if v_question_id is null then
      raise exception 'No se encontró la pregunta a editar.';
    end if;

    delete from public.answers
    where question_id = v_question_id;
  end if;

  if jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) = 0 then
    raise exception 'La pregunta necesita al menos una respuesta.';
  end if;

  for v_answer in
    select value from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  loop
    if nullif(trim(coalesce(v_answer->>'text', '')), '') is null then
      raise exception 'Hay una respuesta vacía.';
    end if;

    insert into public.answers (
      question_id,
      text,
      is_correct,
      sort_order
    )
    values (
      v_question_id,
      trim(v_answer->>'text'),
      coalesce((v_answer->>'is_correct')::boolean, false),
      coalesce((v_answer->>'sort_order')::integer, 1)
    );
  end loop;

  return v_question_id;
end;
$$;

create or replace function public.duplicate_teacher_subject(
  p_subject_id bigint,
  p_name_suffix text default ' (Copia)'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_source public.subjects%rowtype;
  v_new_subject_id bigint;
  v_new_code text;
  v_topic record;
  v_question record;
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
    raise exception 'No puedes duplicar esta clase.';
  end if;

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
    false
  )
  returning id into v_new_subject_id;

  create temporary table if not exists pg_temp.topic_id_map (
    source_id bigint primary key,
    target_id bigint not null
  ) on commit drop;

  create temporary table if not exists pg_temp.question_id_map (
    source_id bigint primary key,
    target_id bigint not null
  ) on commit drop;

  delete from pg_temp.topic_id_map;
  delete from pg_temp.question_id_map;

  for v_topic in
    select id, title, description, icon, sort_order, active
    from public.subject_topics
    where subject_id = p_subject_id
    order by sort_order nulls last, created_at, id
  loop
    insert into public.subject_topics (
      subject_id,
      title,
      description,
      icon,
      sort_order,
      active
    )
    values (
      v_new_subject_id,
      v_topic.title,
      v_topic.description,
      v_topic.icon,
      v_topic.sort_order,
      v_topic.active
    )
    returning id into v_new_topic_id;

    insert into pg_temp.topic_id_map (source_id, target_id)
    values (v_topic.id, v_new_topic_id);
  end loop;

  for v_question in
    select id, type, text, points_base, time_limit_seconds, topic_id, difficulty, explanation, active
    from public.questions
    where subject_id = p_subject_id
    order by created_at, id
  loop
    insert into public.questions (
      subject_id,
      topic_id,
      type,
      text,
      points_base,
      time_limit_seconds,
      difficulty,
      explanation,
      active
    )
    values (
      v_new_subject_id,
      (select target_id from pg_temp.topic_id_map where source_id = v_question.topic_id),
      v_question.type,
      v_question.text,
      v_question.points_base,
      v_question.time_limit_seconds,
      v_question.difficulty,
      v_question.explanation,
      v_question.active
    )
    returning id into v_new_question_id;

    insert into pg_temp.question_id_map (source_id, target_id)
    values (v_question.id, v_new_question_id);
  end loop;

  insert into public.answers (
    question_id,
    text,
    is_correct,
    sort_order
  )
  select
    question_id_map.target_id,
    answers.text,
    answers.is_correct,
    answers.sort_order
  from public.answers
  join pg_temp.question_id_map
    on question_id_map.source_id = answers.question_id
  order by answers.question_id, answers.sort_order nulls last, answers.id;

  return jsonb_build_object('id', v_new_subject_id, 'code', v_new_code);
end;
$$;

create or replace function public.delete_user_relational_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar text;
  v_subject_ids bigint[];
  v_question_ids bigint[];
begin
  select avatar
  into v_avatar
  from public.profiles
  where id = p_user_id;

  select coalesce(array_agg(id), '{}')
  into v_subject_ids
  from public.subjects
  where teacher_id = p_user_id;

  select coalesce(array_agg(id), '{}')
  into v_question_ids
  from public.questions
  where subject_id = any(v_subject_ids);

  delete from public.attempt_history where question_id = any(v_question_ids);
  delete from public.answers where question_id = any(v_question_ids);
  delete from public.game_attempts where subject_id = any(v_subject_ids);
  delete from public.topic_scores where subject_id = any(v_subject_ids);
  delete from public.subject_scores where subject_id = any(v_subject_ids);
  delete from public.enrollments where subject_id = any(v_subject_ids);
  delete from public.questions where id = any(v_question_ids);
  delete from public.classrooms where subject_id = any(v_subject_ids);
  delete from public.subject_topics where subject_id = any(v_subject_ids);
  delete from public.subjects where id = any(v_subject_ids);

  delete from public.attempt_history where student_id = p_user_id;
  delete from public.game_attempts where student_id = p_user_id;
  delete from public.topic_scores where student_id = p_user_id;
  delete from public.subject_scores where student_id = p_user_id;
  delete from public.enrollments where student_id = p_user_id;
  delete from public.student_badges where student_id = p_user_id;
  delete from public.notification_state where user_id = p_user_id;
  delete from public.user_preferences where user_id = p_user_id;
  delete from public.user_notification_preferences where user_id = p_user_id;
  delete from public.user_support_tickets where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;

  return jsonb_build_object('avatar', v_avatar);
end;
$$;

grant execute on function public.generate_unique_subject_code() to authenticated;
grant execute on function public.create_subject_with_default_topic(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.save_teacher_question(bigint, bigint, bigint, text, text, integer, integer, text, jsonb) to authenticated;
grant execute on function public.duplicate_teacher_subject(bigint, text) to authenticated;
grant execute on function public.delete_user_relational_data(uuid) to service_role;

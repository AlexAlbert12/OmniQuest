alter table public.questions
  add column if not exists difficulty integer default 1;

update public.questions
set difficulty = 1
where difficulty is null;

alter table public.questions
  drop constraint if exists questions_difficulty_check;

alter table public.questions
  add constraint questions_difficulty_check check (difficulty in (1, 2, 3));

create index if not exists questions_topic_difficulty_idx
  on public.questions(subject_id, classroom_id, topic_id, difficulty)
  where coalesce(active, true);

drop function if exists public.save_teacher_question(bigint, bigint, bigint, bigint, text, text, integer, integer, text, jsonb);
create or replace function public.save_teacher_question(
  p_subject_id bigint,
  p_question_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_type text default 'multiple_choice',
  p_text text default '',
  p_points_base integer default 10,
  p_time_limit_seconds integer default 30,
  p_difficulty integer default 1,
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
  v_classroom_id bigint;
  v_difficulty integer := coalesce(p_difficulty, 1);
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
    raise exception 'No puedes modificar preguntas de este curso.';
  end if;

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1
    from public.classrooms
    where id = v_classroom_id
      and subject_id = p_subject_id
      and coalesce(active, true)
  ) then
    raise exception 'La clase seleccionada no pertenece a este curso.';
  end if;

  if p_topic_id is not null and not exists (
    select 1
    from public.subject_topics
    where id = p_topic_id
      and subject_id = p_subject_id
      and classroom_id = v_classroom_id
      and coalesce(active, true)
  ) then
    raise exception 'El tema seleccionado no pertenece a esta clase.';
  end if;

  if p_points_base < 1 or p_points_base > 100 then
    raise exception 'Los puntos deben estar entre 1 y 100.';
  end if;

  if p_time_limit_seconds < 5 or p_time_limit_seconds > 300 then
    raise exception 'El tiempo debe estar entre 5 y 300 segundos.';
  end if;

  if v_difficulty not in (1, 2, 3) then
    raise exception 'La dificultad debe ser fácil, medio o difícil.';
  end if;

  if nullif(trim(p_text), '') is null then
    raise exception 'El enunciado de la pregunta es obligatorio.';
  end if;

  if p_question_id is null then
    insert into public.questions (
      subject_id, classroom_id, topic_id, type, text, points_base, time_limit_seconds, difficulty, explanation
    )
    values (
      p_subject_id, v_classroom_id, p_topic_id, p_type, trim(p_text), p_points_base, p_time_limit_seconds, v_difficulty,
      nullif(trim(coalesce(p_explanation, '')), '')
    )
    returning id into v_question_id;
  else
    update public.questions
    set
      subject_id = p_subject_id,
      classroom_id = v_classroom_id,
      topic_id = p_topic_id,
      type = p_type,
      text = trim(p_text),
      points_base = p_points_base,
      time_limit_seconds = p_time_limit_seconds,
      difficulty = v_difficulty,
      explanation = nullif(trim(coalesce(p_explanation, '')), '')
    where id = p_question_id
      and subject_id = p_subject_id
      and exists (
        select 1 from public.subjects
        where subjects.id = questions.subject_id
          and subjects.teacher_id = v_teacher_id
      )
    returning id into v_question_id;

    if v_question_id is null then
      raise exception 'No se encontró la pregunta a editar.';
    end if;

    delete from public.answers where question_id = v_question_id;
  end if;

  if jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) = 0 then
    raise exception 'La pregunta necesita al menos una respuesta.';
  end if;

  for v_answer in select value from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) loop
    if nullif(trim(coalesce(v_answer->>'text', '')), '') is null then
      raise exception 'Hay una respuesta vacía.';
    end if;

    insert into public.answers (question_id, text, is_correct, sort_order)
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

drop function if exists public.start_game_attempt(bigint, bigint, bigint, boolean);
create or replace function public.start_game_attempt(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
  v_classroom_id bigint;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_difficulty is not null and p_difficulty not in (1, 2, 3) then
    raise exception 'Invalid difficulty';
  end if;

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1 from public.classrooms
    where id = v_classroom_id
      and subject_id = p_subject_id
      and coalesce(active, true)
  ) then
    raise exception 'Classroom does not belong to this subject';
  end if;

  if not exists (
    select 1
    from public.enrollments
    where student_id = v_user_id
      and classroom_id = v_classroom_id
  ) then
    raise exception 'Student is not enrolled in this classroom';
  end if;

  if p_topic_id is not null and not exists (
    select 1
    from public.subject_topics
    where id = p_topic_id
      and subject_id = p_subject_id
      and classroom_id = v_classroom_id
      and coalesce(active, true)
  ) then
    raise exception 'Topic does not belong to this classroom';
  end if;

  insert into public.game_attempts (student_id, subject_id, classroom_id, topic_id)
  values (v_user_id, p_subject_id, v_classroom_id, case when p_general_topic then null else p_topic_id end)
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

drop function if exists public.get_game_questions(bigint, bigint, bigint, boolean);
create or replace function public.get_game_questions(
  p_subject_id bigint,
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
        or exists (
          select 1
          from public.enrollments e
          where e.classroom_id = c.id
            and e.student_id = v_user_id
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
    where q.subject_id = p_subject_id
      and q.classroom_id = v_classroom_id
      and coalesce(q.active, true)
      and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
      and (
        (p_general_topic and q.topic_id is null)
        or (not p_general_topic and p_topic_id is null)
        or (not p_general_topic and p_topic_id is not null and q.topic_id = p_topic_id)
      )
  ) safe_questions;

  return v_result;
end;
$$;

grant execute on function public.save_teacher_question(bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb) to authenticated;
grant execute on function public.start_game_attempt(bigint, bigint, bigint, boolean, integer) to authenticated;
grant execute on function public.get_game_questions(bigint, bigint, bigint, boolean, integer) to authenticated;

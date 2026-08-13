alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check
  check (type in ('multiple_choice', 'true_false', 'open_answer', 'fill_blank', 'ordering', 'match_pairs', 'drag_drop')) not valid;

alter table public.questions drop constraint if exists questions_text_length_check;
alter table public.questions add constraint questions_text_length_check
  check (char_length(text) between 1 and 2000) not valid;

alter table public.questions drop constraint if exists questions_explanation_length_check;
alter table public.questions add constraint questions_explanation_length_check
  check (explanation is null or char_length(explanation) <= 4000) not valid;

alter table public.questions drop constraint if exists questions_media_alt_length_check;
alter table public.questions add constraint questions_media_alt_length_check
  check (media_alt_text is null or char_length(media_alt_text) <= 300) not valid;

alter table public.questions drop constraint if exists questions_media_caption_length_check;
alter table public.questions add constraint questions_media_caption_length_check
  check (media_caption is null or char_length(media_caption) <= 300) not valid;

alter table public.answers drop constraint if exists answers_text_length_check;
alter table public.answers add constraint answers_text_length_check
  check (char_length(text) between 1 and 2000) not valid;

create or replace function public.save_teacher_question_v2(
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
  p_hint text default null,
  p_answers jsonb default '[]'::jsonb,
  p_media_type text default null,
  p_media_url text default null,
  p_media_path text default null,
  p_media_alt_text text default null,
  p_media_caption text default null,
  p_media_duration_seconds numeric default null,
  p_media_transcript text default null,
  p_media_subtitles_vtt text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_active boolean;
  v_question_id bigint;
  v_hint text := nullif(trim(coalesce(p_hint, '')), '');
  v_answer_count integer := 0;
  v_correct_count integer := 0;
  v_blank_count integer := 0;
  v_invalid_answer_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  select role_id, coalesce(active, true)
  into v_role, v_active
  from public.profiles
  where id = v_user_id;

  if v_role is null or not v_active or v_role not in ('teacher', 'admin') then
    raise exception 'Tu perfil no tiene permisos activos para guardar preguntas.';
  end if;

  if p_type not in ('multiple_choice', 'true_false', 'open_answer', 'fill_blank', 'ordering', 'match_pairs', 'drag_drop') then
    raise exception 'El tipo de pregunta no es válido.';
  end if;

  if nullif(trim(coalesce(p_text, '')), '') is null then
    raise exception 'El enunciado de la pregunta es obligatorio.';
  end if;
  if char_length(trim(p_text)) > 2000 then
    raise exception 'El enunciado no puede superar 2000 caracteres.';
  end if;
  if p_explanation is not null and char_length(p_explanation) > 4000 then
    raise exception 'La explicación no puede superar 4000 caracteres.';
  end if;
  if v_hint is not null and char_length(v_hint) > 280 then
    raise exception 'La pista no puede superar 280 caracteres.';
  end if;
  if p_media_alt_text is not null and char_length(p_media_alt_text) > 300 then
    raise exception 'El texto alternativo no puede superar 300 caracteres.';
  end if;
  if p_media_caption is not null and char_length(p_media_caption) > 300 then
    raise exception 'El pie del recurso no puede superar 300 caracteres.';
  end if;
  if p_media_transcript is not null and char_length(p_media_transcript) > 20000 then
    raise exception 'La transcripción es demasiado larga.';
  end if;
  if p_media_subtitles_vtt is not null and char_length(p_media_subtitles_vtt) > 40000 then
    raise exception 'Los subtítulos son demasiado largos.';
  end if;

  if nullif(trim(coalesce(p_media_type, '')), '') = 'image'
     and nullif(trim(coalesce(p_media_alt_text, '')), '') is null then
    raise exception 'Las imágenes necesitan texto alternativo.';
  end if;

  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'Las respuestas deben enviarse como una lista.';
  end if;

  v_answer_count := jsonb_array_length(coalesce(p_answers, '[]'::jsonb));
  select
    count(*) filter (where coalesce((value->>'is_correct')::boolean, false)),
    count(*) filter (where nullif(trim(coalesce(value->>'text', '')), '') is null or char_length(trim(coalesce(value->>'text', ''))) > 2000)
  into v_correct_count, v_invalid_answer_count
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb));

  if v_invalid_answer_count > 0 then
    raise exception 'Todas las respuestas deben tener entre 1 y 2000 caracteres.';
  end if;

  if p_type = 'multiple_choice' then
    if v_answer_count < 2 or v_answer_count > 6 or v_correct_count <> 1 then
      raise exception 'Opción múltiple necesita entre 2 y 6 respuestas y exactamente una correcta.';
    end if;
  elsif p_type = 'true_false' then
    if v_answer_count <> 2 or v_correct_count <> 1 then
      raise exception 'Verdadero/Falso necesita exactamente dos respuestas y una correcta.';
    end if;
  elsif p_type = 'open_answer' then
    if v_answer_count <> 1 or v_correct_count <> 1 then
      raise exception 'La respuesta abierta necesita exactamente un criterio de respuesta esperado.';
    end if;
  elsif p_type = 'fill_blank' then
    select count(*) into v_blank_count
    from regexp_matches(coalesce(p_text, ''), '(_{2,}|\[\[blank\]\]|\{\{blank\}\})', 'gi');
    if v_blank_count < 1 or v_answer_count <> v_blank_count or v_correct_count <> v_answer_count then
      raise exception 'Rellenar huecos necesita una solución correcta por cada hueco del enunciado.';
    end if;
  elsif p_type = 'ordering' then
    if v_answer_count < 2 or v_correct_count <> v_answer_count then
      raise exception 'Ordenar necesita al menos dos elementos válidos.';
    end if;
  elsif p_type in ('match_pairs', 'drag_drop') then
    if v_answer_count < 1 or v_correct_count <> v_answer_count then
      raise exception 'Las relaciones necesitan al menos una pareja válida.';
    end if;
    select count(*) into v_invalid_answer_count
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) value
    where position('|||' in coalesce(value->>'text', '')) <= 1
       or nullif(trim(split_part(coalesce(value->>'text', ''), '|||', 1)), '') is null
       or nullif(trim(split_part(coalesce(value->>'text', ''), '|||', 2)), '') is null;
    if v_invalid_answer_count > 0 then
      raise exception 'Cada relación necesita un origen y un destino válidos.';
    end if;
  end if;

  v_question_id := public.save_teacher_question(
    p_subject_id => p_subject_id,
    p_question_id => p_question_id,
    p_classroom_id => p_classroom_id,
    p_topic_id => p_topic_id,
    p_type => p_type,
    p_text => trim(p_text),
    p_points_base => p_points_base,
    p_time_limit_seconds => p_time_limit_seconds,
    p_difficulty => p_difficulty,
    p_explanation => nullif(trim(coalesce(p_explanation, '')), ''),
    p_answers => p_answers,
    p_media_type => p_media_type,
    p_media_url => p_media_url,
    p_media_path => p_media_path,
    p_media_alt_text => p_media_alt_text,
    p_media_caption => p_media_caption,
    p_media_duration_seconds => p_media_duration_seconds,
    p_media_transcript => p_media_transcript,
    p_media_subtitles_vtt => p_media_subtitles_vtt
  );

  update public.questions set hint = v_hint where id = v_question_id;
  return v_question_id;
end;
$$;

revoke all on function public.save_teacher_question_v2(bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, text, jsonb, text, text, text, text, text, numeric, text, text) from public, anon;
grant execute on function public.save_teacher_question_v2(bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, text, jsonb, text, text, text, text, text, numeric, text, text) to authenticated;

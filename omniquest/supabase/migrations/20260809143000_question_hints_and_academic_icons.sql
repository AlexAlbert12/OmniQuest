-- Final UI consistency: teacher-authored question hints and platform-neutral academic icons.

alter table public.questions add column if not exists hint text;

alter table public.questions drop constraint if exists questions_hint_length_check;
alter table public.questions add constraint questions_hint_length_check check (hint is null or char_length(hint) <= 280);

-- Convert the legacy emoji presets to the Ionicons names used by every client.
update public.subjects
set icon = case icon
  when '📚' then 'book-outline'
  when '🎓' then 'school-outline'
  when '🧮' then 'calculator-outline'
  when '🌐' then 'language-outline'
  when '🧪' then 'flask-outline'
  when '🎨' then 'color-palette-outline'
  when '🔤' then 'language-outline'
  when '🧲' then 'hardware-chip-outline'
  else icon
end
where icon in ('📚','🎓','🧮','🌐','🧪','🎨','🔤','🧲');

update public.subject_topics
set icon = case icon
  when '📘' then 'book-outline'
  when '🧠' then 'bulb-outline'
  when '🧮' then 'calculator-outline'
  when '🔬' then 'flask-outline'
  when '🌍' then 'earth-outline'
  when '✍️' then 'create-outline'
  when '🎯' then 'locate-outline'
  when '⚡' then 'flash-outline'
  else icon
end
where icon in ('📘','🧠','🧮','🔬','🌍','✍️','🎯','⚡');


-- Keep the default topic created with a new course on the same icon system.
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
  v_classroom_id bigint;
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if not public.is_active_teacher() then
    raise exception 'Teacher access required';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'El nombre del curso es obligatorio.';
  end if;

  if v_code = '' then
    v_code := public.generate_unique_subject_code();
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'El código de invitación no es válido.';
  end if;

  if exists (select 1 from public.subjects where code = v_code)
     or exists (select 1 from public.classrooms where code = v_code) then
    raise exception 'Ese código de invitación ya existe. Elige otro o genera uno nuevo.';
  end if;

  insert into public.subjects (
    name, description, icon, code, education_level, academic_year, subject_label, theme_color, teacher_id
  )
  values (
    trim(p_name), nullif(trim(coalesce(p_description, '')), ''), coalesce(nullif(trim(p_icon), ''), 'book-outline'), v_code,
    p_education_level, p_academic_year, nullif(trim(coalesce(p_subject_label, '')), ''), p_theme_color, v_teacher_id
  )
  returning id into v_subject_id;

  insert into public.classrooms (subject_id, name, academic_year, code, active)
  values (v_subject_id, 'Clase principal', p_academic_year, public.generate_unique_subject_code(), true)
  returning id into v_classroom_id;

  insert into public.subject_topics (subject_id, classroom_id, title, description, icon, sort_order)
  values (v_subject_id, v_classroom_id, 'Tema 1', 'Primer tema de la clase', 'book-outline', 1);

  return jsonb_build_object('id', v_subject_id, 'code', v_code, 'classroomId', v_classroom_id);
end;
$$;

revoke all on function public.create_subject_with_default_topic(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_subject_with_default_topic(text, text, text, text, text, text, text, text) to authenticated;

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
  v_question_id bigint;
  v_hint text := nullif(trim(coalesce(p_hint, '')), '');
begin
  if v_hint is not null and char_length(v_hint) > 280 then
    raise exception 'La pista no puede superar 280 caracteres.';
  end if;

  v_question_id := public.save_teacher_question(
    p_subject_id => p_subject_id,
    p_question_id => p_question_id,
    p_classroom_id => p_classroom_id,
    p_topic_id => p_topic_id,
    p_type => p_type,
    p_text => p_text,
    p_points_base => p_points_base,
    p_time_limit_seconds => p_time_limit_seconds,
    p_difficulty => p_difficulty,
    p_explanation => p_explanation,
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

create or replace function public.get_safe_game_questions_v2(
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
  v_questions jsonb;
  v_result jsonb;
begin
  v_questions := public.get_safe_game_questions(p_subject_id, p_classroom_id, p_topic_id, p_general_topic, p_difficulty, p_review_failed);

  select coalesce(jsonb_agg(item || jsonb_build_object('hint', q.hint) order by item_ordinality), '[]'::jsonb)
  into v_result
  from jsonb_array_elements(coalesce(v_questions, '[]'::jsonb)) with ordinality as safe(item, item_ordinality)
  join public.questions q on q.id = (item ->> 'id')::bigint;

  return v_result;
end;
$$;

revoke all on function public.get_safe_game_questions_v2(bigint, bigint, bigint, boolean, integer, boolean) from public, anon;
grant execute on function public.get_safe_game_questions_v2(bigint, bigint, bigint, boolean, integer, boolean) to authenticated;

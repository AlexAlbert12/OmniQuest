create extension if not exists pgcrypto;

alter table public.classrooms
  add column if not exists active boolean not null default true,
  add column if not exists code text;

alter table public.enrollments add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.subject_topics add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.questions add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.subject_scores add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.topic_scores add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.game_attempts add column if not exists classroom_id bigint references public.classrooms(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'enrollments_classroom_id_fkey'
      and conrelid = 'public.enrollments'::regclass
  ) then
    alter table public.enrollments
      add constraint enrollments_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subject_topics_classroom_id_fkey'
      and conrelid = 'public.subject_topics'::regclass
  ) then
    alter table public.subject_topics
      add constraint subject_topics_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'questions_classroom_id_fkey'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subject_scores_classroom_id_fkey'
      and conrelid = 'public.subject_scores'::regclass
  ) then
    alter table public.subject_scores
      add constraint subject_scores_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'topic_scores_classroom_id_fkey'
      and conrelid = 'public.topic_scores'::regclass
  ) then
    alter table public.topic_scores
      add constraint topic_scores_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_attempts_classroom_id_fkey'
      and conrelid = 'public.game_attempts'::regclass
  ) then
    alter table public.game_attempts
      add constraint game_attempts_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete set null;
  end if;
end $$;

alter table public.subject_scores
  add column if not exists correct_answers integer not null default 0,
  add column if not exists played_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists played_days date[] default '{}'::date[];

alter table public.attempt_history
  add column if not exists submitted_answer_text text,
  add column if not exists submitted_answer_payload jsonb,
  add column if not exists earned_points integer not null default 0,
  add column if not exists hint_used boolean not null default false,
  add column if not exists was_skipped boolean not null default false;

alter table public.topic_scores
  add column if not exists played_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.game_attempts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists finished_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subject_scores'
      and column_name = 'played_days'
      and udt_name <> '_date'
  ) then
    execute $sql$
      alter table public.subject_scores
      alter column played_days type date[]
      using (
        case
          when played_days is null then '{}'::date[]
          else array(
            select item::date
            from unnest(played_days::text[]) as item
            where item ~ '^\d{4}-\d{2}-\d{2}$'
          )
        end
      )
    $sql$;
  end if;
end $$;

alter table public.subject_scores
  alter column played_days set default '{}'::date[];

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

    if not exists (select 1 from public.subjects where code = v_code)
       and not exists (select 1 from public.classrooms where code = v_code) then
      return v_code;
    end if;
  end loop;

  raise exception 'No se pudo generar un código único. Inténtalo de nuevo.';
end;
$$;

create or replace function public.ensure_default_classroom(p_subject_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_classroom_id bigint;
  v_academic_year text;
begin
  select id
  into v_classroom_id
  from public.classrooms
  where subject_id = p_subject_id
  order by created_at asc, id asc
  limit 1;

  if v_classroom_id is not null then
    update public.classrooms
    set code = coalesce(code, public.generate_unique_subject_code()),
        active = coalesce(active, true)
    where id = v_classroom_id;
    return v_classroom_id;
  end if;

  select academic_year
  into v_academic_year
  from public.subjects
  where id = p_subject_id;

  if not found then
    raise exception 'Curso no encontrado.';
  end if;

  insert into public.classrooms (subject_id, name, academic_year, code, active)
  values (p_subject_id, 'Clase principal', v_academic_year, public.generate_unique_subject_code(), true)
  returning id into v_classroom_id;

  return v_classroom_id;
end;
$$;

insert into public.classrooms (subject_id, name, academic_year, code, active)
select id, 'Clase principal', academic_year, public.generate_unique_subject_code(), true
from public.subjects
where not exists (
  select 1
  from public.classrooms
  where classrooms.subject_id = subjects.id
);

update public.classrooms
set code = public.generate_unique_subject_code()
where code is null;

update public.enrollments
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.subject_topics
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.questions
set classroom_id = coalesce(
  (select classroom_id from public.subject_topics where subject_topics.id = questions.topic_id),
  public.ensure_default_classroom(subject_id)
)
where classroom_id is null;

update public.subject_scores
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.topic_scores
set classroom_id = coalesce(
  (select classroom_id from public.subject_topics where subject_topics.id = topic_scores.topic_id),
  public.ensure_default_classroom(subject_id)
)
where classroom_id is null;

update public.game_attempts
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

create unique index if not exists classrooms_code_unique_idx
on public.classrooms(code)
where code is not null;

create index if not exists classrooms_subject_id_idx on public.classrooms(subject_id);
create index if not exists enrollments_classroom_id_idx on public.enrollments(classroom_id);
create index if not exists subject_topics_classroom_id_idx on public.subject_topics(classroom_id);
create index if not exists questions_classroom_id_idx on public.questions(classroom_id);
create index if not exists subject_scores_classroom_id_idx on public.subject_scores(classroom_id);
create index if not exists topic_scores_classroom_id_idx on public.topic_scores(classroom_id);
create index if not exists game_attempts_classroom_id_idx on public.game_attempts(classroom_id);

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'enrollments_student_id_subject_id_key' and conrelid = 'public.enrollments'::regclass) then
    alter table public.enrollments drop constraint enrollments_student_id_subject_id_key;
  end if;
  if exists (select 1 from pg_constraint where conname = 'subject_scores_student_id_subject_id_key' and conrelid = 'public.subject_scores'::regclass) then
    alter table public.subject_scores drop constraint subject_scores_student_id_subject_id_key;
  end if;
end $$;

create unique index if not exists enrollments_student_classroom_unique_idx
on public.enrollments(student_id, classroom_id)
where classroom_id is not null;

create unique index if not exists subject_scores_student_classroom_unique_idx
on public.subject_scores(student_id, classroom_id)
where classroom_id is not null;

create or replace function public.fill_course_classroom_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_id bigint;
begin
  if tg_table_name = 'questions' and new.topic_id is not null and new.classroom_id is null then
    select classroom_id into new.classroom_id
    from public.subject_topics
    where id = new.topic_id;
  end if;

  if tg_table_name = 'topic_scores' and new.topic_id is not null and new.classroom_id is null then
    select classroom_id into new.classroom_id
    from public.subject_topics
    where id = new.topic_id;
  end if;

  if new.classroom_id is null and new.subject_id is not null then
    new.classroom_id := public.ensure_default_classroom(new.subject_id);
  end if;

  if new.classroom_id is not null then
    select subject_id
    into v_subject_id
    from public.classrooms
    where id = new.classroom_id;

    if v_subject_id is null then
      raise exception 'Clase no encontrada.';
    end if;

    if new.subject_id is null then
      new.subject_id := v_subject_id;
    elsif new.subject_id <> v_subject_id then
      raise exception 'La clase no pertenece a este curso.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists fill_enrollments_classroom_id on public.enrollments;
create trigger fill_enrollments_classroom_id
before insert or update on public.enrollments
for each row execute function public.fill_course_classroom_id();

drop trigger if exists fill_subject_topics_classroom_id on public.subject_topics;
create trigger fill_subject_topics_classroom_id
before insert or update on public.subject_topics
for each row execute function public.fill_course_classroom_id();

drop trigger if exists fill_questions_classroom_id on public.questions;
create trigger fill_questions_classroom_id
before insert or update on public.questions
for each row execute function public.fill_course_classroom_id();

drop trigger if exists fill_subject_scores_classroom_id on public.subject_scores;
create trigger fill_subject_scores_classroom_id
before insert or update on public.subject_scores
for each row execute function public.fill_course_classroom_id();

drop trigger if exists fill_topic_scores_classroom_id on public.topic_scores;
create trigger fill_topic_scores_classroom_id
before insert or update on public.topic_scores
for each row execute function public.fill_course_classroom_id();

drop trigger if exists fill_game_attempts_classroom_id on public.game_attempts;
create trigger fill_game_attempts_classroom_id
before insert or update on public.game_attempts
for each row execute function public.fill_course_classroom_id();

create or replace function public.is_classroom_teacher(p_classroom_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.classrooms
    join public.subjects on subjects.id = classrooms.subject_id
    where classrooms.id = p_classroom_id
      and subjects.teacher_id = auth.uid()
  )
$$;

create or replace function public.is_classroom_enrolled(p_classroom_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.enrollments
    where classroom_id = p_classroom_id
      and student_id = auth.uid()
  )
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
  v_classroom_id bigint;
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
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
    trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_icon, v_code,
    p_education_level, p_academic_year, nullif(trim(coalesce(p_subject_label, '')), ''), p_theme_color, v_teacher_id
  )
  returning id into v_subject_id;

  insert into public.classrooms (subject_id, name, academic_year, code, active)
  values (v_subject_id, 'Clase principal', p_academic_year, public.generate_unique_subject_code(), true)
  returning id into v_classroom_id;

  insert into public.subject_topics (subject_id, classroom_id, title, description, icon, sort_order)
  values (v_subject_id, v_classroom_id, 'Tema 1', 'Primer tema de la clase', '📘', 1);

  return jsonb_build_object('id', v_subject_id, 'code', v_code, 'classroomId', v_classroom_id);
end;
$$;

drop function if exists public.save_teacher_question(bigint, bigint, bigint, text, text, integer, integer, text, jsonb);
create or replace function public.save_teacher_question(
  p_subject_id bigint,
  p_question_id bigint default null,
  p_classroom_id bigint default null,
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
  v_classroom_id bigint;
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

  if nullif(trim(p_text), '') is null then
    raise exception 'El enunciado de la pregunta es obligatorio.';
  end if;

  if p_question_id is null then
    insert into public.questions (
      subject_id, classroom_id, topic_id, type, text, points_base, time_limit_seconds, explanation
    )
    values (
      p_subject_id, v_classroom_id, p_topic_id, p_type, trim(p_text), p_points_base, p_time_limit_seconds,
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

drop function if exists public.start_game_attempt(bigint, bigint, boolean);
create or replace function public.start_game_attempt(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false
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

drop function if exists public.get_game_questions(bigint, bigint, boolean);
create or replace function public.get_game_questions(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false
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
      and (
        (p_general_topic and q.topic_id is null)
        or (not p_general_topic and p_topic_id is null)
        or (not p_general_topic and p_topic_id is not null and q.topic_id = p_topic_id)
      )
  ) safe_questions;

  return v_result;
end;
$$;

create or replace function public.submit_answer(
  p_question_id bigint,
  p_answer_id bigint default null,
  p_answer_text text default null,
  p_answer_payload jsonb default null,
  p_time_taken_seconds integer default null,
  p_hint_used boolean default false,
  p_skipped boolean default false,
  p_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question public.questions%rowtype;
  v_subject_id bigint;
  v_classroom_id bigint;
  v_topic_id bigint;
  v_is_correct boolean := false;
  v_correct_answer_id bigint := null;
  v_time_limit integer := 30;
  v_remaining_seconds integer := 0;
  v_earned_points integer := 0;
  v_previous_subject_best integer := 0;
  v_previous_topic_best integer := 0;
  v_points_to_add integer := 0;
  v_score_for_best integer := 0;
  v_today_key date := (now() at time zone 'Europe/Madrid')::date;
  v_existing_days date[] := '{}'::date[];
  v_payload_ids bigint[];
  v_correct_ids bigint[];
  v_payload_pair jsonb;
  v_pair_left text;
  v_pair_right text;
  v_pair_count integer := 0;
  v_matching_pair_count integer := 0;
  v_attempt public.game_attempts%rowtype;
  v_correct_answer_text text := null;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select *
  into v_question
  from public.questions
  where id = p_question_id
    and coalesce(active, true);

  if not found then
    raise exception 'Question not found';
  end if;

  v_subject_id := v_question.subject_id;
  v_classroom_id := coalesce(v_question.classroom_id, public.ensure_default_classroom(v_question.subject_id));
  v_topic_id := v_question.topic_id;
  v_time_limit := coalesce(v_question.time_limit_seconds, 30);

  if not exists (
    select 1
    from public.enrollments
    where student_id = v_user_id
      and classroom_id = v_classroom_id
  ) then
    raise exception 'Student is not enrolled in this classroom';
  end if;

  if p_attempt_id is not null then
    select *
    into v_attempt
    from public.game_attempts
    where id = p_attempt_id
      and student_id = v_user_id
      and status = 'playing';

    if not found then
      raise exception 'Game attempt not found';
    end if;

    if v_attempt.subject_id <> v_subject_id or v_attempt.classroom_id <> v_classroom_id then
      raise exception 'Question does not belong to this game attempt';
    end if;

    if v_attempt.topic_id is not null and v_attempt.topic_id <> v_topic_id then
      raise exception 'Question does not belong to this topic attempt';
    end if;
  end if;

  if not p_skipped then
    if v_question.type in ('multiple_choice', 'true_false') then
      select a.id, coalesce(a.is_correct, false)
      into v_correct_answer_id, v_is_correct
      from public.answers a
      where a.id = p_answer_id
        and a.question_id = p_question_id;

      if v_correct_answer_id is null then
        v_is_correct := false;
      end if;

    elsif v_question.type = 'open_answer' then
      v_is_correct := exists (
        select 1
        from public.answers a
        where a.question_id = p_question_id
          and coalesce(a.is_correct, true)
          and public.normalize_answer_text(a.text) = public.normalize_answer_text(p_answer_text)
      );

    elsif v_question.type = 'fill_blank' then
      with expected as (
        select public.normalize_answer_text(a.text) as value, count(*) as quantity
        from public.answers a
        where a.question_id = p_question_id
          and coalesce(a.is_correct, true)
          and public.normalize_answer_text(a.text) <> ''
        group by public.normalize_answer_text(a.text)
      ),
      submitted_parts as (
        select public.normalize_answer_text(part) as value
        from regexp_split_to_table(coalesce(p_answer_text, ''), '[,;\n]') as part
        where public.normalize_answer_text(part) <> ''
      ),
      submitted as (
        select value, count(*) as quantity
        from submitted_parts
        group by value
      ),
      differences as (
        select
          coalesce(expected.value, submitted.value) as value,
          coalesce(expected.quantity, 0) as expected_quantity,
          coalesce(submitted.quantity, 0) as submitted_quantity
        from expected
        full join submitted using (value)
        where coalesce(expected.quantity, 0) <> coalesce(submitted.quantity, 0)
      )
      select exists (select 1 from expected)
        and exists (select 1 from submitted)
        and not exists (select 1 from differences)
      into v_is_correct;

    elsif v_question.type = 'ordering' then
      select array_agg((item.value)::bigint order by item.ordinality)
      into v_payload_ids
      from jsonb_array_elements_text(coalesce(p_answer_payload->'answer_ids', '[]'::jsonb)) with ordinality item(value, ordinality);

      select array_agg(a.id order by coalesce(a.sort_order, a.id))
      into v_correct_ids
      from public.answers a
      where a.question_id = p_question_id;

      v_is_correct := coalesce(v_payload_ids = v_correct_ids, false);

    elsif v_question.type in ('match_pairs', 'drag_drop') then
      for v_payload_pair in select value from jsonb_array_elements(coalesce(p_answer_payload->'pairs', '[]'::jsonb)) loop
        v_pair_count := v_pair_count + 1;
        v_pair_left := coalesce(v_payload_pair->>'left', '');
        v_pair_right := coalesce(v_payload_pair->>'right', '');

        if exists (
          select 1
          from public.answers a
          where a.question_id = p_question_id
            and split_part(a.text, '|||', 1) = v_pair_left
            and split_part(a.text, '|||', 2) = v_pair_right
        ) then
          v_matching_pair_count := v_matching_pair_count + 1;
        end if;
      end loop;

      v_is_correct := v_pair_count > 0
        and v_pair_count = v_matching_pair_count
        and v_pair_count = (select count(*) from public.answers where question_id = p_question_id);
    end if;
  end if;

  if v_is_correct then
    v_remaining_seconds := greatest(0, v_time_limit - coalesce(p_time_taken_seconds, v_time_limit));
    v_earned_points := greatest(
      0,
      coalesce(v_question.points_base, 10) + floor(v_remaining_seconds / 2)::integer - case when p_hint_used then 10 else 0 end
    );
  end if;

  insert into public.attempt_history (
    student_id, question_id, answer_id, is_correct, time_taken_seconds, attempted_at,
    submitted_answer_text, submitted_answer_payload, earned_points, hint_used, was_skipped
  )
  values (
    v_user_id, p_question_id, p_answer_id, v_is_correct, p_time_taken_seconds, now(),
    p_answer_text, p_answer_payload, v_earned_points, p_hint_used, p_skipped
  );

  if p_attempt_id is not null then
    update public.game_attempts
    set total_score = total_score + v_earned_points,
        correct_answers = correct_answers + case when v_is_correct then 1 else 0 end,
        updated_at = now()
    where id = p_attempt_id
    returning total_score into v_score_for_best;
  else
    v_score_for_best := v_earned_points;
  end if;

  select coalesce(max_score, 0), coalesce(played_days, '{}'::date[])
  into v_previous_subject_best, v_existing_days
  from public.subject_scores
  where student_id = v_user_id
    and classroom_id = v_classroom_id;

  if not found then
    insert into public.subject_scores (
      student_id, subject_id, classroom_id, max_score, correct_answers, played_days, played_at, updated_at
    ) values (
      v_user_id, v_subject_id, v_classroom_id, v_score_for_best,
      case when v_is_correct then 1 else 0 end, array[v_today_key], now(), now()
    );
    v_points_to_add := v_score_for_best;
  else
    update public.subject_scores
    set max_score = greatest(coalesce(max_score, 0), v_score_for_best),
        correct_answers = coalesce(correct_answers, 0) + case when v_is_correct then 1 else 0 end,
        played_days = (
          select array_agg(distinct day order by day)
          from unnest(array_append(coalesce(v_existing_days, '{}'::date[]), v_today_key)) as day
        ),
        played_at = now(),
        updated_at = now()
    where student_id = v_user_id
      and classroom_id = v_classroom_id;

    v_points_to_add := greatest(0, v_score_for_best - v_previous_subject_best);
  end if;

  if v_topic_id is not null then
    select coalesce(max_score, 0)
    into v_previous_topic_best
    from public.topic_scores
    where student_id = v_user_id
      and topic_id = v_topic_id;

    if not found then
      insert into public.topic_scores (
        student_id, subject_id, classroom_id, topic_id, max_score, played_at, updated_at
      ) values (
        v_user_id, v_subject_id, v_classroom_id, v_topic_id, v_score_for_best, now(), now()
      );
    else
      update public.topic_scores
      set max_score = greatest(coalesce(max_score, 0), v_score_for_best),
          played_at = now(),
          updated_at = now(),
          classroom_id = v_classroom_id
      where student_id = v_user_id
        and topic_id = v_topic_id;
    end if;
  end if;

  if not v_is_correct and v_question.type in ('multiple_choice', 'true_false') then
    select id into v_correct_answer_id
    from public.answers
    where question_id = p_question_id
      and coalesce(is_correct, false)
    order by sort_order nulls last, id
    limit 1;
  end if;

  select string_agg(
    case
      when v_question.type in ('match_pairs', 'drag_drop') then concat(split_part(a.text, '|||', 1), ' -> ', split_part(a.text, '|||', 2))
      else a.text
    end,
    ', '
    order by a.sort_order nulls last, a.id
  )
  into v_correct_answer_text
  from public.answers a
  where a.question_id = p_question_id
    and (coalesce(a.is_correct, true) or v_question.type in ('ordering', 'match_pairs', 'drag_drop'));

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'earned_points', v_earned_points,
    'attempt_score', v_score_for_best,
    'correct_answer_id', v_correct_answer_id,
    'correct_answer_text', v_correct_answer_text,
    'explanation', v_question.explanation
  );
end;
$$;

create or replace function public.join_subject_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subject public.subjects%rowtype;
  v_classroom public.classrooms%rowtype;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id
      and role_id in ('student', 'guest')
  ) then
    raise exception 'Solo los alumnos pueden unirse a clases.';
  end if;

  select *
  into v_classroom
  from public.classrooms
  where code = v_code
    and coalesce(active, true);

  if found then
    select *
    into v_subject
    from public.subjects
    where id = v_classroom.subject_id
      and coalesce(active, true)
      and not coalesce(is_archived, false);

    if not found then
      raise exception 'Este curso no está disponible.';
    end if;
  else
    select *
    into v_subject
    from public.subjects
    where code = v_code
      and coalesce(active, true)
      and not coalesce(is_archived, false);

    if not found then
      raise exception 'No se ha encontrado ningún curso o clase con ese código.';
    end if;

    select *
    into v_classroom
    from public.classrooms
    where id = public.ensure_default_classroom(v_subject.id);
  end if;

  if exists (
    select 1 from public.enrollments
    where student_id = v_user_id
      and classroom_id = v_classroom.id
  ) then
    raise exception 'Ya estás matriculado en esta clase.';
  end if;

  insert into public.enrollments (student_id, subject_id, classroom_id)
  values (v_user_id, v_subject.id, v_classroom.id)
  on conflict (student_id, classroom_id) where classroom_id is not null do nothing;

  return jsonb_build_object(
    'id', v_subject.id,
    'name', v_subject.name,
    'classroomId', v_classroom.id,
    'classroomName', v_classroom.name
  );
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

  select * into v_source
  from public.subjects
  where id = p_subject_id
    and teacher_id = v_teacher_id;

  if not found then
    raise exception 'No puedes duplicar este curso.';
  end if;

  v_new_code := public.generate_unique_subject_code();

  insert into public.subjects (
    name, description, icon, code, education_level, academic_year, subject_label, teacher_id, theme_color, is_archived
  ) values (
    v_source.name || coalesce(p_name_suffix, ' (Copia)'), v_source.description, v_source.icon, v_new_code,
    v_source.education_level, v_source.academic_year, v_source.subject_label, v_teacher_id, v_source.theme_color, false
  ) returning id into v_new_subject_id;

  perform public.ensure_default_classroom(p_subject_id);

  create temporary table if not exists pg_temp.classroom_id_map (source_id bigint primary key, target_id bigint not null) on commit drop;
  create temporary table if not exists pg_temp.topic_id_map (source_id bigint primary key, target_id bigint not null) on commit drop;
  create temporary table if not exists pg_temp.question_id_map (source_id bigint primary key, target_id bigint not null) on commit drop;
  delete from pg_temp.classroom_id_map;
  delete from pg_temp.topic_id_map;
  delete from pg_temp.question_id_map;

  for v_classroom in
    select id, name, academic_year, active
    from public.classrooms
    where subject_id = p_subject_id
    order by created_at, id
  loop
    insert into public.classrooms (subject_id, name, academic_year, code, active)
    values (v_new_subject_id, v_classroom.name, v_classroom.academic_year, public.generate_unique_subject_code(), coalesce(v_classroom.active, true))
    returning id into v_new_classroom_id;

    insert into pg_temp.classroom_id_map (source_id, target_id)
    values (v_classroom.id, v_new_classroom_id);
  end loop;

  for v_topic in
    select id, classroom_id, title, description, icon, sort_order, active
    from public.subject_topics
    where subject_id = p_subject_id
    order by classroom_id, sort_order nulls last, created_at, id
  loop
    insert into public.subject_topics (subject_id, classroom_id, title, description, icon, sort_order, active)
    values (
      v_new_subject_id,
      (select target_id from pg_temp.classroom_id_map where source_id = v_topic.classroom_id),
      v_topic.title,
      v_topic.description,
      v_topic.icon,
      v_topic.sort_order,
      v_topic.active
    ) returning id into v_new_topic_id;

    insert into pg_temp.topic_id_map (source_id, target_id)
    values (v_topic.id, v_new_topic_id);
  end loop;

  for v_question in
    select id, classroom_id, type, text, points_base, time_limit_seconds, topic_id, difficulty, explanation, active
    from public.questions
    where subject_id = p_subject_id
    order by classroom_id, created_at, id
  loop
    insert into public.questions (
      subject_id, classroom_id, topic_id, type, text, points_base, time_limit_seconds, difficulty, explanation, active
    ) values (
      v_new_subject_id,
      (select target_id from pg_temp.classroom_id_map where source_id = v_question.classroom_id),
      (select target_id from pg_temp.topic_id_map where source_id = v_question.topic_id),
      v_question.type,
      v_question.text,
      v_question.points_base,
      v_question.time_limit_seconds,
      v_question.difficulty,
      v_question.explanation,
      v_question.active
    ) returning id into v_new_question_id;

    insert into pg_temp.question_id_map (source_id, target_id)
    values (v_question.id, v_new_question_id);
  end loop;

  insert into public.answers (question_id, text, is_correct, sort_order)
  select question_id_map.target_id, answers.text, answers.is_correct, answers.sort_order
  from public.answers
  join pg_temp.question_id_map on question_id_map.source_id = answers.question_id
  order by answers.question_id, answers.sort_order nulls last, answers.id;

  return jsonb_build_object('id', v_new_subject_id, 'code', v_new_code);
end;
$$;

alter table public.classrooms enable row level security;

drop policy if exists "classrooms_select_teacher_or_enrolled" on public.classrooms;
create policy "classrooms_select_teacher_or_enrolled"
on public.classrooms for select to authenticated
using (
  public.is_classroom_teacher(id)
  or public.is_classroom_enrolled(id)
);

drop policy if exists "classrooms_insert_own_teacher" on public.classrooms;
create policy "classrooms_insert_own_teacher"
on public.classrooms for insert to authenticated
with check (public.is_classroom_teacher(id) or exists (select 1 from public.subjects where subjects.id = subject_id and subjects.teacher_id = auth.uid()));

drop policy if exists "classrooms_update_own_teacher" on public.classrooms;
create policy "classrooms_update_own_teacher"
on public.classrooms for update to authenticated
using (public.is_classroom_teacher(id))
with check (public.is_classroom_teacher(id));

drop policy if exists "classrooms_delete_own_teacher" on public.classrooms;
create policy "classrooms_delete_own_teacher"
on public.classrooms for delete to authenticated
using (public.is_classroom_teacher(id));

grant execute on function public.generate_unique_subject_code() to authenticated, service_role;
grant execute on function public.ensure_default_classroom(bigint) to authenticated, service_role;
grant execute on function public.create_subject_with_default_topic(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.save_teacher_question(bigint, bigint, bigint, bigint, text, text, integer, integer, text, jsonb) to authenticated;
grant execute on function public.start_game_attempt(bigint, bigint, bigint, boolean) to authenticated;
grant execute on function public.get_game_questions(bigint, bigint, bigint, boolean) to authenticated;
grant execute on function public.submit_answer(bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) to authenticated;
grant execute on function public.join_subject_by_code(text) to authenticated;
grant execute on function public.duplicate_teacher_subject(bigint, text) to authenticated;
grant execute on function public.is_classroom_teacher(bigint) to authenticated;
grant execute on function public.is_classroom_enrolled(bigint) to authenticated;

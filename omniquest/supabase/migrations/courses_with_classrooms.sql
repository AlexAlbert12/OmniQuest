create or replace function public.ensure_default_classroom(p_subject_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_classroom_id bigint;
  v_subject_name text;
begin
  select id
  into v_classroom_id
  from public.classrooms
  where subject_id = p_subject_id
  order by created_at asc, id asc
  limit 1;

  if v_classroom_id is not null then
    return v_classroom_id;
  end if;

  select name
  into v_subject_name
  from public.subjects
  where id = p_subject_id;

  if not found then
    raise exception 'Curso no encontrado.';
  end if;

  insert into public.classrooms (subject_id, name)
  values (p_subject_id, 'Clase principal')
  returning id into v_classroom_id;

  return v_classroom_id;
end;
$$;

alter table public.classrooms
  add column if not exists active boolean not null default true,
  add column if not exists code text;

create unique index if not exists classrooms_code_unique_idx
on public.classrooms(code)
where code is not null;

create index if not exists classrooms_subject_id_idx on public.classrooms(subject_id);

insert into public.classrooms (subject_id, name, academic_year, active)
select id, 'Clase principal', academic_year, true
from public.subjects
where not exists (
  select 1
  from public.classrooms
  where classrooms.subject_id = subjects.id
);

alter table public.enrollments add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.subject_topics add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.questions add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.subject_scores add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.topic_scores add column if not exists classroom_id bigint references public.classrooms(id) on delete cascade;
alter table public.game_attempts add column if not exists classroom_id bigint references public.classrooms(id) on delete set null;

update public.enrollments
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.subject_topics
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.questions
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.subject_scores
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.topic_scores
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

update public.game_attempts
set classroom_id = public.ensure_default_classroom(subject_id)
where classroom_id is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'enrollments_student_id_subject_id_key'
      and conrelid = 'public.enrollments'::regclass
  ) then
    alter table public.enrollments drop constraint enrollments_student_id_subject_id_key;
  end if;
end $$;

create unique index if not exists enrollments_student_classroom_unique_idx
on public.enrollments(student_id, classroom_id)
where classroom_id is not null;

create index if not exists enrollments_classroom_id_idx on public.enrollments(classroom_id);
create index if not exists subject_topics_classroom_id_idx on public.subject_topics(classroom_id);
create index if not exists questions_classroom_id_idx on public.questions(classroom_id);
create index if not exists subject_scores_classroom_id_idx on public.subject_scores(classroom_id);
create index if not exists topic_scores_classroom_id_idx on public.topic_scores(classroom_id);
create index if not exists game_attempts_classroom_id_idx on public.game_attempts(classroom_id);

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

create or replace function public.is_subject_enrolled(p_subject_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.enrollments
    where subject_id = p_subject_id
      and student_id = auth.uid()
  )
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
    select 1
    from public.profiles
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
    select 1
    from public.enrollments
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

grant execute on function public.ensure_default_classroom(bigint) to authenticated, service_role;
grant execute on function public.is_classroom_teacher(bigint) to authenticated;
grant execute on function public.is_classroom_enrolled(bigint) to authenticated;
grant execute on function public.join_subject_by_code(text) to authenticated;

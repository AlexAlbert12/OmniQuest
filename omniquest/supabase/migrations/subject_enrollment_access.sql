create or replace function public.join_subject_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subject public.subjects%rowtype;
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
  into v_subject
  from public.subjects
  where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
    and coalesce(active, true)
    and not coalesce(is_archived, false);

  if not found then
    raise exception 'No se ha encontrado ninguna clase con ese código.';
  end if;

  if exists (
    select 1
    from public.enrollments
    where student_id = v_user_id
      and subject_id = v_subject.id
  ) then
    raise exception 'Ya estás matriculado en esta clase.';
  end if;

  insert into public.enrollments (student_id, subject_id)
  values (v_user_id, v_subject.id)
  on conflict (student_id, subject_id) do nothing;

  return jsonb_build_object(
    'id', v_subject.id,
    'name', v_subject.name
  );
end;
$$;

create or replace function public.is_subject_teacher(p_subject_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.subjects
    where id = p_subject_id
      and teacher_id = auth.uid()
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

drop policy if exists "subjects_select_authenticated" on public.subjects;
drop policy if exists "subjects_select_teacher_or_enrolled" on public.subjects;

create policy "subjects_select_teacher_or_enrolled"
on public.subjects for select to authenticated
using (
  public.is_subject_teacher(id)
  or (
    coalesce(active, true)
    and not coalesce(is_archived, false)
    and public.is_subject_enrolled(id)
  )
);

drop policy if exists "questions_select_teacher_or_enrolled" on public.questions;
create policy "questions_select_teacher_or_enrolled"
on public.questions for select to authenticated
using (
  exists (
    select 1 from public.subjects
    where subjects.id = questions.subject_id
      and (
        public.is_subject_teacher(subjects.id)
        or (
          coalesce(questions.active, true)
          and public.is_subject_enrolled(subjects.id)
        )
      )
  )
);

drop policy if exists "answers_select_teacher_or_enrolled" on public.answers;
create policy "answers_select_teacher_or_enrolled"
on public.answers for select to authenticated
using (
  exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = answers.question_id
      and (
        public.is_subject_teacher(subjects.id)
        or (
          coalesce(questions.active, true)
          and public.is_subject_enrolled(subjects.id)
        )
      )
  )
);

drop policy if exists "enrollments_insert_self" on public.enrollments;
create policy "enrollments_insert_self"
on public.enrollments for insert to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_id in ('student', 'guest')
  )
  and exists (
    select 1
    from public.subjects
    where subjects.id = enrollments.subject_id
      and coalesce(subjects.active, true)
      and not coalesce(subjects.is_archived, false)
  )
);

grant execute on function public.join_subject_by_code(text) to authenticated;

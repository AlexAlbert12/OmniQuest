create or replace function public.create_teacher_classroom(
  p_subject_id bigint,
  p_name text,
  p_academic_year text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_subject record;
  v_classroom public.classrooms%rowtype;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_code text;
begin
  if v_teacher_id is null then
    raise exception 'No autenticado.';
  end if;

  if v_name is null then
    raise exception 'El nombre de la clase es obligatorio.';
  end if;

  select id, academic_year, teacher_id
  into v_subject
  from public.subjects
  where id = p_subject_id;

  if not found then
    raise exception 'Curso no encontrado.';
  end if;

  if v_subject.teacher_id is distinct from v_teacher_id then
    raise exception 'No tienes permiso para crear clases en este curso.';
  end if;

  v_code := public.generate_unique_subject_code();

  insert into public.classrooms (subject_id, name, academic_year, code, active)
  values (
    p_subject_id,
    v_name,
    coalesce(nullif(trim(coalesce(p_academic_year, '')), ''), v_subject.academic_year),
    v_code,
    true
  )
  returning * into v_classroom;

  return jsonb_build_object(
    'id', v_classroom.id,
    'subject_id', v_classroom.subject_id,
    'name', v_classroom.name,
    'academic_year', v_classroom.academic_year,
    'active', v_classroom.active,
    'code', v_classroom.code,
    'created_at', v_classroom.created_at
  );
end;
$$;

grant execute on function public.create_teacher_classroom(bigint, text, text) to authenticated;

-- Mantén también políticas correctas para lectura/edición directa.
alter table public.classrooms enable row level security;

drop policy if exists "classrooms_insert_own_teacher" on public.classrooms;
create policy "classrooms_insert_own_teacher"
on public.classrooms
for insert
to authenticated
with check (
  exists (
    select 1
    from public.subjects s
    where s.id = classrooms.subject_id
      and s.teacher_id = auth.uid()
  )
);

drop policy if exists "classrooms_select_teacher_or_enrolled" on public.classrooms;
create policy "classrooms_select_teacher_or_enrolled"
on public.classrooms
for select
to authenticated
using (
  public.is_classroom_teacher(id)
  or public.is_classroom_enrolled(id)
);

drop policy if exists "classrooms_update_own_teacher" on public.classrooms;
create policy "classrooms_update_own_teacher"
on public.classrooms
for update
to authenticated
using (public.is_classroom_teacher(id))
with check (public.is_classroom_teacher(id));

drop policy if exists "classrooms_delete_own_teacher" on public.classrooms;
create policy "classrooms_delete_own_teacher"
on public.classrooms
for delete
to authenticated
using (public.is_classroom_teacher(id));

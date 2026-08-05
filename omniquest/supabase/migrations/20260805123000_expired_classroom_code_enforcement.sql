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
      and coalesce(active, true)
      and (role_id <> 'guest' or coalesce(expires_at, now() + interval '1 day') > now())
  ) then
    raise exception 'Solo los alumnos activos pueden unirse a clases.';
  end if;

  select *
  into v_classroom
  from public.classrooms
  where code = v_code
    and coalesce(active, true);

  if found then
    if v_classroom.code_expires_at is not null and v_classroom.code_expires_at <= now() then
      raise exception 'Este código de clase ha caducado.';
    end if;

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
    where subject_id = v_subject.id
      and coalesce(active, true)
    order by created_at asc, id asc
    limit 1;

    if not found then
      raise exception 'Este curso no tiene ninguna clase activa disponible.';
    end if;
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

revoke all on function public.join_subject_by_code(text) from public, anon;
grant execute on function public.join_subject_by_code(text) to authenticated, service_role;

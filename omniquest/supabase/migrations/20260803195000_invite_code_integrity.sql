do $$
begin
  if exists (
    select normalized_code
    from (
      select upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) as normalized_code
      from public.subjects
      where nullif(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'), '') is not null
      union all
      select upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) as normalized_code
      from public.classrooms
      where nullif(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'), '') is not null
    ) invitation_codes
    group by normalized_code
    having count(*) > 1
  ) then
    raise exception 'Duplicate invitation codes must be resolved before applying code integrity constraints';
  end if;
end;
$$;

update public.subjects
set code = upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'))
where code is not null;

update public.classrooms
set code = upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'))
where code is not null;

create or replace function public.enforce_global_invite_code_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_code text := upper(regexp_replace(coalesce(new.code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_code = '' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_code, 0));

  if tg_table_name = 'subjects' then
    if exists (
      select 1
      from public.subjects subject
      where upper(subject.code) = v_code
        and subject.id is distinct from new.id
    ) or exists (
      select 1
      from public.classrooms classroom
      where upper(classroom.code) = v_code
    ) then
      raise exception 'Invitation code already exists';
    end if;
  elsif tg_table_name = 'classrooms' then
    if exists (
      select 1
      from public.classrooms classroom
      where upper(classroom.code) = v_code
        and classroom.id is distinct from new.id
    ) or exists (
      select 1
      from public.subjects subject
      where upper(subject.code) = v_code
    ) then
      raise exception 'Invitation code already exists';
    end if;
  end if;

  new.code := v_code;
  return new;
end;
$$;

revoke all on function public.enforce_global_invite_code_uniqueness() from public, anon, authenticated;

drop trigger if exists enforce_subject_invite_code_uniqueness on public.subjects;
create trigger enforce_subject_invite_code_uniqueness
before insert or update of code on public.subjects
for each row execute function public.enforce_global_invite_code_uniqueness();

drop trigger if exists enforce_classroom_invite_code_uniqueness on public.classrooms;
create trigger enforce_classroom_invite_code_uniqueness
before insert or update of code on public.classrooms
for each row execute function public.enforce_global_invite_code_uniqueness();

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

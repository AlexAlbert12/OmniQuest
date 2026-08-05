create or replace function public.is_active_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role_id = 'teacher'
      and coalesce(active, true)
  );
$$;

revoke all on function public.is_active_teacher() from public, anon;
grant execute on function public.is_active_teacher() to authenticated, service_role;

create or replace function public.enforce_subject_teacher_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.teacher_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = new.teacher_id
      and role_id = 'teacher'
      and coalesce(active, true)
  ) then
    raise exception 'Course owner must be an active teacher';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_subject_teacher_role() from public, anon, authenticated;

drop trigger if exists enforce_subject_teacher_role_trigger on public.subjects;
create trigger enforce_subject_teacher_role_trigger
before insert or update of teacher_id on public.subjects
for each row execute function public.enforce_subject_teacher_role();

drop policy if exists "subjects_select_authenticated" on public.subjects;
drop policy if exists "subjects_select_teacher_or_enrolled" on public.subjects;
drop policy if exists "subjects_select_authorized" on public.subjects;
create policy "subjects_select_authorized"
on public.subjects
for select
to authenticated
using (
  public.is_admin()
  or (teacher_id = auth.uid() and public.is_active_teacher())
  or (
    coalesce(active, true)
    and not coalesce(is_archived, false)
    and public.is_subject_enrolled(subjects.id)
  )
);

revoke all on table public.subjects from public, anon, authenticated;
grant select on table public.subjects to authenticated;

revoke select on table public.questions, public.answers from public, anon;
grant select on table public.questions, public.answers to authenticated;

drop policy if exists "subjects_insert_own_teacher" on public.subjects;
drop policy if exists "subjects_insert_active_teacher" on public.subjects;
create policy "subjects_insert_active_teacher"
on public.subjects
for insert
to authenticated
with check (teacher_id = auth.uid() and public.is_active_teacher());

drop policy if exists "subjects_update_own_teacher" on public.subjects;
drop policy if exists "subjects_update_active_teacher" on public.subjects;
create policy "subjects_update_active_teacher"
on public.subjects
for update
to authenticated
using (teacher_id = auth.uid() and public.is_active_teacher())
with check (teacher_id = auth.uid() and public.is_active_teacher());

drop policy if exists "subjects_delete_own_teacher" on public.subjects;
drop policy if exists "subjects_delete_active_teacher" on public.subjects;
create policy "subjects_delete_active_teacher"
on public.subjects
for delete
to authenticated
using (teacher_id = auth.uid() and public.is_active_teacher());

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
  if coalesce(auth.role(), '') <> 'service_role' then
    if not public.is_active_teacher() or not exists (
      select 1
      from public.subjects
      where id = p_subject_id
        and teacher_id = auth.uid()
    ) then
      raise exception 'Course not found or access denied';
    end if;
  end if;

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

revoke all on function public.ensure_default_classroom(bigint) from public, anon;
grant execute on function public.ensure_default_classroom(bigint) to authenticated, service_role;

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

revoke all on function public.create_subject_with_default_topic(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_subject_with_default_topic(text, text, text, text, text, text, text, text) to authenticated;

create or replace function public.is_invite_code_available(
  p_code text,
  p_exclude_subject_id bigint default null,
  p_exclude_classroom_id bigint default null
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not public.is_active_teacher() then
    raise exception 'Teacher access required';
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    return false;
  end if;

  return not exists (
    select 1
    from public.subjects
    where code = v_code
      and (p_exclude_subject_id is null or id <> p_exclude_subject_id)
  ) and not exists (
    select 1
    from public.classrooms
    where code = v_code
      and (p_exclude_classroom_id is null or id <> p_exclude_classroom_id)
  );
end;
$$;

revoke all on function public.is_invite_code_available(text, bigint, bigint) from public, anon;
grant execute on function public.is_invite_code_available(text, bigint, bigint) to authenticated;

revoke all on function public.delete_user_relational_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_relational_data(uuid) to service_role;

revoke all on function public.detect_teacher_audit_anomalies() from public, anon, authenticated;
grant execute on function public.detect_teacher_audit_anomalies() to service_role;

revoke all on function public.generate_unique_subject_code() from public, anon;
grant execute on function public.generate_unique_subject_code() to authenticated, service_role;

revoke all on function public.get_admin_dashboard_metrics() from public, anon;
grant execute on function public.get_admin_dashboard_metrics() to authenticated;

revoke all on function public.get_admin_enrollments_summary() from public, anon;
grant execute on function public.get_admin_enrollments_summary() to authenticated;

revoke all on function public.revoke_user_session(uuid) from public, anon;
grant execute on function public.revoke_user_session(uuid) to authenticated;

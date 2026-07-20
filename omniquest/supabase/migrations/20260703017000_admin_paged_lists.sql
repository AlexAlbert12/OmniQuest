create or replace function public.get_admin_profiles_page(
  p_role text default null,
  p_search text default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_profile_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  alias text,
  email text,
  role_id text,
  active boolean,
  created_at timestamptz,
  subject_count integer,
  enrollment_count integer,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  with filtered as (
    select p.*
    from public.profiles p
    where (p_profile_id is null or p.id = p_profile_id)
      and (
        p_role is null
        or (p_role = 'teacher' and p.role_id = 'teacher')
        or (p_role = 'student' and p.role_id in ('student', 'guest'))
        or (p_role = 'admin' and p.role_id = 'admin')
        or (p_role not in ('teacher', 'student', 'admin') and p.role_id = p_role)
      )
      and (
        v_search = ''
        or lower(concat_ws(' ', p.alias, p.email, p.role_id)) like '%' || v_search || '%'
      )
      and (
        p_subject_id is null
        or exists (
          select 1
          from public.enrollments e
          where e.student_id = p.id
            and e.subject_id = p_subject_id
        )
      )
      and (
        p_classroom_id is null
        or exists (
          select 1
          from public.enrollments e
          where e.student_id = p.id
            and e.classroom_id = p_classroom_id
        )
      )
  )
  select
    filtered.id,
    filtered.alias,
    filtered.email,
    filtered.role_id,
    filtered.active,
    filtered.created_at,
    (
      select count(*)::integer
      from public.subjects s
      where s.teacher_id = filtered.id
    ) as subject_count,
    (
      select count(*)::integer
      from public.enrollments e
      where e.student_id = filtered.id
    ) as enrollment_count,
    count(*) over()::bigint as total_count
  from filtered
  order by filtered.created_at desc nulls last, filtered.alias asc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_admin_subjects_page(
  p_search text default null,
  p_teacher_id uuid default null,
  p_archived boolean default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint,
  name text,
  teacher_id uuid,
  active boolean,
  is_archived boolean,
  created_at timestamptz,
  teacher_alias text,
  teacher_email text,
  classes_count integer,
  enrollments_count integer,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  with filtered as (
    select s.*, p.alias as teacher_alias, p.email as teacher_email
    from public.subjects s
    left join public.profiles p on p.id = s.teacher_id
    where (p_teacher_id is null or s.teacher_id = p_teacher_id)
      and (p_archived is null or coalesce(s.is_archived, false) = p_archived)
      and (
        v_search = ''
        or lower(concat_ws(' ', s.name, p.alias, p.email)) like '%' || v_search || '%'
      )
  )
  select
    filtered.id,
    filtered.name,
    filtered.teacher_id,
    filtered.active,
    filtered.is_archived,
    filtered.created_at,
    filtered.teacher_alias,
    filtered.teacher_email,
    (
      select count(*)::integer
      from public.classrooms c
      where c.subject_id = filtered.id
    ) as classes_count,
    (
      select count(*)::integer
      from public.enrollments e
      where e.subject_id = filtered.id
    ) as enrollments_count,
    count(*) over()::bigint as total_count
  from filtered
  order by filtered.created_at desc nulls last, filtered.name asc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_admin_classrooms_page(
  p_search text default null,
  p_subject_id bigint default null,
  p_student_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint,
  subject_id bigint,
  name text,
  code text,
  active boolean,
  created_at timestamptz,
  subject_name text,
  enrollments_count integer,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  with filtered as (
    select c.*, s.name as subject_name
    from public.classrooms c
    left join public.subjects s on s.id = c.subject_id
    where (p_subject_id is null or c.subject_id = p_subject_id)
      and (
        p_student_id is null
        or exists (
          select 1
          from public.enrollments e
          where e.classroom_id = c.id
            and e.student_id = p_student_id
        )
      )
      and (
        v_search = ''
        or lower(concat_ws(' ', c.name, c.code, s.name)) like '%' || v_search || '%'
      )
  )
  select
    filtered.id,
    filtered.subject_id,
    filtered.name,
    filtered.code,
    filtered.active,
    filtered.created_at,
    filtered.subject_name,
    (
      select count(*)::integer
      from public.enrollments e
      where e.classroom_id = filtered.id
    ) as enrollments_count,
    count(*) over()::bigint as total_count
  from filtered
  order by filtered.created_at desc nulls last, filtered.name asc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_admin_enrollments_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_by_subject jsonb := '[]'::jsonb;
  v_by_classroom jsonb := '[]'::jsonb;
  v_by_student jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  select count(*)::integer
  into v_total
  from public.enrollments;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject_id', subject_id,
    'enrollments_count', enrollments_count
  ) order by enrollments_count desc), '[]'::jsonb)
  into v_by_subject
  from (
    select subject_id, count(*)::integer as enrollments_count
    from public.enrollments
    group by subject_id
    order by count(*) desc
    limit 100
  ) rows;

  select coalesce(jsonb_agg(jsonb_build_object(
    'classroom_id', classroom_id,
    'enrollments_count', enrollments_count
  ) order by enrollments_count desc), '[]'::jsonb)
  into v_by_classroom
  from (
    select classroom_id, count(*)::integer as enrollments_count
    from public.enrollments
    where classroom_id is not null
    group by classroom_id
    order by count(*) desc
    limit 100
  ) rows;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', student_id,
    'enrollments_count', enrollments_count
  ) order by enrollments_count desc), '[]'::jsonb)
  into v_by_student
  from (
    select student_id, count(*)::integer as enrollments_count
    from public.enrollments
    group by student_id
    order by count(*) desc
    limit 100
  ) rows;

  return jsonb_build_object(
    'total', v_total,
    'by_subject', v_by_subject,
    'by_classroom', v_by_classroom,
    'by_student', v_by_student
  );
end;
$$;

grant execute on function public.get_admin_profiles_page(text, text, bigint, bigint, uuid, integer, integer) to authenticated;
grant execute on function public.get_admin_subjects_page(text, uuid, boolean, integer, integer) to authenticated;
grant execute on function public.get_admin_classrooms_page(text, bigint, uuid, integer, integer) to authenticated;
grant execute on function public.get_admin_enrollments_summary() to authenticated;

notify pgrst, 'reload schema';
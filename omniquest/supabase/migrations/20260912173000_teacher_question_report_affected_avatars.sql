create or replace function public.get_teacher_question_affected_students_page(
  p_question_id bigint,
  p_classroom_id bigint default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    where q.id = p_question_id
      and (public.is_admin() or s.teacher_id = v_user_id)
  ) then
    raise exception 'Question report access denied';
  end if;

  with attempts as (
    select
      ah.*,
      coalesce(ga.classroom_id, q.classroom_id) as resolved_classroom_id
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.game_attempts ga on ga.id = ah.attempt_id
    where ah.question_id = p_question_id
      and not ah.is_correct
      and (p_classroom_id is null or coalesce(ga.classroom_id, q.classroom_id) = p_classroom_id)
      and (p_date_from is null or ah.attempted_at >= p_date_from)
      and (p_date_to is null or ah.attempted_at < p_date_to)
  ), grouped as (
    select
      a.student_id,
      coalesce(p.alias, 'Alumno') as alias,
      p.avatar,
      count(*)::integer as failures,
      count(*)::integer as attempts,
      round(avg(a.time_taken_seconds) filter (where a.time_taken_seconds is not null), 1) as average_time_seconds,
      max(a.attempted_at) as last_attempt_at,
      coalesce(max(c.name), 'Sin clase') as classroom_name
    from attempts a
    left join public.profiles p on p.id = a.student_id
    left join public.classrooms c on c.id = a.resolved_classroom_id
    group by a.student_id, p.alias, p.avatar
  ), page as (
    select *
    from grouped
    order by failures desc, last_attempt_at desc nulls last
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(page) order by failures desc, last_attempt_at desc nulls last)
      from page
    ), '[]'::jsonb),
    'total', (select count(*) from grouped)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_question_affected_students_page(bigint,bigint,timestamptz,timestamptz,integer,integer) from public, anon;
grant execute on function public.get_teacher_question_affected_students_page(bigint,bigint,timestamptz,timestamptz,integer,integer) to authenticated;

create or replace function public.get_weekly_ranking_profiles(
  p_limit integer default 50
)
returns table (
  id uuid,
  alias text,
  avatar text,
  points integer,
  visibility text,
  weekly_points integer
)
language sql
security definer
set search_path = public
as $$
  with params as (
    select (date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') as week_start
  ),
  weekly as (
    select
      ah.student_id,
      coalesce(sum(coalesce(ah.earned_points, 0)), 0)::integer as weekly_points
    from public.attempt_history ah
    cross join params
    where coalesce(ah.attempted_at, ah.created_at) >= params.week_start
    group by ah.student_id
  )
  select
    p.id,
    p.alias,
    p.avatar,
    coalesce(p.points, 0)::integer as points,
    coalesce(p.visibility, 'public') as visibility,
    coalesce(w.weekly_points, 0)::integer as weekly_points
  from weekly w
  join public.profiles p on p.id = w.student_id
  where p.role_id = 'student'
    and coalesce(p.active, true) = true
    and coalesce(w.weekly_points, 0) > 0
    and (
      coalesce(p.visibility, 'public') <> 'private'
      or p.id = auth.uid()
    )
  order by coalesce(w.weekly_points, 0) desc, p.alias asc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

create or replace function public.get_class_weekly_ranking_profiles(
  p_classroom_id bigint,
  p_limit integer default 50
)
returns table (
  id uuid,
  alias text,
  avatar text,
  points integer,
  visibility text,
  weekly_points integer
)
language sql
security definer
set search_path = public
as $$
  with params as (
    select (date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') as week_start
  ),
  class_context as (
    select c.id, c.subject_id, s.teacher_id
    from public.classrooms c
    join public.subjects s on s.id = c.subject_id
    where c.id = p_classroom_id
      and coalesce(c.active, true) = true
      and coalesce(s.is_archived, false) = false
  ),
  allowed as (
    select exists (
      select 1
      from class_context cc
      where cc.teacher_id = auth.uid()
         or exists (
           select 1
           from public.enrollments e
           where e.classroom_id = cc.id
             and e.student_id = auth.uid()
         )
    ) as can_read
  ),
  weekly as (
    select
      ah.student_id,
      coalesce(sum(coalesce(ah.earned_points, 0)), 0)::integer as weekly_points
    from class_context cc
    cross join allowed a
    cross join params
    join public.enrollments e
      on e.classroom_id = cc.id
     and e.subject_id = cc.subject_id
    join public.attempt_history ah
      on ah.student_id = e.student_id
    join public.questions q
      on q.id = ah.question_id
     and q.subject_id = cc.subject_id
     and (q.classroom_id is null or q.classroom_id = cc.id)
    where a.can_read
      and coalesce(ah.attempted_at, ah.created_at) >= params.week_start
    group by ah.student_id
  )
  select
    p.id,
    p.alias,
    p.avatar,
    coalesce(p.points, 0)::integer as points,
    coalesce(p.visibility, 'public') as visibility,
    coalesce(w.weekly_points, 0)::integer as weekly_points
  from weekly w
  join public.profiles p on p.id = w.student_id
  where p.role_id = 'student'
    and coalesce(p.active, true) = true
    and coalesce(w.weekly_points, 0) > 0
    and (
      coalesce(p.visibility, 'public') <> 'private'
      or p.id = auth.uid()
    )
  order by coalesce(w.weekly_points, 0) desc, p.alias asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.get_weekly_ranking_profiles(integer) to authenticated;
grant execute on function public.get_class_weekly_ranking_profiles(bigint, integer) to authenticated;

comment on function public.get_weekly_ranking_profiles(integer) is
  'Devuelve ranking semanal agregado en servidor desde attempt_history.earned_points sin exponer intentos ni emails.';
comment on function public.get_class_weekly_ranking_profiles(bigint, integer) is
  'Devuelve ranking semanal de una clase para usuarios autorizados, agregado en servidor y respetando visibility.';

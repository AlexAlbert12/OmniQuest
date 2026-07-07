create or replace function public.get_ranking_profiles(
  p_limit integer default 50
)
returns table (
  id uuid,
  alias text,
  avatar text,
  points integer,
  visibility text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.alias,
    p.avatar,
    coalesce(p.points, 0)::integer as points,
    coalesce(p.visibility, 'public') as visibility
  from public.profiles p
  where p.role_id = 'student'
    and coalesce(p.active, true) = true
    and (
      coalesce(p.visibility, 'public') <> 'private'
      or p.id = auth.uid()
    )
  order by coalesce(p.points, 0) desc, p.alias asc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

create or replace function public.get_class_ranking_profiles(
  p_classroom_id bigint,
  p_limit integer default 50
)
returns table (
  id uuid,
  alias text,
  avatar text,
  points integer,
  visibility text
)
language sql
security definer
set search_path = public
as $$
  with class_context as (
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
  )
  select
    p.id,
    p.alias,
    p.avatar,
    coalesce(max(ss.max_score), 0)::integer as points,
    coalesce(p.visibility, 'public') as visibility
  from class_context cc
  cross join allowed a
  join public.enrollments e on e.classroom_id = cc.id
  join public.profiles p on p.id = e.student_id
  left join public.subject_scores ss
    on ss.student_id = p.id
   and ss.classroom_id = cc.id
  where a.can_read
    and p.role_id = 'student'
    and coalesce(p.active, true) = true
    and (
      coalesce(p.visibility, 'public') <> 'private'
      or p.id = auth.uid()
    )
  group by p.id, p.alias, p.avatar, p.visibility
  order by coalesce(max(ss.max_score), 0) desc, p.alias asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.get_ranking_profiles(integer) to authenticated;
grant execute on function public.get_class_ranking_profiles(bigint, integer) to authenticated;

comment on function public.get_ranking_profiles(integer) is
  'Devuelve tarjetas públicas para ranking sin exponer email ni datos privados de profiles.';
comment on function public.get_class_ranking_profiles(bigint, integer) is
  'Devuelve ranking de una clase para usuarios autorizados sin exponer columnas privadas de profiles.';

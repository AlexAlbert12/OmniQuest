-- Group topic changes under the teacher-facing Courses audit filter.
create or replace function public.get_teacher_audit_logs_page(
  p_category text default 'all',
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  teacher_id uuid,
  action text,
  target_table text,
  target_id text,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_category text := lower(coalesce(nullif(trim(p_category), ''), 'all'));
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role_id = 'teacher'
  ) then
    raise exception 'Teacher access required';
  end if;

  return query
  with filtered as (
    select l.*
    from public.teacher_audit_logs l
    where (public.is_admin() or l.teacher_id = v_user_id)
      and (
        v_category = 'all'
        or (v_category = 'student' and (l.target_table in ('profiles', 'enrollments', 'subject_scores', 'topic_scores') or l.action ilike '%student%'))
        or (v_category = 'question' and (l.target_table in ('questions', 'answers') or l.action ilike '%question%'))
        or (v_category = 'subject' and (
          l.target_table in ('subjects', 'subject_topics')
          or l.action ilike '%subject%'
          or l.action ilike '%course%'
          or l.action ilike '%topic%'
        ))
        or (v_category = 'code' and (l.action ilike '%code%' or l.target_table = 'classrooms'))
        or (v_category = 'profile' and (l.action ilike '%profile%' or l.target_table = 'profiles'))
      )
      and (
        v_search is null
        or concat_ws(' ', l.action, l.target_table, l.target_id, l.metadata::text) ilike '%' || v_search || '%'
      )
  )
  select
    f.id,
    f.teacher_id,
    f.action,
    f.target_table,
    f.target_id,
    f.metadata,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc, f.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.get_teacher_audit_logs_page(text, text, integer, integer) from public, anon;
grant execute on function public.get_teacher_audit_logs_page(text, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';

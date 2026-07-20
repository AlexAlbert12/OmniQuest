-- Server-side pagination for audit logs, rankings and activity histories.

create or replace function public.get_admin_audit_logs_page(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  admin_id uuid,
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
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  with filtered as (
    select l.*
    from public.admin_audit_logs l
    left join public.profiles p on p.id = l.admin_id
    where v_search is null
       or concat_ws(' ', l.action, l.target_table, l.target_id, l.metadata::text, p.alias) ilike '%' || v_search || '%'
  )
  select
    f.id,
    f.admin_id,
    f.action,
    f.target_table,
    f.target_id,
    f.metadata,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc, f.id desc
  limit v_limit offset v_offset;
end;
$$;

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
        or (v_category = 'subject' and (l.target_table = 'subjects' or l.action ilike '%subject%' or l.action ilike '%course%'))
        or (v_category = 'topic' and (l.target_table = 'subject_topics' or l.action ilike '%topic%'))
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
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_ranking_profiles_page(
  p_scope text default 'weekly',
  p_classroom_id bigint default null,
  p_min_points integer default null,
  p_max_points integer default null,
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
  v_scope text := lower(coalesce(nullif(trim(p_scope), ''), 'weekly'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if v_scope not in ('global', 'weekly', 'class') then
    raise exception 'Unsupported ranking scope';
  end if;

  if v_scope = 'class' then
    if p_classroom_id is null then
      raise exception 'Classroom is required';
    end if;

    if not exists (
      select 1
      from public.classrooms c
      join public.subjects s on s.id = c.subject_id
      where c.id = p_classroom_id
        and (s.teacher_id = v_user_id or public.is_admin() or exists (
          select 1 from public.enrollments e
          where e.classroom_id = c.id and e.student_id = v_user_id
        ))
    ) then
      raise exception 'Classroom access denied';
    end if;
  end if;

  if v_scope = 'global' then
    with base as (
      select p.id, p.alias, p.avatar, coalesce(p.points, 0)::integer as points, coalesce(p.visibility, 'public') as visibility
      from public.profiles p
      where p.role_id = 'student'
        and coalesce(p.active, true)
        and (coalesce(p.visibility, 'public') <> 'private' or p.id = v_user_id)
        and (p_min_points is null or coalesce(p.points, 0) >= p_min_points)
        and (p_max_points is null or coalesce(p.points, 0) < p_max_points)
    ), ranked as (
      select b.*, row_number() over(order by b.points desc, b.alias asc)::bigint as rank, count(*) over()::bigint as total_count
      from base b
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (select * from ranked order by rank limit v_limit offset v_offset) r), '[]'::jsonb),
      'total', coalesce((select max(total_count) from ranked), 0),
      'current', (select to_jsonb(r) from ranked r where r.id = v_user_id limit 1)
    ) into v_result;
  elsif v_scope = 'weekly' then
    with params as (
      select (date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') as week_start
    ), weekly as (
      select ah.student_id, coalesce(sum(coalesce(ah.earned_points, 0)), 0)::integer as points
      from public.attempt_history ah cross join params
      where coalesce(ah.attempted_at, ah.created_at) >= params.week_start
      group by ah.student_id
    ), base as (
      select p.id, p.alias, p.avatar, w.points, coalesce(p.visibility, 'public') as visibility, w.points as weekly_points
      from weekly w join public.profiles p on p.id = w.student_id
      where p.role_id = 'student' and coalesce(p.active, true) and w.points > 0
        and (coalesce(p.visibility, 'public') <> 'private' or p.id = v_user_id)
        and (p_min_points is null or w.points >= p_min_points)
        and (p_max_points is null or w.points < p_max_points)
    ), ranked as (
      select b.*, row_number() over(order by b.points desc, b.alias asc)::bigint as rank, count(*) over()::bigint as total_count
      from base b
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (select * from ranked order by rank limit v_limit offset v_offset) r), '[]'::jsonb),
      'total', coalesce((select max(total_count) from ranked), 0),
      'current', (select to_jsonb(r) from ranked r where r.id = v_user_id limit 1)
    ) into v_result;
  else
    with base as (
      select p.id, p.alias, p.avatar, coalesce(max(ss.max_score), 0)::integer as points, coalesce(p.visibility, 'public') as visibility
      from public.enrollments e
      join public.profiles p on p.id = e.student_id
      left join public.subject_scores ss on ss.student_id = p.id and ss.classroom_id = e.classroom_id
      where e.classroom_id = p_classroom_id
        and p.role_id = 'student'
        and coalesce(p.active, true)
        and (coalesce(p.visibility, 'public') <> 'private' or p.id = v_user_id)
      group by p.id, p.alias, p.avatar, p.visibility
      having (p_min_points is null or coalesce(max(ss.max_score), 0) >= p_min_points)
         and (p_max_points is null or coalesce(max(ss.max_score), 0) < p_max_points)
    ), ranked as (
      select b.*, row_number() over(order by b.points desc, b.alias asc)::bigint as rank, count(*) over()::bigint as total_count
      from base b
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (select * from ranked order by rank limit v_limit offset v_offset) r), '[]'::jsonb),
      'total', coalesce((select max(total_count) from ranked), 0),
      'current', (select to_jsonb(r) from ranked r where r.id = v_user_id limit 1)
    ) into v_result;
  end if;

  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'total', 0, 'current', null));
end;
$$;

create or replace function public.get_student_attempt_history_page(
  p_status text default 'all',
  p_search text default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_difficulty integer default null,
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
  v_status text := lower(coalesce(nullif(trim(p_status), ''), 'all'));
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'No authenticated user'; end if;

  with filtered as (
    select ah.*, q.text as question_text, q.type as question_type, q.difficulty, q.subject_id, q.classroom_id, q.topic_id,
           s.name as subject_name, st.title as topic_title
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.subjects s on s.id = q.subject_id
    left join public.subject_topics st on st.id = q.topic_id
    where ah.student_id = v_user_id
      and (v_status = 'all' or (v_status = 'correct' and ah.is_correct) or (v_status = 'incorrect' and not ah.is_correct))
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
      and (p_topic_id is null or q.topic_id = p_topic_id)
      and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
      and (v_search is null or concat_ws(' ', q.text, s.name, st.title, ah.submitted_answer_text) ilike '%' || v_search || '%')
  ), ranked as (
    select f.*, count(*) over()::bigint as total_count
    from filtered f
  ), page as (
    select * from ranked order by attempted_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'question_id', p.question_id,
      'answer_id', p.answer_id,
      'is_correct', p.is_correct,
      'time_taken_seconds', p.time_taken_seconds,
      'attempted_at', p.attempted_at,
      'submitted_answer_text', p.submitted_answer_text,
      'submitted_answer_payload', p.submitted_answer_payload,
      'earned_points', p.earned_points,
      'hint_used', p.hint_used,
      'was_skipped', p.was_skipped,
      'manual_review_status', p.manual_review_status,
      'questions', jsonb_build_object(
        'id', p.question_id,
        'text', p.question_text,
        'type', p.question_type,
        'difficulty', coalesce(p.difficulty, 1),
        'subject_id', p.subject_id,
        'classroom_id', p.classroom_id,
        'topic_id', p.topic_id,
        'explanation', null,
        'subjects', jsonb_build_object('id', p.subject_id, 'name', p.subject_name),
        'subject_topics', case when p.topic_id is null then null else jsonb_build_object('id', p.topic_id, 'title', p.topic_title) end,
        'answers', '[]'::jsonb
      )
    ) order by p.attempted_at desc, p.id desc), '[]'::jsonb),
    'total', coalesce(max(p.total_count), 0)
  ) into v_result
  from page p;

  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'total', 0));
end;
$$;

create or replace function public.get_teacher_student_attempts_page(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'No authenticated user'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_user_id
  ) then
    raise exception 'Student history access denied';
  end if;

  with filtered as (
    select ah.*, q.text as question_text, q.type as question_type, q.subject_id, q.classroom_id, q.topic_id,
      q.difficulty, q.explanation, s.name as subject_name, s.teacher_id as subject_teacher_id, c.name as classroom_name, c.code as classroom_code,
      st.title as topic_title, a.text as answer_text
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id
    left join public.classrooms c on c.id = q.classroom_id
    left join public.subject_topics st on st.id = q.topic_id
    left join public.answers a on a.id = ah.answer_id
    where ah.student_id = p_student_id
      and (public.is_admin() or s.teacher_id = v_user_id)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
  ), ranked as (
    select f.*, count(*) over()::bigint as total_count from filtered f
  ), page as (
    select * from ranked order by attempted_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'student_id', p.student_id, 'question_id', p.question_id, 'answer_id', p.answer_id,
      'is_correct', p.is_correct, 'time_taken_seconds', p.time_taken_seconds, 'attempted_at', p.attempted_at,
      'created_at', p.created_at, 'earned_points', p.earned_points, 'hint_used', p.hint_used,
      'was_skipped', p.was_skipped, 'submitted_answer_text', p.submitted_answer_text,
      'submitted_answer_payload', p.submitted_answer_payload, 'manual_review_status', p.manual_review_status,
      'reviewed_at', p.reviewed_at, 'review_notes', p.review_notes,
      'answers', case when p.answer_id is null then null else jsonb_build_object('id', p.answer_id, 'text', p.answer_text) end,
      'questions', jsonb_build_object(
        'id', p.question_id, 'text', p.question_text, 'type', p.question_type, 'subject_id', p.subject_id,
        'classroom_id', p.classroom_id, 'topic_id', p.topic_id, 'difficulty', p.difficulty, 'explanation', p.explanation,
        'subjects', jsonb_build_object('id', p.subject_id, 'name', p.subject_name, 'teacher_id', p.subject_teacher_id),
        'classrooms', case when p.classroom_id is null then null else jsonb_build_object('id', p.classroom_id, 'name', p.classroom_name, 'code', p.classroom_code) end,
        'subject_topics', case when p.topic_id is null then null else jsonb_build_object('id', p.topic_id, 'title', p.topic_title) end
      )
    ) order by p.attempted_at desc, p.id desc), '[]'::jsonb),
    'total', coalesce(max(p.total_count), 0)
  ) into v_result from page p;

  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'total', 0));
end;
$$;

revoke all on function public.get_admin_audit_logs_page(text, integer, integer) from public, anon;
revoke all on function public.get_teacher_audit_logs_page(text, text, integer, integer) from public, anon;
revoke all on function public.get_ranking_profiles_page(text, bigint, integer, integer, integer, integer) from public, anon;
revoke all on function public.get_student_attempt_history_page(text, text, bigint, bigint, bigint, integer, integer, integer) from public, anon;
revoke all on function public.get_teacher_student_attempts_page(uuid, bigint, bigint, integer, integer) from public, anon;

grant execute on function public.get_admin_audit_logs_page(text, integer, integer) to authenticated;
grant execute on function public.get_teacher_audit_logs_page(text, text, integer, integer) to authenticated;
grant execute on function public.get_ranking_profiles_page(text, bigint, integer, integer, integer, integer) to authenticated;
grant execute on function public.get_student_attempt_history_page(text, text, bigint, bigint, bigint, integer, integer, integer) to authenticated;
grant execute on function public.get_teacher_student_attempts_page(uuid, bigint, bigint, integer, integer) to authenticated;

notify pgrst, 'reload schema';

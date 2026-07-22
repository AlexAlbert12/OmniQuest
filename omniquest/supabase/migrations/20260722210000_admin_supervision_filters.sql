-- Advanced administration filters, supervision data and profile activity.
-- Replaces the previous paged RPCs with richer, server-filtered versions.

create index if not exists profiles_role_active_created_idx
  on public.profiles(role_id, active, created_at desc);
create index if not exists attempt_history_student_attempted_idx
  on public.attempt_history(student_id, attempted_at desc);
create index if not exists attempt_history_question_attempted_idx
  on public.attempt_history(question_id, attempted_at desc);
create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- Directory options used by the advanced filters.
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_directory_filters()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  return jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'teacher_id', s.teacher_id,
        'active', coalesce(s.active, true),
        'is_archived', coalesce(s.is_archived, false)
      ) order by s.name)
      from public.subjects s
    ), '[]'::jsonb),
    'classrooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'subject_id', c.subject_id,
        'subject_name', s.name,
        'active', coalesce(c.active, true)
      ) order by s.name, c.name)
      from public.classrooms c
      left join public.subjects s on s.id = c.subject_id
    ), '[]'::jsonb),
    'teachers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'alias', p.alias,
        'email', p.email,
        'active', coalesce(p.active, true)
      ) order by p.alias)
      from public.profiles p
      where p.role_id = 'teacher'
    ), '[]'::jsonb),
    'actors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'alias', p.alias,
        'email', p.email
      ) order by p.alias)
      from public.profiles p
      where p.role_id = 'admin'
    ), '[]'::jsonb),
    'audit_actions', coalesce((
      select jsonb_agg(action order by action)
      from (select distinct l.action from public.admin_audit_logs l) actions
    ), '[]'::jsonb),
    'audit_entities', coalesce((
      select jsonb_agg(target_table order by target_table)
      from (
        select distinct l.target_table
        from public.admin_audit_logs l
        where l.target_table is not null
      ) entities
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_directory_filters() from public, anon;
grant execute on function public.get_admin_directory_filters() to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: real server pagination plus account, role, course/class and date
-- filters. Activity is computed without exposing answer content.
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_profiles_page(text, text, bigint, bigint, uuid, integer, integer);

create or replace function public.get_admin_profiles_page(
  p_role text default null,
  p_search text default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_profile_id uuid default null,
  p_active boolean default null,
  p_activity_state text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
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
  last_activity_at timestamptz,
  activity_state text,
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
  v_activity_state text := lower(trim(coalesce(p_activity_state, 'all')));
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  return query
  with profile_activity as (
    select
      p.*,
      case
        when p.role_id in ('student', 'guest') then (
          select max(ah.attempted_at)
          from public.attempt_history ah
          where ah.student_id = p.id
        )
        when p.role_id = 'teacher' then (
          select max(events.event_at)
          from (
            select max(tal.created_at) as event_at
            from public.teacher_audit_logs tal
            where tal.teacher_id = p.id
            union all
            select max(s.created_at)
            from public.subjects s
            where s.teacher_id = p.id
            union all
            select max(q.created_at)
            from public.questions q
            join public.subjects s on s.id = q.subject_id
            where s.teacher_id = p.id
          ) events
        )
        else (
          select max(l.created_at)
          from public.admin_audit_logs l
          where l.admin_id = p.id
        )
      end as computed_last_activity_at
    from public.profiles p
  ), filtered as (
    select pa.*,
      case
        when pa.computed_last_activity_at is null then 'never'
        when pa.computed_last_activity_at >= now() - interval '30 days' then 'recent'
        else 'inactive'
      end as computed_activity_state
    from profile_activity pa
    where (p_profile_id is null or pa.id = p_profile_id)
      and (
        p_role is null
        or (p_role = 'teacher' and pa.role_id = 'teacher')
        or (p_role = 'student' and pa.role_id in ('student', 'guest'))
        or (p_role = 'admin' and pa.role_id = 'admin')
        or (p_role not in ('teacher', 'student', 'admin') and pa.role_id = p_role)
      )
      and (p_active is null or coalesce(pa.active, true) = p_active)
      and (p_created_from is null or pa.created_at >= p_created_from)
      and (p_created_to is null or pa.created_at <= p_created_to)
      and (
        v_search = ''
        or lower(concat_ws(' ', pa.alias, pa.email, pa.role_id)) like '%' || v_search || '%'
      )
      and (
        p_subject_id is null
        or (pa.role_id = 'teacher' and exists (
          select 1 from public.subjects s
          where s.id = p_subject_id and s.teacher_id = pa.id
        ))
        or (pa.role_id in ('student', 'guest') and exists (
          select 1 from public.enrollments e
          where e.student_id = pa.id and e.subject_id = p_subject_id
        ))
      )
      and (
        p_classroom_id is null
        or (pa.role_id = 'teacher' and exists (
          select 1
          from public.classrooms c
          join public.subjects s on s.id = c.subject_id
          where c.id = p_classroom_id and s.teacher_id = pa.id
        ))
        or (pa.role_id in ('student', 'guest') and exists (
          select 1 from public.enrollments e
          where e.student_id = pa.id and e.classroom_id = p_classroom_id
        ))
      )
  )
  select
    f.id,
    f.alias,
    f.email,
    f.role_id,
    f.active,
    f.created_at,
    (select count(*)::integer from public.subjects s where s.teacher_id = f.id) as subject_count,
    (select count(*)::integer from public.enrollments e where e.student_id = f.id) as enrollment_count,
    f.computed_last_activity_at as last_activity_at,
    f.computed_activity_state as activity_state,
    count(*) over()::bigint as total_count
  from filtered f
  where v_activity_state in ('', 'all') or f.computed_activity_state = v_activity_state
  order by
    case when coalesce(f.active, true) then 0 else 1 end,
    f.computed_last_activity_at desc nulls last,
    f.created_at desc,
    f.alias asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Courses: supervision data, not pedagogical editing.
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_subjects_page(text, uuid, boolean, integer, integer);

create or replace function public.get_admin_subjects_page(
  p_search text default null,
  p_teacher_id uuid default null,
  p_archived boolean default null,
  p_active boolean default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
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
  last_activity_at timestamptz,
  incidents_count integer,
  pending_reviews_count integer,
  inactive_classrooms_count integer,
  missing_code_count integer,
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
      and (p_active is null or coalesce(s.active, true) = p_active)
      and (p_created_from is null or s.created_at >= p_created_from)
      and (p_created_to is null or s.created_at <= p_created_to)
      and (
        v_search = ''
        or lower(concat_ws(' ', s.name, p.alias, p.email, s.code)) like '%' || v_search || '%'
      )
  ), enriched as (
    select
      f.*,
      (select count(*)::integer from public.classrooms c where c.subject_id = f.id) as classes_count,
      (select count(*)::integer from public.enrollments e where e.subject_id = f.id) as enrollments_count,
      (
        select max(ah.attempted_at)
        from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        where q.subject_id = f.id
      ) as last_activity_at,
      (
        select count(*)::integer
        from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        where q.subject_id = f.id
          and ah.manual_review_status in ('pending', 'in_review', 'needs_changes')
      ) as pending_reviews_count,
      (
        select count(*)::integer
        from public.classrooms c
        where c.subject_id = f.id and coalesce(c.active, true) = false
      ) as inactive_classrooms_count,
      (
        select count(*)::integer
        from public.classrooms c
        where c.subject_id = f.id and nullif(trim(coalesce(c.code, '')), '') is null
      ) as missing_code_count
    from filtered f
  )
  select
    e.id,
    e.name,
    e.teacher_id,
    e.active,
    e.is_archived,
    e.created_at,
    e.teacher_alias,
    e.teacher_email,
    e.classes_count,
    e.enrollments_count,
    e.last_activity_at,
    (
      e.pending_reviews_count
      + e.inactive_classrooms_count
      + e.missing_code_count
      + case when coalesce(e.active, true) = false then 1 else 0 end
    )::integer as incidents_count,
    e.pending_reviews_count,
    e.inactive_classrooms_count,
    e.missing_code_count,
    count(*) over()::bigint as total_count
  from enriched e
  order by
    case when coalesce(e.is_archived, false) then 1 else 0 end,
    e.last_activity_at desc nulls last,
    e.created_at desc nulls last,
    e.name asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_subjects_page(text, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_admin_subjects_page(text, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Classrooms: owner, activity and operational incidents.
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_classrooms_page(text, bigint, uuid, integer, integer);

create or replace function public.get_admin_classrooms_page(
  p_search text default null,
  p_subject_id bigint default null,
  p_student_id uuid default null,
  p_teacher_id uuid default null,
  p_active boolean default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
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
  teacher_id uuid,
  teacher_alias text,
  teacher_email text,
  enrollments_count integer,
  last_activity_at timestamptz,
  incidents_count integer,
  pending_reviews_count integer,
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
    select
      c.*,
      s.name as subject_name,
      s.teacher_id,
      p.alias as teacher_alias,
      p.email as teacher_email
    from public.classrooms c
    left join public.subjects s on s.id = c.subject_id
    left join public.profiles p on p.id = s.teacher_id
    where (p_subject_id is null or c.subject_id = p_subject_id)
      and (p_teacher_id is null or s.teacher_id = p_teacher_id)
      and (p_active is null or coalesce(c.active, true) = p_active)
      and (p_created_from is null or c.created_at >= p_created_from)
      and (p_created_to is null or c.created_at <= p_created_to)
      and (
        p_student_id is null
        or exists (
          select 1 from public.enrollments e
          where e.classroom_id = c.id and e.student_id = p_student_id
        )
      )
      and (
        v_search = ''
        or lower(concat_ws(' ', c.name, c.code, s.name, p.alias, p.email)) like '%' || v_search || '%'
      )
  ), enriched as (
    select
      f.*,
      (select count(*)::integer from public.enrollments e where e.classroom_id = f.id) as enrollments_count,
      (
        select max(ah.attempted_at)
        from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        where q.classroom_id = f.id
      ) as last_activity_at,
      (
        select count(*)::integer
        from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        where q.classroom_id = f.id
          and ah.manual_review_status in ('pending', 'in_review', 'needs_changes')
      ) as pending_reviews_count
    from filtered f
  )
  select
    e.id,
    e.subject_id,
    e.name,
    e.code,
    e.active,
    e.created_at,
    e.subject_name,
    e.teacher_id,
    e.teacher_alias,
    e.teacher_email,
    e.enrollments_count,
    e.last_activity_at,
    (
      e.pending_reviews_count
      + case when nullif(trim(coalesce(e.code, '')), '') is null then 1 else 0 end
      + case when coalesce(e.active, true) = false then 1 else 0 end
    )::integer as incidents_count,
    e.pending_reviews_count,
    count(*) over()::bigint as total_count
  from enriched e
  order by
    case when coalesce(e.active, true) then 0 else 1 end,
    e.last_activity_at desc nulls last,
    e.created_at desc,
    e.name asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_classrooms_page(text, bigint, uuid, uuid, boolean, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_admin_classrooms_page(text, bigint, uuid, uuid, boolean, timestamptz, timestamptz, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit: complete server-side filtering and derived severity.
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_audit_logs_page(text, integer, integer);

create or replace function public.get_admin_audit_logs_page(
  p_search text default null,
  p_actor_id uuid default null,
  p_action text default null,
  p_target_table text default null,
  p_target_id text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_severity text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  admin_id uuid,
  actor_alias text,
  actor_email text,
  action text,
  target_table text,
  target_id text,
  severity text,
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
  v_severity text := lower(nullif(trim(coalesce(p_severity, '')), ''));
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  with enriched as (
    select
      l.*,
      p.alias as actor_alias,
      p.email as actor_email,
      case
        when l.action ilike '%delete%'
          or l.action ilike '%remove%'
          or l.action ilike '%critical%'
          or l.action in ('admin.student.delete_progress')
          then 'critical'
        when l.action ilike '%deactivate%'
          or l.action ilike '%archive%'
          or l.action ilike '%reset_password%'
          or l.action ilike '%reset%'
          then 'warning'
        else 'info'
      end as derived_severity
    from public.admin_audit_logs l
    left join public.profiles p on p.id = l.admin_id
  ), filtered as (
    select e.*
    from enriched e
    where (p_actor_id is null or e.admin_id = p_actor_id)
      and (nullif(trim(coalesce(p_action, '')), '') is null or e.action = p_action)
      and (nullif(trim(coalesce(p_target_table, '')), '') is null or e.target_table = p_target_table)
      and (nullif(trim(coalesce(p_target_id, '')), '') is null or e.target_id = p_target_id)
      and (p_from is null or e.created_at >= p_from)
      and (p_to is null or e.created_at <= p_to)
      and (v_severity is null or e.derived_severity = v_severity)
      and (
        v_search is null
        or concat_ws(' ', e.action, e.target_table, e.target_id, e.metadata::text, e.actor_alias, e.actor_email)
          ilike '%' || v_search || '%'
      )
  )
  select
    f.id,
    f.admin_id,
    f.actor_alias,
    f.actor_email,
    f.action,
    f.target_table,
    f.target_id,
    f.derived_severity as severity,
    f.metadata,
    f.created_at,
    count(*) over()::bigint as total_count
  from filtered f
  order by f.created_at desc, f.id desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_audit_logs_page(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.get_admin_audit_logs_page(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile activity: a safe, unified timeline for administration. No answers or
-- correct solutions are exposed.
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_profile_activity_page(
  p_profile_id uuid,
  p_search text default null,
  p_event_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  event_id text,
  profile_id uuid,
  event_type text,
  title text,
  description text,
  entity_table text,
  entity_id text,
  severity text,
  metadata jsonb,
  occurred_at timestamptz,
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
  v_event_type text := lower(nullif(trim(coalesce(p_event_type, '')), ''));
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_profile_id) then
    raise exception 'Usuario no encontrado.';
  end if;

  return query
  with activity as (
    select
      concat('attempt:', ah.id)::text as event_id,
      ah.student_id as profile_id,
      'attempt'::text as event_type,
      case when ah.is_correct then 'Respuesta correcta' else 'Pregunta para practicar' end::text as title,
      concat(coalesce(s.name, 'Curso'), case when st.title is not null then ' · ' || st.title else '' end)::text as description,
      'attempt_history'::text as entity_table,
      ah.id::text as entity_id,
      case when ah.is_correct then 'success' else 'warning' end::text as severity,
      jsonb_build_object(
        'subject_id', q.subject_id,
        'classroom_id', q.classroom_id,
        'topic_id', q.topic_id,
        'earned_points', coalesce(ah.earned_points, 0),
        'manual_review_status', ah.manual_review_status
      ) as metadata,
      ah.attempted_at as occurred_at
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.subjects s on s.id = q.subject_id
    left join public.subject_topics st on st.id = q.topic_id
    where ah.student_id = p_profile_id

    union all

    select
      concat('game:', ga.id)::text,
      ga.student_id,
      'game'::text,
      case ga.status when 'finished' then 'Partida completada' when 'abandoned' then 'Partida abandonada' else 'Partida iniciada' end::text,
      coalesce(s.name, 'Curso')::text,
      'game_attempts'::text,
      ga.id::text,
      case ga.status when 'finished' then 'success' when 'abandoned' then 'warning' else 'info' end::text,
      jsonb_build_object('status', ga.status, 'score', ga.total_score, 'correct_answers', ga.correct_answers),
      coalesce(ga.finished_at, ga.updated_at, ga.started_at)
    from public.game_attempts ga
    left join public.subjects s on s.id = ga.subject_id
    where ga.student_id = p_profile_id

    union all

    select
      concat('badge:', sb.id)::text,
      sb.student_id,
      'badge'::text,
      'Logro desbloqueado'::text,
      concat(sb.badge_id, ' · +', coalesce(sb.reward_xp, 0), ' XP')::text,
      'student_badges'::text,
      sb.id::text,
      'success'::text,
      jsonb_build_object('badge_id', sb.badge_id, 'reward_xp', coalesce(sb.reward_xp, 0)),
      sb.awarded_at
    from public.student_badges sb
    where sb.student_id = p_profile_id

    union all

    select
      concat('enrollment:', e.id)::text,
      e.student_id,
      'enrollment'::text,
      'Inscripción en curso'::text,
      concat(coalesce(s.name, 'Curso'), case when c.name is not null then ' · ' || c.name else '' end)::text,
      'enrollments'::text,
      e.id::text,
      'info'::text,
      jsonb_build_object('subject_id', e.subject_id, 'classroom_id', e.classroom_id),
      e.joined_at
    from public.enrollments e
    left join public.subjects s on s.id = e.subject_id
    left join public.classrooms c on c.id = e.classroom_id
    where e.student_id = p_profile_id

    union all

    select
      concat('teacher-audit:', tal.id)::text,
      tal.teacher_id,
      'teacher_action'::text,
      tal.action::text,
      concat_ws(' · ', tal.target_table, tal.target_id)::text,
      coalesce(tal.target_table, 'teacher_audit_logs')::text,
      tal.target_id,
      case when tal.action ilike '%delete%' then 'critical' when tal.action ilike '%deactivate%' then 'warning' else 'info' end::text,
      tal.metadata,
      tal.created_at
    from public.teacher_audit_logs tal
    where tal.teacher_id = p_profile_id

    union all

    select
      concat('course:', s.id)::text,
      s.teacher_id,
      'course_created'::text,
      'Curso creado'::text,
      s.name::text,
      'subjects'::text,
      s.id::text,
      'info'::text,
      jsonb_build_object('active', coalesce(s.active, true), 'archived', coalesce(s.is_archived, false)),
      s.created_at
    from public.subjects s
    where s.teacher_id = p_profile_id

    union all

    select
      concat('admin-target:', aal.id)::text,
      p_profile_id,
      'admin_action'::text,
      aal.action::text,
      concat_ws(' · ', aal.target_table, aal.target_id)::text,
      coalesce(aal.target_table, 'admin_audit_logs')::text,
      aal.target_id,
      case
        when aal.action ilike '%delete%' then 'critical'
        when aal.action ilike '%deactivate%' or aal.action ilike '%reset%' then 'warning'
        else 'info'
      end::text,
      aal.metadata,
      aal.created_at
    from public.admin_audit_logs aal
    where aal.target_id = p_profile_id::text
       or aal.metadata ->> 'profile_id' = p_profile_id::text
       or aal.metadata ->> 'student_id' = p_profile_id::text
  ), filtered as (
    select a.*
    from activity a
    where (v_event_type is null or a.event_type = v_event_type)
      and (p_from is null or a.occurred_at >= p_from)
      and (p_to is null or a.occurred_at <= p_to)
      and (
        v_search is null
        or concat_ws(' ', a.title, a.description, a.entity_table, a.entity_id, a.metadata::text)
          ilike '%' || v_search || '%'
      )
  )
  select
    f.event_id,
    f.profile_id,
    f.event_type,
    f.title,
    f.description,
    f.entity_table,
    f.entity_id,
    f.severity,
    f.metadata,
    f.occurred_at,
    count(*) over()::bigint as total_count
  from filtered f
  order by f.occurred_at desc nulls last, f.event_id desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_profile_activity_page(uuid, text, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_admin_profile_activity_page(uuid, text, text, timestamptz, timestamptz, integer, integer) to authenticated;

notify pgrst, 'reload schema';

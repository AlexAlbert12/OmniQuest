create or replace function public.can_read_profile(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_profile_id = auth.uid()
    or public.admin_has_permission('users.read')
    or exists (
      select 1
      from public.profiles target_profile
      where target_profile.id = p_profile_id
        and target_profile.role_id in ('student', 'guest')
        and exists (
          select 1
          from public.enrollments enrollment
          join public.subjects subject on subject.id = enrollment.subject_id
          where enrollment.student_id = target_profile.id
            and subject.teacher_id = auth.uid()
            and coalesce(subject.is_archived, false) = false
        )
    )
    or exists (
      select 1
      from public.profiles target_profile
      where target_profile.id = p_profile_id
        and target_profile.role_id = 'teacher'
        and exists (
          select 1
          from public.subjects subject
          join public.enrollments enrollment on enrollment.subject_id = subject.id
          where subject.teacher_id = target_profile.id
            and enrollment.student_id = auth.uid()
            and coalesce(subject.is_archived, false) = false
        )
    );
$$;

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update to authenticated
using (public.admin_has_permission('users.manage'))
with check (public.admin_has_permission('users.manage'));

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
  if not public.admin_has_permission('users.read') then
    raise exception 'Permission denied';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = p_profile_id) then
    raise exception 'Usuario no encontrado.';
  end if;

  return query
  with activity as (
    select
      concat('attempt:', attempt.id)::text as event_id,
      attempt.student_id as profile_id,
      'attempt'::text as event_type,
      case
        when attempt.manual_review_status in ('pending', 'in_review') then 'Respuesta pendiente de revisión'
        when attempt.manual_review_status = 'approved' then 'Respuesta aprobada'
        when attempt.manual_review_status = 'rejected' then 'Respuesta rechazada'
        when attempt.manual_review_status = 'needs_changes' then 'Respuesta con cambios solicitados'
        when attempt.is_correct then 'Respuesta correcta'
        else 'Respuesta incorrecta'
      end::text as title,
      concat(coalesce(subject.name, 'Curso'), case when topic.title is not null then ' · ' || topic.title else '' end)::text as description,
      'attempt_history'::text as entity_table,
      attempt.id::text as entity_id,
      case
        when attempt.manual_review_status in ('pending', 'in_review') then 'info'
        when attempt.manual_review_status = 'approved' then 'success'
        when attempt.manual_review_status in ('rejected', 'needs_changes') then 'warning'
        when attempt.is_correct then 'success'
        else 'warning'
      end::text as severity,
      jsonb_build_object(
        'subject_id', question.subject_id,
        'classroom_id', question.classroom_id,
        'topic_id', question.topic_id,
        'question_text', question.text,
        'earned_points', coalesce(attempt.earned_points, 0),
        'manual_review_status', attempt.manual_review_status
      ) as metadata,
      attempt.attempted_at as occurred_at
    from public.attempt_history attempt
    join public.questions question on question.id = attempt.question_id
    left join public.subjects subject on subject.id = question.subject_id
    left join public.subject_topics topic on topic.id = question.topic_id
    where attempt.student_id = p_profile_id

    union all

    select
      concat('game:', game.id)::text,
      game.student_id,
      'game'::text,
      case game.status when 'finished' then 'Partida completada' when 'abandoned' then 'Partida abandonada' else 'Partida iniciada' end::text,
      coalesce(subject.name, 'Curso')::text,
      'game_attempts'::text,
      game.id::text,
      case game.status when 'finished' then 'success' when 'abandoned' then 'warning' else 'info' end::text,
      jsonb_build_object('status', game.status, 'score', game.total_score, 'correct_answers', game.correct_answers),
      coalesce(game.finished_at, game.updated_at, game.started_at)
    from public.game_attempts game
    left join public.subjects subject on subject.id = game.subject_id
    where game.student_id = p_profile_id

    union all

    select
      concat('badge:', badge.id)::text,
      badge.student_id,
      'badge'::text,
      'Logro desbloqueado'::text,
      concat(badge.badge_id, ' · +', coalesce(badge.reward_xp, 0), ' XP')::text,
      'student_badges'::text,
      badge.id::text,
      'success'::text,
      jsonb_build_object('badge_id', badge.badge_id, 'reward_xp', coalesce(badge.reward_xp, 0)),
      badge.awarded_at
    from public.student_badges badge
    where badge.student_id = p_profile_id

    union all

    select
      concat('enrollment:', enrollment.id)::text,
      enrollment.student_id,
      'enrollment'::text,
      'Inscripción en curso'::text,
      concat(coalesce(subject.name, 'Curso'), case when classroom.name is not null then ' · ' || classroom.name else '' end)::text,
      'enrollments'::text,
      enrollment.id::text,
      'info'::text,
      jsonb_build_object('subject_id', enrollment.subject_id, 'classroom_id', enrollment.classroom_id),
      enrollment.joined_at
    from public.enrollments enrollment
    left join public.subjects subject on subject.id = enrollment.subject_id
    left join public.classrooms classroom on classroom.id = enrollment.classroom_id
    where enrollment.student_id = p_profile_id

    union all

    select
      concat('teacher-audit:', log.id)::text,
      log.teacher_id,
      'teacher_action'::text,
      log.action::text,
      concat_ws(' · ', log.target_table, log.target_id)::text,
      coalesce(log.target_table, 'teacher_audit_logs')::text,
      log.target_id,
      case when log.action ilike '%delete%' then 'critical' when log.action ilike '%deactivate%' then 'warning' else 'info' end::text,
      log.metadata,
      log.created_at
    from public.teacher_audit_logs log
    where log.teacher_id = p_profile_id

    union all

    select
      concat('course:', subject.id)::text,
      subject.teacher_id,
      'course_created'::text,
      'Curso creado'::text,
      subject.name::text,
      'subjects'::text,
      subject.id::text,
      'info'::text,
      jsonb_build_object('active', coalesce(subject.active, true), 'archived', coalesce(subject.is_archived, false)),
      subject.created_at
    from public.subjects subject
    where subject.teacher_id = p_profile_id

    union all

    select
      concat('admin-target:', log.id)::text,
      p_profile_id,
      'admin_action'::text,
      log.action::text,
      concat_ws(' · ', log.target_table, log.target_id)::text,
      coalesce(log.target_table, 'admin_audit_logs')::text,
      log.target_id,
      case when log.action ilike '%delete%' then 'critical' when log.action ilike '%deactivate%' or log.action ilike '%reset%' then 'warning' else 'info' end::text,
      log.metadata,
      log.created_at
    from public.admin_audit_logs log
    where log.target_id = p_profile_id::text
       or log.metadata ->> 'profile_id' = p_profile_id::text
       or log.metadata ->> 'student_id' = p_profile_id::text
  ), filtered as (
    select event.*
    from activity event
    where (v_event_type is null or event.event_type = v_event_type)
      and (p_from is null or event.occurred_at >= p_from)
      and (p_to is null or event.occurred_at <= p_to)
      and (
        v_search is null
        or concat_ws(' ', event.title, event.description, event.entity_table, event.entity_id, event.metadata::text) ilike '%' || v_search || '%'
      )
  )
  select
    event.event_id,
    event.profile_id,
    event.event_type,
    event.title,
    event.description,
    event.entity_table,
    event.entity_id,
    event.severity,
    event.metadata,
    event.occurred_at,
    count(*) over()::bigint as total_count
  from filtered event
  order by event.occurred_at desc nulls last, event.event_id desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.can_read_profile(uuid) from public, anon;
revoke all on function public.get_admin_profile_activity_page(uuid, text, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.can_read_profile(uuid) to authenticated;
grant execute on function public.get_admin_profile_activity_page(uuid, text, text, timestamptz, timestamptz, integer, integer) to authenticated;

comment on function public.can_read_profile(uuid) is 'Controla lectura RLS de profiles: perfil propio, administradores con users.read, profesor de alumno inscrito y alumno inscrito con profesor.';

notify pgrst, 'reload schema';

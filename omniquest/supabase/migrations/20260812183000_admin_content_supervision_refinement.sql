drop function if exists public.get_admin_subjects_page(text, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer);

create function public.get_admin_subjects_page(
  p_search text default null,
  p_subject_id bigint default null,
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
  duplicate_code_count integer,
  expired_code_count integer,
  orphaned boolean,
  archive_reason text,
  archived_at timestamptz,
  retention_until timestamptz,
  deletion_eligible_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('courses.read') then raise exception 'Permission denied'; end if;

  return query
  with filtered as (
    select subject.*, teacher.alias as owner_alias, teacher.email as owner_email
    from public.subjects subject
    left join public.profiles teacher on teacher.id = subject.teacher_id
    where (p_subject_id is null or subject.id = p_subject_id)
      and (p_teacher_id is null or subject.teacher_id = p_teacher_id)
      and (p_archived is null or coalesce(subject.is_archived, false) = p_archived)
      and (p_active is null or coalesce(subject.active, true) = p_active)
      and (p_created_from is null or subject.created_at >= p_created_from)
      and (p_created_to is null or subject.created_at <= p_created_to)
      and (v_search = '' or lower(concat_ws(' ', subject.name, teacher.alias, teacher.email, subject.code)) like '%' || v_search || '%')
  ), enriched as (
    select filtered.*,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id) as classes_count,
      (select count(*)::integer from public.enrollments enrollment where enrollment.subject_id = filtered.id) as enrollments_count,
      (select max(attempt.attempted_at) from public.attempt_history attempt join public.questions question on question.id = attempt.question_id where question.subject_id = filtered.id) as last_activity_at,
      (select count(*)::integer from public.attempt_history attempt join public.questions question on question.id = attempt.question_id where question.subject_id = filtered.id and attempt.manual_review_status in ('pending','in_review','needs_changes')) as pending_reviews_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and coalesce(classroom.active, true) = false) as inactive_classrooms_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and nullif(trim(coalesce(classroom.code, '')), '') is null) as missing_code_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and classroom.code_expires_at is not null and classroom.code_expires_at <= now()) as expired_code_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and nullif(trim(coalesce(classroom.code, '')), '') is not null and exists (select 1 from public.classrooms duplicate where duplicate.id <> classroom.id and lower(trim(coalesce(duplicate.code, ''))) = lower(trim(classroom.code)))) as duplicate_code_count
    from filtered
  )
  select enriched.id, enriched.name, enriched.teacher_id, enriched.active, enriched.is_archived, enriched.created_at,
    enriched.owner_alias, enriched.owner_email, enriched.classes_count, enriched.enrollments_count,
    enriched.last_activity_at,
    (enriched.pending_reviews_count + enriched.inactive_classrooms_count + enriched.missing_code_count + enriched.expired_code_count + enriched.duplicate_code_count + case when enriched.teacher_id is null then 1 else 0 end)::integer,
    enriched.pending_reviews_count, enriched.inactive_classrooms_count, enriched.missing_code_count,
    enriched.duplicate_code_count, enriched.expired_code_count, enriched.teacher_id is null,
    enriched.archive_reason, enriched.archived_at, enriched.retention_until,
    case when enriched.is_archived then enriched.retention_until else null end,
    count(*) over()::bigint
  from enriched
  order by case when enriched.teacher_id is null then 0 else 1 end,
    case when coalesce(enriched.is_archived, false) then 1 else 0 end,
    enriched.last_activity_at desc nulls last, enriched.created_at desc nulls last, enriched.name
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_subjects_page(text, bigint, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_admin_subjects_page(text, bigint, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer) to authenticated;

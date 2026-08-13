update public.attempt_history set manual_review_status = 'pending' where manual_review_status = 'in_review';
update public.attempt_history set manual_review_due_at = null where manual_review_status <> 'pending';

alter table public.attempt_history drop constraint if exists attempt_history_manual_review_status_check;
alter table public.attempt_history add constraint attempt_history_manual_review_status_check check (manual_review_status in ('not_required', 'pending', 'needs_changes', 'approved', 'rejected'));

create or replace function public.prepare_manual_review_sla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_sla_hours integer := 48;
begin
  if new.manual_review_status = 'pending' then
    select s.teacher_id into v_teacher_id from public.questions q join public.subjects s on s.id = q.subject_id where q.id = new.question_id;
    select coalesce(mrs.sla_hours, 48) into v_sla_hours from public.manual_review_settings mrs where mrs.teacher_id = v_teacher_id;
    v_sla_hours := coalesce(v_sla_hours, 48);
    if new.manual_review_due_at is null then new.manual_review_due_at := coalesce(new.attempted_at, new.created_at, now()) + make_interval(hours => v_sla_hours); end if;
  else
    new.manual_review_due_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_manual_review_sla_trigger on public.attempt_history;
create trigger prepare_manual_review_sla_trigger before insert or update of manual_review_status, question_id on public.attempt_history for each row execute function public.prepare_manual_review_sla();

create or replace function public.capture_manual_review_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.manual_review_status is not distinct from new.manual_review_status and old.earned_points is not distinct from new.earned_points then return new; end if;
  insert into public.manual_review_history(attempt_history_id, actor_id, event_type, from_status, to_status, before_state, after_state)
  values (
    new.id,
    auth.uid(),
    case when old.manual_review_status is distinct from new.manual_review_status then 'status_changed' else 'review_updated' end,
    old.manual_review_status,
    new.manual_review_status,
    jsonb_build_object('status', old.manual_review_status, 'earned_points', old.earned_points),
    jsonb_build_object('status', new.manual_review_status, 'earned_points', new.earned_points)
  );
  return new;
end;
$$;

drop trigger if exists capture_manual_review_history_trigger on public.attempt_history;
create trigger capture_manual_review_history_trigger after update of manual_review_status, earned_points on public.attempt_history for each row execute function public.capture_manual_review_history();

drop policy if exists "manual_review_history_select_participants" on public.manual_review_history;
create policy "manual_review_history_select_participants" on public.manual_review_history
for select to authenticated using (
  public.is_admin()
  or exists (
    select 1 from public.attempt_history ah join public.questions q on q.id = ah.question_id join public.subjects s on s.id = q.subject_id
    where ah.id = manual_review_history.attempt_history_id and s.teacher_id = auth.uid()
  )
);

create or replace function public.get_teacher_manual_review_queue(
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_status text default null,
  p_search text default null,
  p_student_id uuid default null,
  p_attempt_id bigint default null,
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
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(coalesce(p_status, '')), '') is not null and p_status not in ('pending', 'needs_changes', 'approved', 'rejected') then raise exception 'Invalid review status'; end if;

  with scope as (
    select
      ah.id,
      ah.student_id,
      coalesce(p.alias, split_part(p.email, '@', 1), 'Alumno') as student_name,
      p.email as student_email,
      ah.question_id,
      q.text as question_text,
      ah.submitted_answer_text as answer_text,
      ah.submitted_answer_payload as answer_payload,
      ah.manual_review_status as status,
      ah.attempted_at,
      ah.reviewed_at,
      ah.review_notes,
      ah.earned_points,
      q.points_base as possible_points,
      ah.time_taken_seconds,
      s.id as subject_id,
      s.name as subject_name,
      c.id as classroom_id,
      coalesce(c.name, 'Sin clase') as classroom_name,
      st.id as topic_id,
      st.title as topic_name,
      ah.manual_review_due_at as due_at,
      case when ah.manual_review_status = 'pending' then greatest(0, extract(epoch from (now() - coalesce(ah.attempted_at, ah.created_at, now())))::bigint) else null end as pending_seconds,
      (ah.manual_review_status = 'pending' and ah.manual_review_due_at is not null and ah.manual_review_due_at < now()) as is_overdue,
      (select count(*) from public.manual_review_comments mrc where mrc.attempt_history_id = ah.id)::integer as comments_count,
      (select mrc.body from public.manual_review_comments mrc where mrc.attempt_history_id = ah.id order by mrc.created_at desc, mrc.id desc limit 1) as latest_comment
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id
    left join public.classrooms c on c.id = coalesce(q.classroom_id, (select ga.classroom_id from public.game_attempts ga where ga.id = ah.attempt_id))
    left join public.subject_topics st on st.id = q.topic_id
    left join public.profiles p on p.id = ah.student_id
    where q.type = 'open_answer'
      and ah.manual_review_status <> 'not_required'
      and (public.is_admin() or s.teacher_id = v_user_id)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or coalesce(q.classroom_id, c.id) = p_classroom_id)
      and (p_student_id is null or ah.student_id = p_student_id)
      and (p_attempt_id is null or ah.id = p_attempt_id)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or q.text ilike '%' || trim(p_search) || '%'
        or coalesce(ah.submitted_answer_text, '') ilike '%' || trim(p_search) || '%'
        or coalesce(p.alias, '') ilike '%' || trim(p_search) || '%'
        or coalesce(p.email, '') ilike '%' || trim(p_search) || '%'
        or s.name ilike '%' || trim(p_search) || '%'
      )
  ), filtered as (
    select * from scope where nullif(trim(coalesce(p_status, '')), '') is null or status = p_status
  ), page as (
    select * from filtered
    order by is_overdue desc, case status when 'pending' then 1 when 'needs_changes' then 2 when 'approved' then 3 else 4 end, due_at asc nulls last, reviewed_at desc nulls last, attempted_at asc, id asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) order by page.is_overdue desc, page.due_at asc nulls last, page.id) from page), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'summary', jsonb_build_object(
      'pending', (select count(*) from scope where status = 'pending'),
      'needs_changes', (select count(*) from scope where status = 'needs_changes'),
      'due_soon', (select count(*) from scope where status = 'pending' and due_at is not null and due_at >= now() and due_at <= now() + interval '24 hours'),
      'overdue', (select count(*) from scope where is_overdue)
    )
  ) into v_result;
  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'summary', jsonb_build_object('pending', 0, 'needs_changes', 0, 'due_soon', 0, 'overdue', 0)));
end;
$$;

create or replace function public.get_manual_review_configuration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher' and coalesce(active, true)) then raise exception 'Teacher access required'; end if;
  insert into public.manual_review_settings(teacher_id) values (v_user_id) on conflict (teacher_id) do nothing;
  select jsonb_build_object(
    'slaHours', (select sla_hours from public.manual_review_settings where teacher_id = v_user_id),
    'templates', coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc) from public.manual_review_comment_templates t where t.teacher_id = v_user_id and t.active), '[]'::jsonb),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name) from public.subjects s where s.teacher_id = v_user_id and not s.is_archived), '[]'::jsonb),
    'classrooms', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'subject_id', c.subject_id, 'name', c.name) order by c.name) from public.classrooms c join public.subjects s on s.id = c.subject_id where s.teacher_id = v_user_id and c.active), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.save_manual_review_settings(p_sla_hours integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher' and coalesce(active, true)) then raise exception 'Teacher access required'; end if;
  if p_sla_hours not between 1 and 720 then raise exception 'Invalid review deadline'; end if;
  insert into public.manual_review_settings(teacher_id, sla_hours, updated_at) values (v_user_id, p_sla_hours, now()) on conflict (teacher_id) do update set sla_hours = excluded.sla_hours, updated_at = now();
  return jsonb_build_object('slaHours', p_sla_hours);
end;
$$;

create or replace function public.save_manual_review_template(p_id uuid, p_title text, p_body text, p_audience text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid := auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher' and coalesce(active, true)) then raise exception 'Teacher access required'; end if;
  if p_audience not in ('student', 'internal') then raise exception 'Invalid audience'; end if;
  if p_id is null then
    insert into public.manual_review_comment_templates(teacher_id, title, body, audience) values (v_user_id, trim(p_title), trim(p_body), p_audience) returning id into v_id;
  else
    update public.manual_review_comment_templates set title = trim(p_title), body = trim(p_body), audience = p_audience, updated_at = now() where id = p_id and teacher_id = v_user_id returning id into v_id;
    if v_id is null then raise exception 'Template not found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.get_manual_review_thread(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id uuid;
  v_teacher_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'No hay sesión activa.'; end if;
  select ah.student_id, s.teacher_id into v_student_id, v_teacher_id from public.attempt_history ah join public.questions q on q.id = ah.question_id join public.subjects s on s.id = q.subject_id where ah.id = p_attempt_history_id;
  if not found then raise exception 'Intento no encontrado.'; end if;
  if v_user_id <> v_student_id and v_user_id <> v_teacher_id and not public.is_admin() then raise exception 'No puedes consultar esta revisión.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'author_id', c.author_id, 'author_name', coalesce(p.alias, split_part(p.email, '@', 1), 'Usuario'), 'audience', c.audience, 'body', c.body, 'created_at', c.created_at) order by c.created_at asc, c.id asc), '[]'::jsonb)
  into v_result
  from public.manual_review_comments c left join public.profiles p on p.id = c.author_id
  where c.attempt_history_id = p_attempt_history_id and (v_user_id = v_teacher_id or public.is_admin() or c.audience = 'student');
  return v_result;
end;
$$;

create or replace function public.add_manual_review_comment(p_attempt_history_id bigint, p_body text, p_audience text default 'student')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment public.manual_review_comments%rowtype;
  v_student_id uuid;
begin
  if v_user_id is null then raise exception 'No hay sesión activa.'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher' and coalesce(active, true)) then raise exception 'Teacher access required'; end if;
  if nullif(trim(coalesce(p_body, '')), '') is null then raise exception 'Escribe un comentario.'; end if;
  if p_audience not in ('student', 'internal') then raise exception 'La visibilidad del comentario no es válida.'; end if;
  select ah.student_id into v_student_id from public.attempt_history ah join public.questions q on q.id = ah.question_id join public.subjects s on s.id = q.subject_id where ah.id = p_attempt_history_id and s.teacher_id = v_user_id;
  if not found then raise exception 'No puedes comentar esta revisión.'; end if;
  insert into public.manual_review_comments(attempt_history_id, author_id, audience, body) values (p_attempt_history_id, v_user_id, p_audience, trim(p_body)) returning * into v_comment;
  if p_audience = 'student' then
    perform public.create_notification(v_student_id, 'student', 'manual_review', 'Nuevo comentario del profesor', left(trim(p_body), 180), 'chatbubble-ellipses-outline', '#A78BFA', '/(student)/activity-log', 'attempt_history', p_attempt_history_id::text, jsonb_build_object('attempt_history_id', p_attempt_history_id), concat('manual-review-comment:', v_comment.id));
  end if;
  return to_jsonb(v_comment);
end;
$$;

drop function if exists public.review_open_answer_attempt(bigint, boolean, text);
revoke all on function public.review_open_answer_attempt_v2(bigint, text, text, text) from public, anon, authenticated;

drop function if exists public.batch_review_manual_attempts(bigint[], text, text, text, uuid, jsonb);
drop function if exists public.review_manual_review_attempt(bigint, text, text, text, uuid, jsonb);
drop function if exists public.review_open_answer_attempt_assigned(bigint, text, text, text);

create function public.review_manual_review_attempt(p_attempt_history_id bigint, p_status text, p_notes text default null, p_comment_audience text default 'student')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_status text;
  v_owner uuid;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher' and coalesce(active, true)) then raise exception 'Teacher access required'; end if;
  if p_status not in ('approved', 'rejected', 'needs_changes') then raise exception 'Invalid review status'; end if;
  if p_comment_audience not in ('student', 'internal') then raise exception 'Invalid comment audience'; end if;
  if p_status in ('rejected', 'needs_changes') and (nullif(trim(coalesce(p_notes, '')), '') is null or p_comment_audience <> 'student') then raise exception 'A student-visible comment is required for this decision'; end if;
  select ah.manual_review_status, s.teacher_id into v_previous_status, v_owner from public.attempt_history ah join public.questions q on q.id = ah.question_id join public.subjects s on s.id = q.subject_id where ah.id = p_attempt_history_id for update of ah;
  if not found then raise exception 'Review not found'; end if;
  if v_owner <> v_user_id then raise exception 'Review access denied'; end if;
  if v_previous_status = 'not_required' then raise exception 'This answer does not require manual review'; end if;

  if v_previous_status is distinct from p_status then
    select public.review_open_answer_attempt_v2(p_attempt_history_id, p_status, p_notes, p_comment_audience) into v_result;
  else
    if nullif(trim(coalesce(p_notes, '')), '') is not null then perform public.add_manual_review_comment(p_attempt_history_id, p_notes, p_comment_audience); end if;
    select jsonb_build_object('id', ah.id, 'manual_review_status', ah.manual_review_status, 'earned_points', ah.earned_points) into v_result from public.attempt_history ah where ah.id = p_attempt_history_id;
  end if;
  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object('statusChanged', v_previous_status is distinct from p_status);
end;
$$;

create function public.batch_review_manual_attempts(p_attempt_ids bigint[], p_status text, p_notes text default null, p_comment_audience text default 'student')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id bigint;
  v_requested integer;
  v_allowed integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher' and coalesce(active, true)) then raise exception 'Teacher access required'; end if;
  if p_status not in ('approved', 'rejected', 'needs_changes') then raise exception 'Invalid review status'; end if;
  if p_comment_audience not in ('student', 'internal') then raise exception 'Invalid comment audience'; end if;
  if p_status in ('rejected', 'needs_changes') and (nullif(trim(coalesce(p_notes, '')), '') is null or p_comment_audience <> 'student') then raise exception 'A student-visible comment is required for this decision'; end if;

  select count(*) into v_requested from (select distinct id from unnest(coalesce(p_attempt_ids, '{}'::bigint[])) as ids(id)) requested;
  if v_requested = 0 then raise exception 'Select at least one review'; end if;
  select count(*) into v_allowed
  from public.attempt_history ah join public.questions q on q.id = ah.question_id join public.subjects s on s.id = q.subject_id
  where ah.id in (select distinct id from unnest(coalesce(p_attempt_ids, '{}'::bigint[])) as ids(id)) and q.type = 'open_answer' and s.teacher_id = v_user_id and ah.manual_review_status in ('pending', 'needs_changes');
  if v_allowed <> v_requested then raise exception 'Batch review only accepts pending or needs-changes answers owned by the current teacher'; end if;

  foreach v_id in array coalesce(p_attempt_ids, '{}'::bigint[]) loop perform public.review_manual_review_attempt(v_id, p_status, p_notes, p_comment_audience); end loop;
  return jsonb_build_object('succeeded', v_requested, 'failed', 0, 'errors', '[]'::jsonb);
end;
$$;

create or replace function public.get_manual_review_history(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid := auth.uid(); v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.attempt_history ah join public.questions q on q.id = ah.question_id join public.subjects s on s.id = q.subject_id
    where ah.id = p_attempt_history_id and (public.is_admin() or s.teacher_id = v_user_id)
  ) then raise exception 'Review access denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'eventType', h.event_type, 'fromStatus', h.from_status, 'toStatus', h.to_status, 'actorName', coalesce(p.alias, 'Sistema'), 'before', h.before_state, 'after', h.after_state, 'createdAt', h.created_at) order by h.created_at desc, h.id desc), '[]'::jsonb)
  into v_result from public.manual_review_history h left join public.profiles p on p.id = h.actor_id where h.attempt_history_id = p_attempt_history_id;
  return v_result;
end;
$$;

drop function if exists public.assign_manual_review_attempts(bigint[], uuid);
drop function if exists public.save_manual_review_rubric(uuid, text, bigint, jsonb);
drop function if exists public.save_manual_review_filter(uuid, text, jsonb);
drop function if exists public.claim_open_answer_attempt(bigint);

drop index if exists public.attempt_history_manual_review_sla_idx;
create index if not exists attempt_history_manual_review_sla_idx on public.attempt_history(manual_review_status, manual_review_due_at) where manual_review_status = 'pending';

alter table public.attempt_history drop column if exists manual_review_assigned_to;
alter table public.attempt_history drop column if exists manual_review_started_at;
alter table public.attempt_history drop column if exists manual_review_rubric_id;
alter table public.attempt_history drop column if exists manual_review_rubric_result;
drop table if exists public.manual_review_saved_filters;
drop table if exists public.manual_review_rubrics;

create or replace function public.get_teacher_student_history_summary(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 30), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e
    join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with contexts as (
    select e.id, e.student_id, e.subject_id, e.classroom_id, e.joined_at,
      s.name as subject_name, s.academic_year as subject_year,
      c.name as classroom_name, c.code as classroom_code, c.academic_year as classroom_year
    from public.enrollments e
    join public.subjects s on s.id = e.subject_id and s.teacher_id = v_teacher_id
    left join public.classrooms c on c.id = e.classroom_id
    where e.student_id = p_student_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ),
  scoped_questions as (
    select q.id, q.subject_id, q.classroom_id, q.topic_id, q.type, q.active
    from public.questions q
    where exists (
      select 1 from contexts c
      where c.subject_id = q.subject_id
        and (c.classroom_id is null or q.classroom_id is null or q.classroom_id = c.classroom_id)
    )
  ),
  scoped_attempts as (
    select ah.id, ah.student_id, ah.question_id, ah.is_correct, ah.earned_points, ah.attempted_at,
      coalesce(ah.manual_review_status, 'not_required') as manual_review_status,
      q.subject_id, q.classroom_id, q.topic_id, q.type as question_type, coalesce(q.active, true) as question_active
    from public.attempt_history ah
    join scoped_questions q on q.id = ah.question_id
    where ah.student_id = p_student_id
  ),
  current_period as (
    select * from scoped_attempts where attempted_at >= now() - make_interval(days => v_days)
  ),
  previous_period as (
    select * from scoped_attempts
    where attempted_at >= now() - make_interval(days => v_days * 2)
      and attempted_at < now() - make_interval(days => v_days)
  ),
  weak_topic as (
    select a.subject_id, a.classroom_id, a.topic_id, coalesce(t.title, 'Práctica general') as topic_title,
      count(*)::int as attempts,
      count(*) filter (where not a.is_correct)::int as mistakes,
      case when count(*) > 0 then round(100.0 * count(*) filter (where a.is_correct) / count(*))::int else 0 end as accuracy
    from current_period a
    left join public.subject_topics t on t.id = a.topic_id
    where a.manual_review_status <> 'pending'
    group by a.subject_id, a.classroom_id, a.topic_id, t.title
    having count(*) filter (where not a.is_correct) > 0
    order by mistakes desc, accuracy asc, attempts desc
    limit 1
  ),
  metrics as (
    select
      (select count(*)::int from current_period) as current_attempts,
      (select count(*)::int from current_period where manual_review_status <> 'pending') as current_evaluated,
      (select count(*)::int from current_period where manual_review_status <> 'pending' and is_correct) as current_correct,
      (select count(*)::int from current_period where manual_review_status = 'pending') as current_pending,
      (select coalesce(sum(coalesce(earned_points, 0)), 0)::int from current_period) as current_xp,
      (select count(*)::int from previous_period) as previous_attempts,
      (select count(*)::int from previous_period where manual_review_status <> 'pending') as previous_evaluated,
      (select count(*)::int from previous_period where manual_review_status <> 'pending' and is_correct) as previous_correct,
      (select coalesce(sum(coalesce(earned_points, 0)), 0)::int from previous_period) as previous_xp,
      (select max(attempted_at) from scoped_attempts) as last_activity,
      (select count(*)::int from scoped_attempts where manual_review_status = 'pending') as pending_reviews,
      (select count(distinct question_id)::int from current_period where question_active) as answered_questions,
      (select count(*)::int from scoped_questions where coalesce(active, true)) as available_questions
  )
  select jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'alias', p.alias, 'avatar', p.avatar, 'points', p.points, 'active', p.active, 'createdAt', p.created_at),
    'subjectsCount', (select count(*)::int from public.subjects s where s.teacher_id = v_teacher_id and coalesce(s.active, true) and not coalesce(s.is_archived, false)),
    'courseContexts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'enrollmentId', c.id, 'subjectId', c.subject_id, 'subjectName', c.subject_name,
        'classroomId', c.classroom_id, 'classroomName', coalesce(c.classroom_name, 'Clase principal'),
        'classroomCode', c.classroom_code, 'academicYear', coalesce(c.classroom_year, c.subject_year), 'joinedAt', c.joined_at
      ) order by c.joined_at, c.id) from contexts c
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'periodDays', v_days,
      'attempts', m.current_attempts,
      'evaluatedAttempts', m.current_evaluated,
      'pendingEvaluation', m.current_pending,
      'correct', m.current_correct,
      'accuracyPercent', case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int else null end,
      'earnedXp', m.current_xp,
      'lastActivityAt', m.last_activity,
      'pendingReviews', m.pending_reviews,
      'answeredQuestions', m.answered_questions,
      'availableQuestions', m.available_questions,
      'coveragePercent', case when m.available_questions > 0 then least(100, round(100.0 * m.answered_questions / m.available_questions)::int) else null end
    ),
    'comparison', jsonb_build_object(
      'current', jsonb_build_object(
        'attempts', m.current_attempts,
        'evaluatedAttempts', m.current_evaluated,
        'accuracyPercent', case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int else null end,
        'earnedXp', m.current_xp
      ),
      'previous', jsonb_build_object(
        'attempts', m.previous_attempts,
        'evaluatedAttempts', m.previous_evaluated,
        'accuracyPercent', case when m.previous_evaluated > 0 then round(100.0 * m.previous_correct / m.previous_evaluated)::int else null end,
        'earnedXp', m.previous_xp
      ),
      'delta', jsonb_build_object(
        'attempts', m.current_attempts - m.previous_attempts,
        'accuracyPoints', coalesce(case when m.current_evaluated > 0 then round(100.0 * m.current_correct / m.current_evaluated)::int end, 0)
          - coalesce(case when m.previous_evaluated > 0 then round(100.0 * m.previous_correct / m.previous_evaluated)::int end, 0),
        'earnedXp', m.current_xp - m.previous_xp
      )
    ),
    'recommendation', case
      when m.current_attempts = 0 and m.last_activity is null then jsonb_build_object(
        'code', 'start', 'title', 'Ayudarle a empezar',
        'reason', 'No se ha registrado ninguna respuesta en los cursos seleccionados.',
        'actionLabel', 'Enviar recordatorio', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      when m.pending_reviews > 0 then jsonb_build_object(
        'code', 'review', 'title', 'Revisar respuestas pendientes',
        'reason', case when m.pending_reviews = 1 then 'Hay 1 respuesta esperando una decisión docente.' else format('Hay %s respuestas esperando una decisión docente.', m.pending_reviews) end,
        'actionLabel', 'Abrir revisiones', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      when exists (select 1 from weak_topic) then jsonb_build_object(
        'code', 'practice', 'title', 'Reforzar ' || (select topic_title from weak_topic),
        'reason', format('La precisión del tema es %s%% y acumula %s.', (select accuracy from weak_topic),
          case when (select mistakes from weak_topic) = 1 then '1 error' else (select mistakes from weak_topic)::text || ' errores' end),
        'actionLabel', 'Preparar práctica',
        'subjectId', (select subject_id from weak_topic),
        'classroomId', (select classroom_id from weak_topic),
        'topicId', (select topic_id from weak_topic)
      )
      when m.last_activity < now() - interval '14 days' then jsonb_build_object(
        'code', 'reengage', 'title', 'Recuperar la constancia',
        'reason', 'La última actividad supera los 14 días.',
        'actionLabel', 'Enviar recordatorio', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
      else jsonb_build_object(
        'code', 'challenge', 'title', 'Proponer un nuevo reto',
        'reason', 'Mantiene una actividad estable y puede avanzar a contenido más exigente.',
        'actionLabel', 'Crear pregunta', 'subjectId', p_subject_id, 'classroomId', p_classroom_id, 'topicId', null
      )
    end,
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'subjectId', n.subject_id, 'classroomId', n.classroom_id, 'createdAt', n.created_at, 'updatedAt', n.updated_at) order by n.created_at desc, n.id desc)
      from (
        select n.id, n.body, n.subject_id, n.classroom_id, n.created_at, n.updated_at
        from public.teacher_student_notes n
        where n.teacher_id = v_teacher_id and n.student_id = p_student_id
          and (p_subject_id is null or n.subject_id is null or n.subject_id = p_subject_id)
          and (p_classroom_id is null or n.classroom_id is null or n.classroom_id = p_classroom_id)
        order by n.created_at desc, n.id desc limit 5
      ) n
    ), '[]'::jsonb),
    'notesTotal', (
      select count(*)::int from public.teacher_student_notes n
      where n.teacher_id = v_teacher_id and n.student_id = p_student_id
        and (p_subject_id is null or n.subject_id is null or n.subject_id = p_subject_id)
        and (p_classroom_id is null or n.classroom_id is null or n.classroom_id = p_classroom_id)
    )
  ) into v_result
  from public.profiles p cross join metrics m
  where p.id = p_student_id;

  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_weaknesses(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 90), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with rows as (
    select q.subject_id, s.name as subject_name, q.topic_id, coalesce(t.title, 'Práctica general') as topic_title,
      count(ah.id)::int as attempts,
      count(ah.id) filter (where not ah.is_correct)::int as mistakes,
      round(100.0 * count(ah.id) filter (where ah.is_correct) / nullif(count(ah.id), 0))::int as accuracy_percent,
      max(ah.attempted_at) as last_attempt_at
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and ah.attempted_at >= now() - make_interval(days => v_days)
      and coalesce(ah.manual_review_status, 'not_required') <> 'pending'
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
    group by q.subject_id, s.name, q.topic_id, t.title
    having count(ah.id) filter (where not ah.is_correct) > 0
    order by mistakes desc, accuracy_percent asc, last_attempt_at desc
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(r) order by r.mistakes desc, r.accuracy_percent asc) from rows r), '[]'::jsonb),
    'periodDays', v_days
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_reviews_page(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with filtered as (
    select ah.id, ah.question_id, q.subject_id, q.classroom_id, q.text as question_text, s.name as subject_name,
      coalesce(t.title, 'Práctica general') as topic_title, ah.submitted_answer_text as answer_text,
      coalesce(ah.manual_review_status, 'not_required') as status, ah.reviewed_at, ah.review_notes, ah.attempted_at,
      (select count(*)::int from public.manual_review_comments m where m.attempt_history_id = ah.id) as comments_count
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and q.type = 'open_answer'
      and coalesce(ah.manual_review_status, 'not_required') <> 'not_required'
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
  ), page_rows as (
    select * from filtered
    order by case status when 'pending' then 1 when 'needs_changes' then 2 else 3 end, attempted_at desc, id desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by case p.status when 'pending' then 1 when 'needs_changes' then 2 else 3 end, p.attempted_at desc, p.id desc) from page_rows p), '[]'::jsonb),
    'total', (select count(*)::int from filtered), 'limit', v_limit, 'offset', v_offset
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_teacher_student_history_metrics(
  p_student_id uuid,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_period_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 90), 7), 365);
  v_result jsonb;
begin
  if v_teacher_id is null then raise exception 'Teacher session required'; end if;
  if not exists (
    select 1 from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.student_id = p_student_id and s.teacher_id = v_teacher_id
      and (p_subject_id is null or e.subject_id = p_subject_id)
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then raise exception 'Student not found or access denied'; end if;

  with attempts as (
    select ah.attempted_at, ah.is_correct, coalesce(ah.earned_points, 0)::int as earned_points,
      coalesce(ah.manual_review_status, 'not_required') as manual_review_status,
      q.subject_id, q.classroom_id, q.topic_id, s.name as subject_name,
      coalesce(t.title, 'Práctica general') as topic_title
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id and s.teacher_id = v_teacher_id
    left join public.subject_topics t on t.id = q.topic_id
    where ah.student_id = p_student_id
      and exists (
        select 1 from public.enrollments e
        where e.student_id = p_student_id and e.subject_id = q.subject_id
          and (e.classroom_id is null or q.classroom_id is null or e.classroom_id = q.classroom_id)
      )
      and ah.attempted_at >= now() - make_interval(days => v_days)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id is null or q.classroom_id = p_classroom_id)
  ), daily as (
    select attempted_at::date as day,
      count(*)::int as attempts,
      count(*) filter (where manual_review_status <> 'pending')::int as evaluated,
      count(*) filter (where manual_review_status = 'pending')::int as pending,
      count(*) filter (where manual_review_status <> 'pending' and is_correct)::int as correct,
      coalesce(sum(earned_points), 0)::int as earned_xp
    from attempts group by attempted_at::date order by day
  ), topic_rows as (
    select subject_id, subject_name, topic_id, topic_title,
      count(*)::int as attempts,
      count(*) filter (where manual_review_status <> 'pending')::int as evaluated,
      count(*) filter (where manual_review_status = 'pending')::int as pending,
      count(*) filter (where manual_review_status <> 'pending' and is_correct)::int as correct,
      case when count(*) filter (where manual_review_status <> 'pending') > 0
        then round(100.0 * count(*) filter (where manual_review_status <> 'pending' and is_correct)
          / count(*) filter (where manual_review_status <> 'pending'))::int else null end as accuracy_percent,
      coalesce(sum(earned_points), 0)::int as earned_xp,
      max(attempted_at) as last_activity_at
    from attempts group by subject_id, subject_name, topic_id, topic_title
  )
  select jsonb_build_object(
    'periodDays', v_days,
    'evolution', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.day, 'attempts', d.attempts, 'evaluated', d.evaluated, 'pending', d.pending, 'correct', d.correct,
        'accuracyPercent', case when d.evaluated > 0 then round(100.0 * d.correct / d.evaluated)::int else null end,
        'earnedXp', d.earned_xp
      ) order by d.day) from daily d
    ), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(to_jsonb(t) order by t.last_activity_at desc, t.topic_title) from topic_rows t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_teacher_notification_center_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_pending_reviews integer := 0;
  v_inactive_students integer := 0;
  v_sensitive_actions integer := 0;
  v_muted_until timestamptz;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  select count(*)::integer
  into v_pending_reviews
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where s.teacher_id = v_teacher_id
    and ah.manual_review_status = 'pending';

  select count(distinct e.student_id)::integer
  into v_inactive_students
  from public.enrollments e
  join public.subjects s on s.id = e.subject_id
  where s.teacher_id = v_teacher_id
    and e.student_id is not null
    and not exists (
      select 1
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.student_id = e.student_id
        and q.subject_id = e.subject_id
        and coalesce(ah.attempted_at, ah.created_at) >= now() - interval '7 days'
    );

  select count(*)::integer
  into v_sensitive_actions
  from public.teacher_audit_logs log
  where log.teacher_id = v_teacher_id
    and log.created_at >= now() - interval '7 days'
    and log.severity in ('warning', 'critical');

  select teacher_notifications_muted_until
  into v_muted_until
  from public.user_notification_preferences
  where user_id = v_teacher_id;

  return jsonb_build_object(
    'pending_reviews', v_pending_reviews,
    'inactive_students', v_inactive_students,
    'sensitive_actions', v_sensitive_actions,
    'muted_until', v_muted_until
  );
end;
$$;

create or replace function public.enqueue_due_teacher_digests(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  insert into public.teacher_digest_deliveries(
    teacher_id,
    period_start,
    period_end,
    frequency,
    timezone,
    recipient_email,
    snapshot
  )
  select
    profile.id,
    case when preference.teacher_digest_frequency = 'weekly'
      then date_trunc('week', p_now at time zone coalesce(user_preference.timezone, 'Europe/Madrid')) at time zone coalesce(user_preference.timezone, 'Europe/Madrid')
      else date_trunc('day', p_now at time zone coalesce(user_preference.timezone, 'Europe/Madrid')) at time zone coalesce(user_preference.timezone, 'Europe/Madrid')
    end,
    p_now,
    preference.teacher_digest_frequency,
    coalesce(user_preference.timezone, 'Europe/Madrid'),
    coalesce(nullif(trim(preference.teacher_reminder_email), ''), auth_user.email),
    jsonb_build_object(
      'inactive_students', case when preference.teacher_inactive_student_alerts then (
        select count(distinct enrollment.student_id)
        from public.subjects subject
        join public.enrollments enrollment on enrollment.subject_id = subject.id
        join public.profiles student on student.id = enrollment.student_id
        left join public.teacher_notification_course_preferences course_preference
          on course_preference.teacher_id = profile.id and course_preference.subject_id = subject.id
        where subject.teacher_id = profile.id
          and not coalesce(subject.is_archived, false)
          and coalesce(course_preference.digest_enabled, true)
          and coalesce(student.active, true)
          and (student.role_id <> 'guest' or coalesce(student.expires_at, p_now + interval '1 day') > p_now)
          and not exists (
            select 1
            from public.attempt_history attempt
            join public.questions question on question.id = attempt.question_id
            where attempt.student_id = enrollment.student_id
              and question.subject_id = subject.id
              and coalesce(attempt.attempted_at, attempt.created_at) >= p_now - interval '7 days'
          )
      ) else 0 end,
      'open_reviews', case when preference.teacher_open_review_alerts then (
        select count(*)
        from public.attempt_history attempt
        join public.questions question on question.id = attempt.question_id
        join public.subjects subject on subject.id = question.subject_id
        left join public.teacher_notification_course_preferences course_preference
          on course_preference.teacher_id = profile.id and course_preference.subject_id = subject.id
        where subject.teacher_id = profile.id
          and coalesce(course_preference.digest_enabled, true)
          and attempt.manual_review_status = 'pending'
      ) else 0 end,
      'sensitive_actions', case when preference.teacher_sensitive_action_alerts then (
        select count(*)
        from public.teacher_audit_logs audit
        where audit.teacher_id = profile.id
          and audit.created_at >= coalesce(preference.teacher_digest_last_sent_at, p_now - interval '7 days')
          and audit.severity in ('warning', 'critical')
      ) else 0 end,
      'generated_at', p_now
    )
  from public.profiles profile
  join auth.users auth_user on auth_user.id = profile.id
  join public.user_notification_preferences preference on preference.user_id = profile.id
  left join public.user_preferences user_preference on user_preference.user_id = profile.id
  where profile.role_id = 'teacher'
    and coalesce(profile.active, true)
    and preference.email_enabled
    and preference.teacher_digest_frequency in ('daily', 'weekly')
    and preference.teacher_digest_unsubscribed_at is null
    and coalesce(nullif(trim(preference.teacher_reminder_email), ''), auth_user.email) is not null
    and (
      (
        preference.teacher_digest_frequency = 'daily'
        and extract(hour from p_now at time zone coalesce(user_preference.timezone, 'Europe/Madrid')) = preference.teacher_digest_hour
        and (preference.teacher_digest_last_sent_at is null or preference.teacher_digest_last_sent_at < p_now - interval '20 hours')
      )
      or (
        preference.teacher_digest_frequency = 'weekly'
        and extract(isodow from p_now at time zone coalesce(user_preference.timezone, 'Europe/Madrid')) = preference.teacher_digest_weekday
        and extract(hour from p_now at time zone coalesce(user_preference.timezone, 'Europe/Madrid')) = preference.teacher_digest_hour
        and (preference.teacher_digest_last_sent_at is null or preference.teacher_digest_last_sent_at < p_now - interval '6 days')
      )
    )
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.get_teacher_manual_review_queue(bigint, bigint, text, text, uuid, bigint, integer, integer) from public, anon;
revoke all on function public.get_manual_review_configuration() from public, anon;
revoke all on function public.save_manual_review_settings(integer) from public, anon;
revoke all on function public.save_manual_review_template(uuid, text, text, text) from public, anon;
revoke all on function public.get_manual_review_thread(bigint) from public, anon;
revoke all on function public.add_manual_review_comment(bigint, text, text) from public, anon;
revoke all on function public.review_manual_review_attempt(bigint, text, text, text) from public, anon;
revoke all on function public.batch_review_manual_attempts(bigint[], text, text, text) from public, anon;
revoke all on function public.get_manual_review_history(bigint) from public, anon;

grant execute on function public.get_teacher_manual_review_queue(bigint, bigint, text, text, uuid, bigint, integer, integer) to authenticated;
grant execute on function public.get_manual_review_configuration() to authenticated;
grant execute on function public.save_manual_review_settings(integer) to authenticated;
grant execute on function public.save_manual_review_template(uuid, text, text, text) to authenticated;
grant execute on function public.get_manual_review_thread(bigint) to authenticated;
grant execute on function public.add_manual_review_comment(bigint, text, text) to authenticated;
grant execute on function public.review_manual_review_attempt(bigint, text, text, text) to authenticated;
grant execute on function public.batch_review_manual_attempts(bigint[], text, text, text) to authenticated;
grant execute on function public.get_manual_review_history(bigint) to authenticated;

-- Student experience follow-up: role-aware paged notifications and privacy-safe activity.

create index if not exists notifications_user_audience_created_idx
  on public.notifications(user_id, audience, created_at desc, id desc)
  where deleted_at is null;

create index if not exists notifications_user_audience_unread_idx
  on public.notifications(user_id, audience, created_at desc, id desc)
  where deleted_at is null and read_at is null;

create or replace function public.get_notifications_page(
  p_audience text,
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_audience text := lower(trim(coalesce(p_audience, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_total bigint := 0;
  v_unread bigint := 0;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_audience not in ('student', 'teacher') then
    raise exception 'Unsupported notification audience';
  end if;

  select p.role_id
  into v_role
  from public.profiles p
  where p.id = v_user_id
    and coalesce(p.active, true);

  if v_role is null then
    raise exception 'Active profile required';
  end if;

  if (v_audience = 'teacher' and v_role <> 'teacher')
     or (v_audience = 'student' and v_role not in ('student', 'guest')) then
    raise exception 'Notification audience does not match current role';
  end if;

  select count(*), count(*) filter (where n.read_at is null)
  into v_total, v_unread
  from public.notifications n
  where n.user_id = v_user_id
    and n.audience = v_audience
    and n.deleted_at is null;

  with candidates as (
    select n.*
    from public.notifications n
    where n.user_id = v_user_id
      and n.audience = v_audience
      and n.deleted_at is null
      and (
        p_cursor_created_at is null
        or (n.created_at, n.id) < (p_cursor_created_at, coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    order by n.created_at desc, n.id desc
    limit v_limit + 1
  ), numbered as (
    select c.*, row_number() over (order by c.created_at desc, c.id desc) as row_number
    from candidates c
  )
  select jsonb_build_object(
    'rows', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'audience', n.audience,
          'type', n.type,
          'title', n.title,
          'description', n.description,
          'icon', n.icon,
          'color', n.color,
          'created_at', n.created_at,
          'read_at', n.read_at,
          'action_url', n.action_url,
          'related_id', n.related_id,
          'metadata', n.metadata
        )
        order by n.created_at desc, n.id desc
      ) filter (where n.row_number <= v_limit),
      '[]'::jsonb
    ),
    'has_more', count(*) > v_limit,
    'next_cursor_created_at', max(n.created_at) filter (where n.row_number = v_limit),
    'next_cursor_id', max(n.id::text) filter (where n.row_number = v_limit),
    'total', v_total,
    'unread_count', v_unread
  )
  into v_result
  from numbered n;

  return coalesce(
    v_result,
    jsonb_build_object(
      'rows', '[]'::jsonb,
      'has_more', false,
      'next_cursor_created_at', null,
      'next_cursor_id', null,
      'total', v_total,
      'unread_count', v_unread
    )
  );
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(cardinality(p_ids), 0) = 0 then
    return 0;
  end if;

  update public.notifications n
  set read_at = coalesce(n.read_at, now()), updated_at = now()
  where n.user_id = v_user_id
    and n.id = any(p_ids)
    and n.deleted_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.delete_notifications(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(cardinality(p_ids), 0) = 0 then
    return 0;
  end if;

  update public.notifications n
  set deleted_at = coalesce(n.deleted_at, now()), updated_at = now()
  where n.user_id = v_user_id
    and n.id = any(p_ids)
    and n.deleted_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.get_notifications_page(text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.delete_notifications(uuid[]) from public, anon;
grant execute on function public.get_notifications_page(text, integer, timestamptz, uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.delete_notifications(uuid[]) to authenticated;

comment on function public.get_notifications_page(text, integer, timestamptz, uuid)
  is 'Returns one cursor-paginated notification page for the audience allowed by the current profile role.';
comment on function public.mark_notifications_read(uuid[])
  is 'Marks a batch of notifications owned by the current user as read.';
comment on function public.delete_notifications(uuid[])
  is 'Soft-deletes a batch of notifications owned by the current user.';

-- The activity list contains only summary data. Answers, comments and feedback are
-- returned exclusively by get_activity_attempt_detail when the row is expanded.
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

  with base as (
    select
      ah.id,
      ah.question_id,
      ah.answer_id,
      ah.is_correct,
      ah.time_taken_seconds,
      ah.attempted_at,
      ah.earned_points,
      ah.hint_used,
      ah.was_skipped,
      ah.manual_review_status,
      q.text as question_text,
      q.type as question_type,
      q.difficulty,
      q.subject_id,
      q.classroom_id,
      q.topic_id,
      s.name as subject_name,
      st.title as topic_title
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    left join public.subjects s on s.id = q.subject_id
    left join public.subject_topics st on st.id = q.topic_id
    where ah.student_id = v_user_id
  ), search_scoped as (
    select b.*
    from base b
    where v_search is null
       or concat_ws(' ', b.question_text, b.subject_name, b.topic_title) ilike '%' || v_search || '%'
  ), status_scope as (
    select b.*
    from search_scoped b
    where (p_subject_id is null or b.subject_id = p_subject_id)
      and (p_classroom_id is null or b.classroom_id = p_classroom_id)
      and (p_topic_id is null or b.topic_id = p_topic_id)
      and (p_difficulty is null or coalesce(b.difficulty, 1) = p_difficulty)
  ), subject_scope as (
    select b.*
    from search_scoped b
    where (v_status = 'all' or (v_status = 'correct' and b.is_correct) or (v_status = 'incorrect' and not b.is_correct))
      and (p_classroom_id is null or b.classroom_id = p_classroom_id)
      and (p_topic_id is null or b.topic_id = p_topic_id)
      and (p_difficulty is null or coalesce(b.difficulty, 1) = p_difficulty)
  ), topic_scope as (
    select b.*
    from search_scoped b
    where (v_status = 'all' or (v_status = 'correct' and b.is_correct) or (v_status = 'incorrect' and not b.is_correct))
      and (p_subject_id is null or b.subject_id = p_subject_id)
      and (p_classroom_id is null or b.classroom_id = p_classroom_id)
      and (p_difficulty is null or coalesce(b.difficulty, 1) = p_difficulty)
  ), filtered as (
    select b.*
    from status_scope b
    where (v_status = 'all' or (v_status = 'correct' and b.is_correct) or (v_status = 'incorrect' and not b.is_correct))
  ), ranked as (
    select f.*, count(*) over()::bigint as total_count
    from filtered f
  ), page as (
    select * from ranked order by attempted_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'question_id', p.question_id,
        'answer_id', null,
        'is_correct', p.is_correct,
        'time_taken_seconds', p.time_taken_seconds,
        'attempted_at', p.attempted_at,
        'submitted_answer_text', null,
        'submitted_answer_payload', null,
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
      ) order by p.attempted_at desc, p.id desc)
      from page p
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'status_counts', jsonb_build_object(
      'all', (select count(*) from status_scope),
      'correct', (select count(*) from status_scope where is_correct),
      'incorrect', (select count(*) from status_scope where not is_correct)
    ),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', subject_id,
        'label', coalesce(subject_name, 'Clase sin nombre'),
        'count', item_count
      ) order by coalesce(subject_name, 'Clase sin nombre'))
      from (
        select subject_id, max(subject_name) as subject_name, count(*)::integer as item_count
        from subject_scope
        where subject_id is not null
        group by subject_id
      ) subject_facets
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(topic_id::text, 'general'),
        'subject_id', subject_id,
        'label', coalesce(topic_title, 'Tema general'),
        'count', item_count
      ) order by coalesce(topic_title, 'Tema general'))
      from (
        select topic_id, subject_id, max(topic_title) as topic_title, count(*)::integer as item_count
        from topic_scope
        group by topic_id, subject_id
      ) topic_facets
    ), '[]'::jsonb)
  ) into v_result;

  return coalesce(v_result, jsonb_build_object(
    'rows', '[]'::jsonb,
    'total', 0,
    'status_counts', jsonb_build_object('all', 0, 'correct', 0, 'incorrect', 0),
    'subjects', '[]'::jsonb,
    'topics', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.get_student_attempt_history_page(text, text, bigint, bigint, bigint, integer, integer, integer) from public, anon;
grant execute on function public.get_student_attempt_history_page(text, text, bigint, bigint, bigint, integer, integer, integer) to authenticated;

-- Expanded activity returns only the learner's submitted value and authorized
-- feedback. It deliberately does not return the complete answer bank.
create or replace function public.get_activity_attempt_detail(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_owner_id uuid;
  v_teacher_id uuid;
  v_review_status text;
  v_reveal_feedback boolean := false;
  v_comments jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select ah.student_id, s.teacher_id, coalesce(ah.manual_review_status, 'not_required')
  into v_owner_id, v_teacher_id, v_review_status
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where ah.id = p_attempt_history_id;

  if not found then raise exception 'Attempt not found'; end if;
  if v_owner_id <> v_user_id and v_teacher_id <> v_user_id and not public.is_admin() then
    raise exception 'No puedes consultar este intento.';
  end if;

  v_reveal_feedback := v_review_status in ('not_required', 'approved', 'rejected');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'author_name', coalesce(p.alias, split_part(p.email, '@', 1), 'Profesor'),
    'body', c.body,
    'created_at', c.created_at
  ) order by c.created_at asc, c.id asc), '[]'::jsonb)
  into v_comments
  from public.manual_review_comments c
  left join public.profiles p on p.id = c.author_id
  where c.attempt_history_id = p_attempt_history_id
    and (v_user_id = v_teacher_id or public.is_admin() or c.audience = 'student');

  select jsonb_build_object(
    'id', ah.id,
    'question_id', ah.question_id,
    'answer_id', null,
    'is_correct', ah.is_correct,
    'time_taken_seconds', ah.time_taken_seconds,
    'attempted_at', ah.attempted_at,
    'submitted_answer_text', coalesce(ah.submitted_answer_text, selected_answer.text),
    'submitted_answer_payload', ah.submitted_answer_payload,
    'earned_points', ah.earned_points,
    'hint_used', ah.hint_used,
    'was_skipped', ah.was_skipped,
    'manual_review_status', ah.manual_review_status,
    'review_notes', case when v_user_id = v_teacher_id or public.is_admin() then ah.review_notes else null end,
    'review_comments', v_comments,
    'questions', jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'difficulty', coalesce(q.difficulty, 1),
      'subject_id', q.subject_id,
      'classroom_id', q.classroom_id,
      'topic_id', q.topic_id,
      'media_type', q.media_type,
      'media_url', null,
      'media_alt_text', q.media_alt_text,
      'media_caption', q.media_caption,
      'explanation', case when v_reveal_feedback then q.explanation else null end,
      'subjects', jsonb_build_object('id', s.id, 'name', s.name),
      'subject_topics', case when st.id is null then null else jsonb_build_object('id', st.id, 'title', st.title) end,
      'answers', '[]'::jsonb
    )
  )
  into v_result
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  left join public.subject_topics st on st.id = q.topic_id
  left join public.answers selected_answer on selected_answer.id = ah.answer_id and selected_answer.question_id = q.id
  where ah.id = p_attempt_history_id;

  return v_result;
end;
$$;

revoke all on function public.get_activity_attempt_detail(bigint) from public, anon;
grant execute on function public.get_activity_attempt_detail(bigint) to authenticated;
comment on function public.get_activity_attempt_detail(bigint)
  is 'Returns one authorized attempt with lazy feedback and the submitted value, never the full answer bank.';

create table if not exists public.attempt_sensitive_data_retention_policy (
  singleton boolean primary key default true check (singleton),
  retention_days integer not null default 90 check (retention_days between 30 and 730),
  updated_at timestamptz not null default now()
);

insert into public.attempt_sensitive_data_retention_policy(singleton, retention_days)
values (true, 90)
on conflict (singleton) do nothing;

alter table public.attempt_sensitive_data_retention_policy enable row level security;
revoke all on public.attempt_sensitive_data_retention_policy from public, anon, authenticated;

create or replace function public.apply_attempt_sensitive_data_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retention_days integer := 90;
  v_cleared integer := 0;
begin
  select retention_days into v_retention_days
  from public.attempt_sensitive_data_retention_policy
  where singleton = true;

  update public.attempt_history
  set answer_id = null,
      submitted_answer_text = null,
      submitted_answer_payload = null
  where attempted_at < now() - make_interval(days => coalesce(v_retention_days, 90))
    and (answer_id is not null or submitted_answer_text is not null or submitted_answer_payload is not null);

  get diagnostics v_cleared = row_count;

  return jsonb_build_object(
    'cleared_attempts', v_cleared,
    'retention_days', coalesce(v_retention_days, 90)
  );
end;
$$;

revoke all on function public.apply_attempt_sensitive_data_retention() from public, anon, authenticated;
grant execute on function public.apply_attempt_sensitive_data_retention() to service_role;

comment on function public.apply_attempt_sensitive_data_retention()
  is 'Clears answer identifiers and raw submitted answers after the configured retention period while preserving learning metrics.';

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'omniquest-attempt-sensitive-retention'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'omniquest-attempt-sensitive-retention',
    '10 4 * * *',
    'select public.apply_attempt_sensitive_data_retention();'
  );
exception
  when undefined_table or undefined_function then
    raise notice 'pg_cron is unavailable; schedule apply_attempt_sensitive_data_retention manually.';
end;
$$;

notify pgrst, 'reload schema';

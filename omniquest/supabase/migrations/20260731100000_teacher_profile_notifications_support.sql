create extension if not exists pgcrypto;

create or replace function public.get_teacher_profile_summary(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_period_days integer := least(greatest(coalesce(p_period_days, 30), 7), 365);
  v_period_start timestamptz := now() - make_interval(days => least(greatest(coalesce(p_period_days, 30), 7), 365));
  v_profile jsonb;
  v_active_courses integer := 0;
  v_active_classrooms integer := 0;
  v_enrolled_students integer := 0;
  v_participating_students integer := 0;
  v_questions_created integer := 0;
  v_attempts integer := 0;
  v_correct_attempts integer := 0;
  v_primary_subject_id bigint;
begin
  if v_teacher_id is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'alias', p.alias,
    'avatar', p.avatar,
    'created_at', p.created_at,
    'email', coalesce(p.email, u.email),
    'role', p.role_id
  )
  into v_profile
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = v_teacher_id
    and p.role_id = 'teacher'
    and coalesce(p.active, true);

  if v_profile is null then
    raise exception 'Active teacher profile required';
  end if;

  select count(*)::integer, min(s.id)
  into v_active_courses, v_primary_subject_id
  from public.subjects s
  where s.teacher_id = v_teacher_id
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false);

  select count(*)::integer
  into v_active_classrooms
  from public.classrooms c
  join public.subjects s on s.id = c.subject_id
  where s.teacher_id = v_teacher_id
    and coalesce(c.active, true)
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false);

  select count(distinct e.student_id)::integer
  into v_enrolled_students
  from public.enrollments e
  join public.subjects s on s.id = e.subject_id
  where s.teacher_id = v_teacher_id
    and e.student_id is not null
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false);

  select count(distinct e.student_id)::integer
  into v_participating_students
  from public.enrollments e
  join public.subjects s on s.id = e.subject_id
  where s.teacher_id = v_teacher_id
    and e.student_id is not null
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false)
    and exists (
      select 1
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.student_id = e.student_id
        and q.subject_id = e.subject_id
        and coalesce(ah.attempted_at, ah.created_at) >= v_period_start
    );

  select
    count(*)::integer,
    count(*) filter (where ah.is_correct)::integer
  into v_attempts, v_correct_attempts
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where s.teacher_id = v_teacher_id
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false)
    and coalesce(ah.attempted_at, ah.created_at) >= v_period_start;

  select count(*)::integer
  into v_questions_created
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where s.teacher_id = v_teacher_id
    and q.created_at >= v_period_start;

  return jsonb_build_object(
    'profile', v_profile,
    'period_days', v_period_days,
    'period_start', v_period_start,
    'period_end', now(),
    'metrics', jsonb_build_object(
      'active_courses', v_active_courses,
      'active_classrooms', v_active_classrooms,
      'enrolled_students', v_enrolled_students,
      'participating_students', v_participating_students,
      'questions_created', v_questions_created,
      'attempts', v_attempts,
      'correct_attempts', v_correct_attempts,
      'accuracy_percent', case when v_attempts = 0 then 0 else round(100.0 * v_correct_attempts / v_attempts, 1) end,
      'participation_percent', case when v_enrolled_students = 0 then 0 else round(100.0 * v_participating_students / v_enrolled_students, 1) end
    ),
    'participation_definition', jsonb_build_object(
      'numerator', v_participating_students,
      'denominator', v_enrolled_students,
      'description', 'Alumnos matriculados con al menos un intento durante el periodo seleccionado.'
    ),
    'primary_subject_id', v_primary_subject_id
  );
end;
$$;

create or replace function public.get_teacher_profile_recent_subjects_page(
  p_limit integer default 4,
  p_offset integer default 0
)
returns table (
  id bigint,
  name text,
  description text,
  icon text,
  code text,
  created_at timestamptz,
  classroom_count bigint,
  student_count bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 4), 1), 25);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  return query
  select
    s.id,
    s.name,
    s.description,
    s.icon,
    s.code,
    s.created_at,
    (select count(*) from public.classrooms c where c.subject_id = s.id and coalesce(c.active, true)) as classroom_count,
    (select count(distinct e.student_id) from public.enrollments e where e.subject_id = s.id and e.student_id is not null) as student_count,
    count(*) over() as total_count
  from public.subjects s
  where s.teacher_id = v_teacher_id
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false)
  order by s.created_at desc, s.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_teacher_profile_recent_questions_page(
  p_limit integer default 5,
  p_offset integer default 0
)
returns table (
  id bigint,
  text text,
  question_type text,
  subject_id bigint,
  subject_name text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 25);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  return query
  select
    q.id,
    q.text,
    q.type as question_type,
    s.id as subject_id,
    s.name as subject_name,
    q.created_at,
    count(*) over() as total_count
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where s.teacher_id = v_teacher_id
    and coalesce(s.active, true)
    and not coalesce(s.is_archived, false)
    and coalesce(q.active, true)
  order by q.created_at desc, q.id desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_teacher_profile_summary(integer) from public, anon;
revoke all on function public.get_teacher_profile_recent_subjects_page(integer, integer) from public, anon;
revoke all on function public.get_teacher_profile_recent_questions_page(integer, integer) from public, anon;
grant execute on function public.get_teacher_profile_summary(integer) to authenticated;
grant execute on function public.get_teacher_profile_recent_subjects_page(integer, integer) to authenticated;
grant execute on function public.get_teacher_profile_recent_questions_page(integer, integer) to authenticated;

alter table public.user_notification_preferences
  add column if not exists teacher_notifications_muted_until timestamptz,
  add column if not exists teacher_digest_hour smallint not null default 7,
  add column if not exists teacher_digest_weekday smallint not null default 1,
  add column if not exists support_preferred_channel text not null default 'in_app',
  add column if not exists support_contact_email text;

alter table public.user_notification_preferences
  drop constraint if exists user_notification_preferences_teacher_digest_hour_check;
alter table public.user_notification_preferences
  add constraint user_notification_preferences_teacher_digest_hour_check
  check (teacher_digest_hour between 0 and 23);

alter table public.user_notification_preferences
  drop constraint if exists user_notification_preferences_teacher_digest_weekday_check;
alter table public.user_notification_preferences
  add constraint user_notification_preferences_teacher_digest_weekday_check
  check (teacher_digest_weekday between 1 and 7);

alter table public.user_notification_preferences
  drop constraint if exists user_notification_preferences_support_channel_check;
alter table public.user_notification_preferences
  add constraint user_notification_preferences_support_channel_check
  check (support_preferred_channel in ('in_app', 'email', 'both'));

create table if not exists public.teacher_notification_course_preferences (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  critical_enabled boolean not null default true,
  informative_enabled boolean not null default true,
  digest_enabled boolean not null default true,
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, subject_id)
);

create index if not exists teacher_notification_course_preferences_subject_idx
  on public.teacher_notification_course_preferences(subject_id, teacher_id);

alter table public.teacher_notification_course_preferences enable row level security;
revoke all on public.teacher_notification_course_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.teacher_notification_course_preferences to authenticated;

drop policy if exists "teacher_notification_course_preferences_own" on public.teacher_notification_course_preferences;
create policy "teacher_notification_course_preferences_own"
on public.teacher_notification_course_preferences
for all to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.teacher_id = auth.uid()
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.teacher_id = auth.uid()
  )
);

create or replace function public.teacher_notification_severity(
  p_type text,
  p_title text,
  p_metadata jsonb
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_metadata ->> 'severity', '')) in ('critical', 'high', 'warning') then 'critical'
    when lower(coalesce(p_metadata ->> 'preference_category', '')) in ('security', 'review', 'urgent') then 'critical'
    when lower(coalesce(p_title, '')) similar to '%(urgente|crític|critico|vencid|seguridad|revisión pendiente|revision pendiente)%' then 'critical'
    else 'informative'
  end;
$$;

create or replace function public.teacher_notification_category(
  p_type text,
  p_title text,
  p_action_url text,
  p_metadata jsonb
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_metadata ->> 'category', '')) in ('students', 'review', 'courses', 'system', 'audit')
      then lower(p_metadata ->> 'category')
    when lower(coalesce(p_action_url, '')) like '%/reviews%' or lower(coalesce(p_title, '')) like '%revisi%' then 'review'
    when lower(coalesce(p_action_url, '')) like '%/audit%' or lower(coalesce(p_title, '')) like '%auditor%' then 'audit'
    when p_type in ('enrollment', 'student_activity') then 'students'
    when p_type = 'new_class' then 'courses'
    else 'system'
  end;
$$;

create or replace function public.teacher_notification_subject_id(p_metadata jsonb)
returns bigint
language sql
immutable
as $$
  select case
    when coalesce(p_metadata ->> 'subject_id', '') ~ '^[0-9]+$'
      then (p_metadata ->> 'subject_id')::bigint
    else null
  end;
$$;

create or replace function public.apply_teacher_notification_delivery_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_severity text;
  v_subject_id bigint;
  v_global_muted_until timestamptz;
  v_course_preference public.teacher_notification_course_preferences%rowtype;
  v_push_suppressed boolean := false;
  v_suppression_reason text := null;
begin
  if new.audience <> 'teacher' then
    return new;
  end if;

  v_severity := public.teacher_notification_severity(new.type, new.title, new.metadata);
  v_subject_id := public.teacher_notification_subject_id(new.metadata);

  select np.teacher_notifications_muted_until
  into v_global_muted_until
  from public.user_notification_preferences np
  where np.user_id = new.user_id;

  if v_severity = 'informative' and v_global_muted_until > now() then
    v_push_suppressed := true;
    v_suppression_reason := 'teacher_temporarily_muted';
  end if;

  if v_subject_id is not null then
    select *
    into v_course_preference
    from public.teacher_notification_course_preferences preference
    where preference.teacher_id = new.user_id
      and preference.subject_id = v_subject_id;

    if found then
      if v_severity = 'critical' and not v_course_preference.critical_enabled then
        v_push_suppressed := true;
        v_suppression_reason := 'course_critical_disabled';
      elsif v_severity = 'informative' and not v_course_preference.informative_enabled then
        v_push_suppressed := true;
        v_suppression_reason := 'course_informative_disabled';
      elsif v_severity = 'informative' and v_course_preference.muted_until > now() then
        v_push_suppressed := true;
        v_suppression_reason := 'course_temporarily_muted';
      end if;
    end if;
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'severity', v_severity,
      'category', public.teacher_notification_category(new.type, new.title, new.action_url, new.metadata),
      'push_suppressed', v_push_suppressed,
      'push_suppression_reason', v_suppression_reason
    );
  return new;
end;
$$;

drop trigger if exists apply_teacher_notification_delivery_preferences_trigger on public.notifications;
create trigger apply_teacher_notification_delivery_preferences_trigger
before insert on public.notifications
for each row execute function public.apply_teacher_notification_delivery_preferences();

create or replace function public.apply_teacher_notification_queue_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.notifications%rowtype;
begin
  select * into v_notification
  from public.notifications notification
  where notification.id = new.notification_id;

  if found
    and v_notification.audience = 'teacher'
    and coalesce(v_notification.metadata ->> 'push_suppressed', 'false') = 'true'
  then
    new.status := 'skipped';
    new.skip_reason := coalesce(v_notification.metadata ->> 'push_suppression_reason', 'teacher_delivery_preference');
    new.completed_at := now();
    new.locked_at := null;
    new.locked_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_teacher_notification_queue_preferences_trigger on public.notification_delivery_queue;
create trigger apply_teacher_notification_queue_preferences_trigger
before insert or update on public.notification_delivery_queue
for each row execute function public.apply_teacher_notification_queue_preferences();

create or replace function public.get_teacher_notifications_page(
  p_bucket text default 'all',
  p_category text default 'all',
  p_subject_id bigint default null,
  p_unread_only boolean default false,
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
  v_teacher_id uuid := auth.uid();
  v_bucket text := lower(trim(coalesce(p_bucket, 'all')));
  v_category text := lower(trim(coalesce(p_category, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  if v_bucket not in ('all', 'critical', 'informative') then
    raise exception 'Unsupported notification bucket';
  end if;
  if v_category not in ('all', 'students', 'review', 'courses', 'system', 'audit') then
    raise exception 'Unsupported notification category';
  end if;

  with base as (
    select
      n.*,
      public.teacher_notification_severity(n.type, n.title, n.metadata) as severity,
      public.teacher_notification_category(n.type, n.title, n.action_url, n.metadata) as category,
      public.teacher_notification_subject_id(n.metadata) as subject_id
    from public.notifications n
    where n.user_id = v_teacher_id
      and n.audience = 'teacher'
      and n.deleted_at is null
  ), filtered as (
    select *
    from base
    where (v_bucket = 'all' or severity = v_bucket)
      and (v_category = 'all' or category = v_category)
      and (p_subject_id is null or subject_id = p_subject_id)
      and (not coalesce(p_unread_only, false) or read_at is null)
  ), candidates as (
    select *
    from filtered
    where p_cursor_created_at is null
      or (created_at, id) < (
        p_cursor_created_at,
        coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
      )
    order by created_at desc, id desc
    limit v_limit + 1
  ), numbered as (
    select candidates.*, row_number() over (order by created_at desc, id desc) as row_number
    from candidates
  ), page as (
    select * from numbered where row_number <= v_limit
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'type', page.type,
          'title', page.title,
          'description', page.description,
          'icon', page.icon,
          'color', page.color,
          'created_at', page.created_at,
          'read_at', page.read_at,
          'action_url', page.action_url,
          'related_id', page.related_id,
          'metadata', page.metadata,
          'severity', page.severity,
          'category', page.category,
          'subject_id', page.subject_id
        ) order by page.created_at desc, page.id desc
      ) from page
    ), '[]'::jsonb),
    'has_more', (select count(*) > v_limit from numbered),
    'next_cursor_created_at', (select created_at from page order by created_at asc, id asc limit 1),
    'next_cursor_id', (select id from page order by created_at asc, id asc limit 1),
    'total', (select count(*) from filtered),
    'unread_count', (select count(*) from filtered where read_at is null),
    'critical_count', (select count(*) from base where severity = 'critical'),
    'informative_count', (select count(*) from base where severity = 'informative')
  ) into v_result;

  return coalesce(v_result, jsonb_build_object(
    'rows', '[]'::jsonb,
    'has_more', false,
    'total', 0,
    'unread_count', 0,
    'critical_count', 0,
    'informative_count', 0
  ));
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
    and ah.manual_review_status in ('pending', 'needs_changes', 'in_review');

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

create or replace function public.get_teacher_notification_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  select jsonb_build_object(
    'global', jsonb_build_object(
      'muted_until', np.teacher_notifications_muted_until,
      'digest_frequency', np.teacher_digest_frequency,
      'digest_hour', np.teacher_digest_hour,
      'digest_weekday', np.teacher_digest_weekday,
      'last_digest_sent_at', np.teacher_digest_last_sent_at,
      'reminder_email', np.teacher_reminder_email,
      'support_preferred_channel', np.support_preferred_channel,
      'support_contact_email', np.support_contact_email
    ),
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'subject_id', s.id,
          'subject_name', s.name,
          'critical_enabled', coalesce(preference.critical_enabled, true),
          'informative_enabled', coalesce(preference.informative_enabled, true),
          'digest_enabled', coalesce(preference.digest_enabled, true),
          'muted_until', preference.muted_until
        ) order by s.name, s.id
      )
      from public.subjects s
      left join public.teacher_notification_course_preferences preference
        on preference.teacher_id = v_teacher_id and preference.subject_id = s.id
      where s.teacher_id = v_teacher_id
        and not coalesce(s.is_archived, false)
    ), '[]'::jsonb),
    'digest_history', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', history.id,
          'frequency', history.frequency,
          'status', history.status,
          'period_start', history.period_start,
          'period_end', history.period_end,
          'sent_at', history.sent_at,
          'recipient_email', history.recipient_email,
          'last_error_message', history.last_error_message
        ) order by history.created_at desc, history.id desc
      )
      from (
        select delivery.*
        from public.teacher_digest_deliveries delivery
        where delivery.teacher_id = v_teacher_id
        order by delivery.created_at desc, delivery.id desc
        limit 10
      ) history
    ), '[]'::jsonb)
  )
  into v_result
  from public.user_notification_preferences np
  where np.user_id = v_teacher_id;

  if v_result is null then
    insert into public.user_notification_preferences(user_id)
    values (v_teacher_id)
    on conflict (user_id) do nothing;
    return public.get_teacher_notification_settings();
  end if;

  return v_result;
end;
$$;

create or replace function public.set_teacher_notifications_mute(p_until timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_until timestamptz := p_until;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  if v_until is not null and v_until > now() + interval '7 days' then
    raise exception 'Notifications can only be muted for up to seven days';
  end if;
  if v_until is not null and v_until <= now() then
    v_until := null;
  end if;

  insert into public.user_notification_preferences(user_id, teacher_notifications_muted_until)
  values (v_teacher_id, v_until)
  on conflict (user_id) do update
  set teacher_notifications_muted_until = excluded.teacher_notifications_muted_until,
      updated_at = now();

  return public.get_teacher_notification_settings();
end;
$$;

create or replace function public.set_teacher_course_notification_preference(
  p_subject_id bigint,
  p_critical_enabled boolean,
  p_informative_enabled boolean,
  p_digest_enabled boolean,
  p_muted_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_preference public.teacher_notification_course_preferences%rowtype;
begin
  if not exists (
    select 1 from public.subjects s
    where s.id = p_subject_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Teacher course not found';
  end if;

  if p_muted_until is not null and p_muted_until > now() + interval '30 days' then
    raise exception 'A course can only be muted for up to thirty days';
  end if;

  insert into public.teacher_notification_course_preferences(
    teacher_id,
    subject_id,
    critical_enabled,
    informative_enabled,
    digest_enabled,
    muted_until
  ) values (
    v_teacher_id,
    p_subject_id,
    coalesce(p_critical_enabled, true),
    coalesce(p_informative_enabled, true),
    coalesce(p_digest_enabled, true),
    case when p_muted_until > now() then p_muted_until else null end
  )
  on conflict (teacher_id, subject_id) do update
  set critical_enabled = excluded.critical_enabled,
      informative_enabled = excluded.informative_enabled,
      digest_enabled = excluded.digest_enabled,
      muted_until = excluded.muted_until,
      updated_at = now()
  returning * into v_preference;

  return public.get_teacher_notification_settings();
end;
$$;

create or replace function public.set_teacher_digest_preference(
  p_frequency text,
  p_recipient_email text default null,
  p_hour smallint default 7,
  p_weekday smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_frequency text := lower(trim(coalesce(p_frequency, 'off')));
  v_email text := nullif(lower(trim(coalesce(p_recipient_email, ''))), '');
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;
  if v_frequency not in ('off', 'daily', 'weekly') then
    raise exception 'Unsupported digest frequency';
  end if;
  if p_hour not between 0 and 23 then
    raise exception 'Digest hour must be between 0 and 23';
  end if;
  if p_weekday not between 1 and 7 then
    raise exception 'Digest weekday must be between 1 and 7';
  end if;
  if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid digest email';
  end if;

  insert into public.user_notification_preferences(
    user_id,
    email_enabled,
    teacher_digest_frequency,
    teacher_reminder_email,
    teacher_digest_hour,
    teacher_digest_weekday,
    teacher_digest_unsubscribed_at
  ) values (
    v_teacher_id,
    v_frequency <> 'off',
    v_frequency,
    v_email,
    p_hour,
    p_weekday,
    case when v_frequency = 'off' then now() else null end
  )
  on conflict (user_id) do update
  set email_enabled = case when v_frequency = 'off' then user_notification_preferences.email_enabled else true end,
      teacher_digest_frequency = v_frequency,
      teacher_reminder_email = coalesce(v_email, user_notification_preferences.teacher_reminder_email),
      teacher_digest_hour = p_hour,
      teacher_digest_weekday = p_weekday,
      teacher_digest_unsubscribed_at = case when v_frequency = 'off' then now() else null end,
      updated_at = now();

  return public.get_teacher_notification_settings();
end;
$$;

create or replace function public.set_teacher_support_preference(
  p_channel text,
  p_contact_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_channel text := lower(trim(coalesce(p_channel, 'in_app')));
  v_email text := nullif(lower(trim(coalesce(p_contact_email, ''))), '');
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role_id = 'teacher' and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;
  if v_channel not in ('in_app', 'email', 'both') then
    raise exception 'Unsupported support channel';
  end if;
  if v_channel in ('email', 'both') and (v_email is null or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'A valid support contact email is required';
  end if;

  insert into public.user_notification_preferences(user_id, support_preferred_channel, support_contact_email)
  values (v_teacher_id, v_channel, v_email)
  on conflict (user_id) do update
  set support_preferred_channel = excluded.support_preferred_channel,
      support_contact_email = excluded.support_contact_email,
      updated_at = now();

  return public.get_teacher_notification_settings();
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
          and attempt.manual_review_status in ('pending', 'needs_changes', 'in_review')
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

revoke all on function public.teacher_notification_severity(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.teacher_notification_category(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.teacher_notification_subject_id(jsonb) from public, anon, authenticated;
revoke all on function public.apply_teacher_notification_delivery_preferences() from public, anon, authenticated;
revoke all on function public.apply_teacher_notification_queue_preferences() from public, anon, authenticated;

revoke all on function public.get_teacher_notifications_page(text, text, bigint, boolean, integer, timestamptz, uuid) from public, anon;
revoke all on function public.get_teacher_notification_center_summary() from public, anon;
revoke all on function public.get_teacher_notification_settings() from public, anon;
revoke all on function public.set_teacher_notifications_mute(timestamptz) from public, anon;
revoke all on function public.set_teacher_course_notification_preference(bigint, boolean, boolean, boolean, timestamptz) from public, anon;
revoke all on function public.set_teacher_digest_preference(text, text, smallint, smallint) from public, anon;
revoke all on function public.set_teacher_support_preference(text, text) from public, anon;
grant execute on function public.get_teacher_notifications_page(text, text, bigint, boolean, integer, timestamptz, uuid) to authenticated;
grant execute on function public.get_teacher_notification_center_summary() to authenticated;
grant execute on function public.get_teacher_notification_settings() to authenticated;
grant execute on function public.set_teacher_notifications_mute(timestamptz) to authenticated;
grant execute on function public.set_teacher_course_notification_preference(bigint, boolean, boolean, boolean, timestamptz) to authenticated;
grant execute on function public.set_teacher_digest_preference(text, text, smallint, smallint) to authenticated;
grant execute on function public.set_teacher_support_preference(text, text) to authenticated;

create table if not exists public.support_contact_channels (
  channel_key text primary key,
  label text not null,
  channel_type text not null check (channel_type in ('in_app', 'email', 'url')),
  value text,
  description text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.support_contact_channels(channel_key, label, channel_type, value, description, sort_order)
values
  ('in_app', 'Centro de ayuda', 'in_app', null, 'Crea un ticket y continúa la conversación dentro de OmniQuest.', 10)
on conflict (channel_key) do nothing;

alter table public.support_contact_channels enable row level security;
revoke all on public.support_contact_channels from public, anon, authenticated;
grant select, insert, update, delete on public.support_contact_channels to authenticated;

drop policy if exists "support_contact_channels_read_enabled" on public.support_contact_channels;
create policy "support_contact_channels_read_enabled"
on public.support_contact_channels for select to authenticated
using (enabled or public.is_admin());

drop policy if exists "support_contact_channels_admin_insert" on public.support_contact_channels;
create policy "support_contact_channels_admin_insert"
on public.support_contact_channels for insert to authenticated
with check (public.is_admin());

drop policy if exists "support_contact_channels_admin_update" on public.support_contact_channels;
create policy "support_contact_channels_admin_update"
on public.support_contact_channels for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "support_contact_channels_admin_delete" on public.support_contact_channels;
create policy "support_contact_channels_admin_delete"
on public.support_contact_channels for delete to authenticated
using (public.is_admin());

alter table public.user_support_tickets
  add column if not exists preferred_channel text not null default 'in_app';

alter table public.user_support_tickets
  drop constraint if exists user_support_tickets_preferred_channel_check;
alter table public.user_support_tickets
  add constraint user_support_tickets_preferred_channel_check
  check (preferred_channel in ('in_app', 'email', 'both'));

create table if not exists public.support_email_deliveries (
  id bigint generated by default as identity primary key,
  ticket_id bigint not null references public.user_support_tickets(id) on delete cascade,
  message_id bigint references public.support_ticket_messages(id) on delete set null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'retry', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid,
  provider_message_id text,
  sent_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, recipient_id)
);

create index if not exists support_email_deliveries_due_idx
  on public.support_email_deliveries(status, next_attempt_at, id);
create index if not exists support_email_deliveries_recipient_idx
  on public.support_email_deliveries(recipient_id, created_at desc, id desc);

alter table public.support_email_deliveries enable row level security;
revoke all on public.support_email_deliveries from public, anon, authenticated;
grant select on public.support_email_deliveries to authenticated;

drop policy if exists "support_email_deliveries_select_own" on public.support_email_deliveries;
create policy "support_email_deliveries_select_own"
on public.support_email_deliveries for select to authenticated
using (recipient_id = auth.uid());

create or replace function public.add_support_ticket_message(
  p_ticket_id bigint,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_message public.support_ticket_messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 10000 then
    raise exception 'Support message must contain between 1 and 10000 characters';
  end if;

  select ticket.role
  into v_role
  from public.user_support_tickets ticket
  where ticket.id = p_ticket_id
    and ticket.user_id = v_user_id
    and ticket.status <> 'closed'
  for update;

  if v_role is null then
    raise exception 'Open support ticket not found';
  end if;

  insert into public.support_ticket_messages(ticket_id, author_id, author_role, body)
  values (p_ticket_id, v_user_id, case when v_role = 'teacher' then 'teacher' else 'student' end, trim(p_body))
  returning * into v_message;

  return to_jsonb(v_message);
end;
$$;

create or replace function public.get_own_support_tickets_page(
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id bigint,
  user_id uuid,
  role text,
  subject text,
  message text,
  category text,
  status text,
  priority text,
  preferred_channel text,
  contact_email text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  last_response_at timestamptz,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  message_count bigint,
  attachment_count bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    ticket.id,
    ticket.user_id,
    ticket.role,
    ticket.subject,
    ticket.message,
    ticket.category,
    ticket.status,
    ticket.priority,
    ticket.preferred_channel,
    ticket.contact_email,
    ticket.created_at,
    ticket.updated_at,
    ticket.resolved_at,
    ticket.last_response_at,
    ticket.first_response_due_at,
    ticket.resolution_due_at,
    ticket.first_responded_at,
    (select count(*) from public.support_ticket_messages message where message.ticket_id = ticket.id),
    (select count(*) from public.support_ticket_attachments attachment where attachment.ticket_id = ticket.id),
    count(*) over()
  from public.user_support_tickets ticket
  where ticket.user_id = v_user_id
  order by ticket.updated_at desc, ticket.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_support_thread_page(
  p_ticket_id bigint,
  p_limit integer default 30,
  p_before_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.user_support_tickets ticket
    where ticket.id = p_ticket_id
      and (ticket.user_id = v_user_id or public.is_admin())
  ) then
    raise exception 'Support ticket access denied';
  end if;

  with candidates as (
    select message.*
    from public.support_ticket_messages message
    where message.ticket_id = p_ticket_id
      and (p_before_id is null or message.id < p_before_id)
    order by message.id desc
    limit v_limit + 1
  ), page_desc as (
    select * from candidates order by id desc limit v_limit
  ), page as (
    select * from page_desc order by id asc
  )
  select jsonb_build_object(
    'messages', coalesce((
      select jsonb_agg(to_jsonb(page) order by page.id asc) from page
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(to_jsonb(attachment) order by attachment.created_at, attachment.id)
      from public.support_ticket_attachments attachment
      where attachment.ticket_id = p_ticket_id
        and (
          attachment.message_id is null
          or attachment.message_id in (select page.id from page)
        )
    ), '[]'::jsonb),
    'has_more', (select count(*) > v_limit from candidates),
    'next_before_id', (select min(id) from page)
  ) into v_result;

  return coalesce(v_result, jsonb_build_object(
    'messages', '[]'::jsonb,
    'attachments', '[]'::jsonb,
    'has_more', false,
    'next_before_id', null
  ));
end;
$$;

create or replace function public.get_support_contact_channels()
returns setof public.support_contact_channels
language sql
security definer
set search_path = public
as $$
  select channel.*
  from public.support_contact_channels channel
  where channel.enabled
  order by channel.sort_order, channel.channel_key;
$$;

create or replace function public.get_own_support_email_history(
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id bigint,
  ticket_id bigint,
  message_id bigint,
  subject text,
  status text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  select
    delivery.id,
    delivery.ticket_id,
    delivery.message_id,
    delivery.subject,
    delivery.status,
    delivery.sent_at,
    delivery.error_message,
    delivery.created_at,
    count(*) over()
  from public.support_email_deliveries delivery
  where delivery.recipient_id = v_user_id
  order by delivery.created_at desc, delivery.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.enqueue_support_email_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.user_support_tickets%rowtype;
  v_channel text;
  v_recipient_email text;
begin
  if new.author_role <> 'admin' then
    return new;
  end if;

  select * into v_ticket
  from public.user_support_tickets ticket
  where ticket.id = new.ticket_id;

  if not found then
    return new;
  end if;

  select
    coalesce(v_ticket.preferred_channel, preference.support_preferred_channel, 'in_app'),
    coalesce(
      nullif(trim(preference.support_contact_email), ''),
      nullif(trim(v_ticket.contact_email), ''),
      nullif(trim(profile.email), ''),
      auth_user.email
    )
  into v_channel, v_recipient_email
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  left join public.user_notification_preferences preference on preference.user_id = profile.id
  where profile.id = v_ticket.user_id;

  if v_channel not in ('email', 'both') or v_recipient_email is null then
    return new;
  end if;

  insert into public.support_email_deliveries(
    ticket_id,
    message_id,
    recipient_id,
    recipient_email,
    subject
  ) values (
    v_ticket.id,
    new.id,
    v_ticket.user_id,
    v_recipient_email,
    format('[OmniQuest #%s] %s', v_ticket.id, left(v_ticket.subject, 160))
  )
  on conflict (message_id, recipient_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_support_email_delivery_trigger on public.support_ticket_messages;
create trigger enqueue_support_email_delivery_trigger
after insert on public.support_ticket_messages
for each row execute function public.enqueue_support_email_delivery();

create or replace function public.claim_support_email_delivery_batch(
  p_worker_id uuid,
  p_limit integer default 25
)
returns setof public.support_email_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select delivery.id
    from public.support_email_deliveries delivery
    where delivery.status in ('queued', 'retry')
      and delivery.next_attempt_at <= now()
      and delivery.attempts < delivery.max_attempts
    order by delivery.next_attempt_at, delivery.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.support_email_deliveries delivery
    set status = 'processing',
        attempts = delivery.attempts + 1,
        locked_at = now(),
        locked_by = p_worker_id,
        updated_at = now()
    from due
    where delivery.id = due.id
    returning delivery.*
  )
  select * from claimed;
end;
$$;

create or replace function public.finish_support_email_delivery(
  p_id bigint,
  p_status text,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_after_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('sent', 'retry', 'failed', 'cancelled') then
    raise exception 'Unsupported support email status';
  end if;

  update public.support_email_deliveries delivery
  set status = p_status,
      provider_message_id = coalesce(p_provider_message_id, delivery.provider_message_id),
      sent_at = case when p_status = 'sent' then now() else delivery.sent_at end,
      next_attempt_at = case when p_status = 'retry'
        then now() + make_interval(secs => greatest(coalesce(p_retry_after_seconds, 300), 30))
        else delivery.next_attempt_at
      end,
      error_code = p_error_code,
      error_message = left(p_error_message, 500),
      locked_at = null,
      locked_by = null,
      updated_at = now()
  where delivery.id = p_id;

  if not found then
    raise exception 'Support email delivery not found';
  end if;
end;
$$;

create or replace function public.invoke_support_email_processor()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'project_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'support_email_queue_secret'
  order by created_at desc
  limit 1;

  if nullif(trim(v_url), '') is null or nullif(trim(v_secret), '') is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/process-support-email-delivery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 15000
  );
end;
$$;

revoke all on function public.enqueue_support_email_delivery() from public, anon, authenticated;
revoke all on function public.add_support_ticket_message(bigint, text) from public, anon;
revoke all on function public.get_own_support_tickets_page(integer, integer) from public, anon;
revoke all on function public.get_support_thread_page(bigint, integer, bigint) from public, anon;
revoke all on function public.get_support_contact_channels() from public, anon;
revoke all on function public.get_own_support_email_history(integer, integer) from public, anon;
revoke all on function public.claim_support_email_delivery_batch(uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_support_email_delivery(bigint, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.invoke_support_email_processor() from public, anon, authenticated;
grant execute on function public.add_support_ticket_message(bigint, text) to authenticated;
grant execute on function public.get_own_support_tickets_page(integer, integer) to authenticated;
grant execute on function public.get_support_thread_page(bigint, integer, bigint) to authenticated;
grant execute on function public.get_support_contact_channels() to authenticated;
grant execute on function public.get_own_support_email_history(integer, integer) to authenticated;
grant execute on function public.claim_support_email_delivery_batch(uuid, integer) to service_role;
grant execute on function public.finish_support_email_delivery(bigint, text, text, text, text, integer) to service_role;
grant execute on function public.invoke_support_email_processor() to service_role;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'omniquest-support-email-delivery';
exception when undefined_table then
  null;
end;
$$;

select cron.schedule(
  'omniquest-support-email-delivery',
  '*/10 * * * *',
  $$select public.invoke_support_email_processor();$$
);

notify pgrst, 'reload schema';

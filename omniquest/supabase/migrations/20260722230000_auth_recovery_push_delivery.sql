create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.teacher_student_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  classroom_id bigint references public.classrooms(id) on delete set null,
  status text not null default 'reserved'
    check (status in ('reserved', 'sent', 'failed')),
  delivery_mode text,
  error_code text,
  error_message text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_student_recovery_teacher_created_idx
  on public.teacher_student_recovery_requests(teacher_id, created_at desc);
create index if not exists teacher_student_recovery_student_created_idx
  on public.teacher_student_recovery_requests(student_id, created_at desc);

alter table public.teacher_student_recovery_requests enable row level security;
revoke all on public.teacher_student_recovery_requests from public, anon, authenticated;

create or replace function public.reserve_teacher_student_recovery_request(
  p_teacher_id uuid,
  p_student_id uuid,
  p_subject_id bigint,
  p_classroom_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_expires_at timestamptz := now() + interval '30 minutes';
  v_recent_count integer;
begin
  if p_teacher_id is null or p_student_id is null or p_subject_id is null then
    raise exception 'Missing recovery request context';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_teacher_id
      and p.role_id = 'teacher'
      and coalesce(p.active, true)
  ) then
    raise exception 'Teacher access required';
  end if;

  if not exists (
    select 1
    from public.subjects s
    where s.id = p_subject_id
      and s.teacher_id = p_teacher_id
      and coalesce(s.is_archived, false) = false
  ) then
    raise exception 'Course not found or not owned by teacher';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_student_id
      and p.role_id in ('student', 'guest')
      and coalesce(p.active, true)
  ) then
    raise exception 'Student not found or inactive';
  end if;

  if p_classroom_id is not null and not exists (
    select 1
    from public.classrooms c
    where c.id = p_classroom_id
      and c.subject_id = p_subject_id
      and coalesce(c.active, true)
  ) then
    raise exception 'Classroom not found for this course';
  end if;

  if not exists (
    select 1
    from public.enrollments e
    where e.student_id = p_student_id
      and e.subject_id = p_subject_id
      and (p_classroom_id is null or e.classroom_id = p_classroom_id)
  ) then
    raise exception 'Student is not enrolled in this course or classroom';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_teacher_id::text || ':' || p_student_id::text, 0)
  );

  if exists (
    select 1
    from public.teacher_student_recovery_requests r
    where r.teacher_id = p_teacher_id
      and r.student_id = p_student_id
      and r.created_at >= now() - interval '15 minutes'
  ) then
    raise exception 'A recovery link was requested recently. Wait 15 minutes before trying again.';
  end if;

  select count(*)::integer
  into v_recent_count
  from public.teacher_student_recovery_requests r
  where r.teacher_id = p_teacher_id
    and r.student_id = p_student_id
    and r.created_at >= now() - interval '24 hours';

  if v_recent_count >= 3 then
    raise exception 'Daily recovery request limit reached for this student.';
  end if;

  insert into public.teacher_student_recovery_requests (
    teacher_id,
    student_id,
    subject_id,
    classroom_id,
    expires_at
  ) values (
    p_teacher_id,
    p_student_id,
    p_subject_id,
    p_classroom_id,
    v_expires_at
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'request_id', v_request_id,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.finish_teacher_student_recovery_request(
  p_request_id uuid,
  p_status text,
  p_delivery_mode text default null,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.teacher_student_recovery_requests%rowtype;
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'Unsupported recovery request status';
  end if;

  select *
  into v_request
  from public.teacher_student_recovery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Recovery request not found';
  end if;

  if v_request.status = 'sent' then
    return;
  end if;

  update public.teacher_student_recovery_requests
  set status = p_status,
      delivery_mode = nullif(trim(coalesce(p_delivery_mode, '')), ''),
      error_code = nullif(trim(coalesce(p_error_code, '')), ''),
      error_message = left(nullif(trim(coalesce(p_error_message, '')), ''), 500),
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      updated_at = now()
  where id = p_request_id;

  if p_status = 'sent' then
    insert into public.teacher_audit_logs (
      teacher_id,
      action,
      target_table,
      target_id,
      metadata
    ) values (
      v_request.teacher_id,
      'teacher.student.password_recovery_requested',
      'profiles',
      v_request.student_id::text,
      jsonb_build_object(
        'subject_id', v_request.subject_id,
        'classroom_id', v_request.classroom_id,
        'recovery_request_id', v_request.id,
        'expires_in_minutes', 30,
        'delivery_mode', nullif(trim(coalesce(p_delivery_mode, '')), '')
      )
    );
  end if;
end;
$$;

revoke all on function public.reserve_teacher_student_recovery_request(uuid, uuid, bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.finish_teacher_student_recovery_request(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_teacher_student_recovery_request(uuid, uuid, bigint, bigint)
  to service_role;
grant execute on function public.finish_teacher_student_recovery_request(uuid, text, text, text, text)
  to service_role;

create table if not exists public.notification_delivery_queue (
  id bigint generated by default as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'push' check (channel = 'push'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'waiting_receipt', 'completed', 'failed', 'skipped', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  delivery_cycle integer not null default 1 check (delivery_cycle > 0),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid,
  skip_reason text,
  last_error_code text,
  last_error_message text,
  enqueued_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create index if not exists notification_delivery_queue_pending_idx
  on public.notification_delivery_queue(status, next_attempt_at, priority, id)
  where status in ('pending', 'processing');
create index if not exists notification_delivery_queue_user_created_idx
  on public.notification_delivery_queue(user_id, created_at desc);

create table if not exists public.notification_push_deliveries (
  id bigint generated by default as identity primary key,
  queue_id bigint not null references public.notification_delivery_queue(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivery_cycle integer not null check (delivery_cycle > 0),
  push_token_id bigint references public.push_tokens(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'ticketed', 'delivered', 'failed', 'skipped')),
  expo_ticket_id text,
  attempt_number integer not null default 1 check (attempt_number > 0),
  error_code text,
  error_message text,
  sent_at timestamptz,
  receipt_checked_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_id, delivery_cycle, push_token_id)
);

create unique index if not exists notification_push_deliveries_ticket_uidx
  on public.notification_push_deliveries(expo_ticket_id)
  where expo_ticket_id is not null;
create index if not exists notification_push_deliveries_receipt_idx
  on public.notification_push_deliveries(status, sent_at)
  where status = 'ticketed';
create index if not exists notification_push_deliveries_queue_idx
  on public.notification_push_deliveries(queue_id, delivery_cycle, status);
create index if not exists notification_push_deliveries_user_sent_idx
  on public.notification_push_deliveries(user_id, sent_at desc);

alter table public.notification_delivery_queue enable row level security;
alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_delivery_queue from public, anon, authenticated;
revoke all on sequence public.notification_delivery_queue_id_seq from public, anon, authenticated;
revoke all on public.notification_push_deliveries from public, anon, authenticated;
revoke all on sequence public.notification_push_deliveries_id_seq from public, anon, authenticated;

create or replace function public.enqueue_notification_push_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_priority text;
begin
  if new.deleted_at is not null then
    update public.notification_delivery_queue
    set status = 'cancelled',
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where notification_id = new.id
      and channel = 'push'
      and status not in ('completed', 'failed', 'skipped', 'cancelled');
    return new;
  end if;

  v_priority := case lower(coalesce(new.metadata->>'push_priority', 'normal'))
    when 'high' then 'high'
    when 'low' then 'low'
    else 'normal'
  end;

  insert into public.notification_delivery_queue as queue_row (
    notification_id,
    user_id,
    channel,
    status,
    priority,
    delivery_cycle,
    attempts,
    next_attempt_at,
    enqueued_at,
    completed_at,
    updated_at
  ) values (
    new.id,
    new.user_id,
    'push',
    'pending',
    v_priority,
    1,
    0,
    now(),
    now(),
    null,
    now()
  )
  on conflict (notification_id, channel) do update
  set user_id = excluded.user_id,
      priority = excluded.priority,
      status = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.status
        else 'pending'
      end,
      delivery_cycle = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.delivery_cycle
        else queue_row.delivery_cycle + 1
      end,
      attempts = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.attempts
        else 0
      end,
      next_attempt_at = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.next_attempt_at
        else now()
      end,
      enqueued_at = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.enqueued_at
        else now()
      end,
      completed_at = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.completed_at
        else null
      end,
      skip_reason = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.skip_reason
        else null
      end,
      last_error_code = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.last_error_code
        else null
      end,
      last_error_message = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.last_error_message
        else null
      end,
      locked_at = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.locked_at
        else null
      end,
      locked_by = case
        when queue_row.status in ('pending', 'processing', 'waiting_receipt') then queue_row.locked_by
        else null
      end,
      updated_at = now()
  where queue_row.status in ('pending', 'processing', 'waiting_receipt')
     or queue_row.updated_at <= now() - interval '15 minutes';

  return new;
end;
$$;

revoke all on function public.enqueue_notification_push_delivery() from public, anon, authenticated;

drop trigger if exists enqueue_notification_push_delivery on public.notifications;
create trigger enqueue_notification_push_delivery
after insert or update of title, description, action_url, metadata, deleted_at
on public.notifications
for each row execute function public.enqueue_notification_push_delivery();

create or replace function public.claim_notification_delivery_batch(
  p_worker_id uuid,
  p_limit integer default 50
)
returns table (
  queue_id bigint,
  notification_id uuid,
  user_id uuid,
  delivery_cycle integer,
  attempts integer,
  max_attempts integer,
  priority text
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select q.id
    from public.notification_delivery_queue q
    where (
      q.status = 'pending'
      or (q.status = 'processing' and q.locked_at < now() - interval '5 minutes')
    )
      and q.next_attempt_at <= now()
      and q.attempts < q.max_attempts
    order by
      case q.priority when 'high' then 0 when 'normal' then 1 else 2 end,
      q.next_attempt_at,
      q.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.notification_delivery_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      updated_at = now()
  from candidates c
  where q.id = c.id
  returning q.id, q.notification_id, q.user_id, q.delivery_cycle,
            q.attempts, q.max_attempts, q.priority;
$$;

revoke all on function public.claim_notification_delivery_batch(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_delivery_batch(uuid, integer)
  to service_role;

create or replace function public.get_admin_push_delivery_metrics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'queued', (select count(*) from public.notification_delivery_queue q where q.created_at >= v_since),
    'pending', (select count(*) from public.notification_delivery_queue q where q.created_at >= v_since and q.status in ('pending', 'processing', 'waiting_receipt')),
    'completed', (select count(*) from public.notification_delivery_queue q where q.created_at >= v_since and q.status = 'completed'),
    'failed', (select count(*) from public.notification_delivery_queue q where q.created_at >= v_since and q.status = 'failed'),
    'skipped', (select count(*) from public.notification_delivery_queue q where q.created_at >= v_since and q.status = 'skipped'),
    'tickets', (select count(*) from public.notification_push_deliveries d where d.created_at >= v_since and d.status in ('ticketed', 'delivered')),
    'delivered', (select count(*) from public.notification_push_deliveries d where d.created_at >= v_since and d.status = 'delivered'),
    'device_failures', (select count(*) from public.notification_push_deliveries d where d.created_at >= v_since and d.status = 'failed'),
    'retrying', (select count(*) from public.notification_delivery_queue q where q.created_at >= v_since and q.attempts > 1 and q.status in ('pending', 'processing', 'waiting_receipt')),
    'delivery_rate', coalesce((
      select round(
        100.0 * count(*) filter (where d.status = 'delivered')
        / nullif(count(*) filter (where d.status in ('delivered', 'failed')), 0),
        1
      )
      from public.notification_push_deliveries d
      where d.created_at >= v_since
    ), 0)
  );
end;
$$;

revoke all on function public.get_admin_push_delivery_metrics(integer) from public, anon;
grant execute on function public.get_admin_push_delivery_metrics(integer) to authenticated;

create or replace function public.invoke_notification_delivery_worker()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_project_url text;
  v_secret text;
  v_request_id bigint;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  execute $query$
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'project_url'
    order by created_at desc
    limit 1
  $query$ into v_project_url;

  execute $query$
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'push_queue_secret'
    order by created_at desc
    limit 1
  $query$ into v_secret;

  if nullif(trim(coalesce(v_project_url, '')), '') is null
     or nullif(trim(coalesce(v_secret, '')), '') is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/process-notification-delivery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('limit', 25)
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.invoke_notification_delivery_worker() from public, anon, authenticated;
grant execute on function public.invoke_notification_delivery_worker() to service_role;

do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'omniquest-notification-delivery'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'omniquest-notification-delivery',
    '* * * * *',
    'select public.invoke_notification_delivery_worker();'
  );
end
$$;

comment on table public.teacher_student_recovery_requests is
  'Rate-limited audit trail for teacher-requested password recovery links. Recovery links are never stored.';
comment on table public.notification_delivery_queue is
  'Durable queue for asynchronous delivery of persistent notifications.';
comment on table public.notification_push_deliveries is
  'Per-device Expo push tickets, receipts and delivery errors.';
comment on function public.get_admin_push_delivery_metrics(integer) is
  'Returns push queue, retry and receipt metrics for administrators.';

notify pgrst, 'reload schema';

-- Administrative push center: explicit permissions, private observability APIs,
-- controlled retry/cancel actions and analytics hardening.

update public.admin_roles
set permissions = (
  select array_agg(distinct permission order by permission)
  from unnest(public.admin_roles.permissions || array['notifications.read', 'notifications.manage']::text[]) as permission
), updated_at = now()
where id = 'super_admin';

-- Client applications register devices through protected RPCs. The administrative
-- center never receives direct table access or complete Expo push tokens.
revoke all on public.notification_delivery_queue from authenticated;
revoke all on public.notification_push_deliveries from authenticated;
revoke all on public.push_tokens from authenticated;

create index if not exists notification_delivery_queue_status_created_idx
  on public.notification_delivery_queue(status, created_at desc, id desc);
create index if not exists notifications_type_created_idx
  on public.notifications(type, created_at desc);

create or replace function public.get_admin_push_delivery_metrics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_oldest_pending timestamptz;
  v_stale_pending integer := 0;
  v_stale_receipts integer := 0;
  v_failed_24h integer := 0;
begin
  if not public.admin_has_permission('notifications.read') then raise exception 'Notification monitoring permission required'; end if;

  select min(queue.created_at), count(*) filter (where queue.created_at < now() - interval '5 minutes')::integer
  into v_oldest_pending, v_stale_pending
  from public.notification_delivery_queue queue
  where queue.status = 'pending';

  select count(*)::integer into v_stale_receipts
  from public.notification_delivery_queue queue
  where queue.status = 'waiting_receipt'
    and queue.updated_at < now() - interval '30 minutes';

  select count(*)::integer into v_failed_24h
  from public.notification_delivery_queue queue
  where queue.status = 'failed'
    and queue.updated_at >= now() - interval '24 hours';

  return jsonb_build_object(
    'days', v_days,
    'queued', (select count(*) from public.notification_delivery_queue queue where queue.status = 'pending'),
    'processing', (select count(*) from public.notification_delivery_queue queue where queue.status = 'processing'),
    'waiting_receipt', (select count(*) from public.notification_delivery_queue queue where queue.status = 'waiting_receipt'),
    'completed', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'completed'),
    'failed', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'failed'),
    'skipped', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'skipped'),
    'cancelled', (select count(*) from public.notification_delivery_queue queue where queue.created_at >= v_since and queue.status = 'cancelled'),
    'tickets', (select count(*) from public.notification_push_deliveries delivery where delivery.created_at >= v_since and delivery.status in ('ticketed', 'delivered')),
    'delivered', (select count(*) from public.notification_push_deliveries delivery where delivery.created_at >= v_since and delivery.status = 'delivered'),
    'device_failures', (select count(*) from public.notification_push_deliveries delivery where delivery.created_at >= v_since and delivery.status = 'failed'),
    'retrying', (select count(*) from public.notification_delivery_queue queue where queue.attempts > 1 and queue.status in ('pending', 'processing', 'waiting_receipt')),
    'oldest_pending_at', v_oldest_pending,
    'stale_pending', v_stale_pending,
    'stale_receipts', v_stale_receipts,
    'failed_24h', v_failed_24h,
    'service_health', case when v_stale_pending > 0 or v_stale_receipts > 0 or v_failed_24h >= 5 then 'attention' else 'operational' end,
    'delivery_rate', (
      select round(
        100.0 * count(*) filter (where delivery.status = 'delivered')
        / nullif(count(*) filter (where delivery.status in ('delivered', 'failed')), 0),
        1
      )
      from public.notification_push_deliveries delivery
      where delivery.created_at >= v_since
    )
  );
end;
$$;

create or replace function public.get_admin_push_delivery_page(
  p_search text default null,
  p_status text default null,
  p_role text default null,
  p_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  queue_id bigint,
  notification_id uuid,
  recipient_id uuid,
  recipient_alias text,
  recipient_role text,
  notification_title text,
  notification_description text,
  notification_type text,
  audience text,
  queue_status text,
  priority text,
  attempts integer,
  max_attempts integer,
  delivery_cycle integer,
  active_devices bigint,
  delivery_devices bigint,
  delivered_devices bigint,
  failed_devices bigint,
  last_error_code text,
  skip_reason text,
  next_attempt_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_role text := nullif(trim(coalesce(p_role, '')), '');
  v_type text := nullif(trim(coalesce(p_type, '')), '');
begin
  if not public.admin_has_permission('notifications.read') then raise exception 'Notification monitoring permission required'; end if;

  return query
  select
    queue.id,
    notification.id,
    profile.id,
    profile.alias,
    profile.role_id,
    notification.title,
    notification.description,
    notification.type,
    notification.audience,
    queue.status,
    queue.priority,
    queue.attempts,
    queue.max_attempts,
    queue.delivery_cycle,
    (select count(*) from public.push_tokens token where token.user_id = queue.user_id and token.active),
    coalesce(delivery_totals.total_devices, 0),
    coalesce(delivery_totals.delivered_devices, 0),
    coalesce(delivery_totals.failed_devices, 0),
    queue.last_error_code,
    queue.skip_reason,
    queue.next_attempt_at,
    queue.created_at,
    queue.updated_at,
    count(*) over()::bigint
  from public.notification_delivery_queue queue
  join public.notifications notification on notification.id = queue.notification_id
  join public.profiles profile on profile.id = queue.user_id
  left join lateral (
    select
      count(*)::bigint as total_devices,
      count(*) filter (where delivery.status = 'delivered')::bigint as delivered_devices,
      count(*) filter (where delivery.status = 'failed')::bigint as failed_devices
    from public.notification_push_deliveries delivery
    where delivery.queue_id = queue.id
      and delivery.delivery_cycle = queue.delivery_cycle
  ) delivery_totals on true
  where (v_search is null or profile.alias ilike '%' || v_search || '%' or coalesce(profile.email, '') ilike '%' || v_search || '%' or notification.title ilike '%' || v_search || '%')
    and (v_status is null or queue.status = v_status)
    and (v_role is null or profile.role_id = v_role)
    and (v_type is null or notification.type = v_type)
    and (p_from is null or queue.created_at >= p_from)
    and (p_to is null or queue.created_at < p_to)
  order by queue.created_at desc, queue.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_admin_push_delivery_detail(p_queue_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_queue public.notification_delivery_queue%rowtype;
  v_notification public.notifications%rowtype;
  v_profile public.profiles%rowtype;
  v_subject_id bigint;
  v_classroom_id bigint;
begin
  if not public.admin_has_permission('notifications.read') then raise exception 'Notification monitoring permission required'; end if;

  select * into v_queue from public.notification_delivery_queue queue where queue.id = p_queue_id;
  if not found then raise exception 'Push delivery not found'; end if;
  select * into v_notification from public.notifications notification where notification.id = v_queue.notification_id;
  select * into v_profile from public.profiles profile where profile.id = v_queue.user_id;

  v_subject_id := case
    when coalesce(v_notification.metadata->>'subject_id', '') ~ '^[0-9]+$' then (v_notification.metadata->>'subject_id')::bigint
    when v_notification.related_table = 'subjects' and coalesce(v_notification.related_id, '') ~ '^[0-9]+$' then v_notification.related_id::bigint
    else null
  end;
  v_classroom_id := case
    when coalesce(v_notification.metadata->>'classroom_id', '') ~ '^[0-9]+$' then (v_notification.metadata->>'classroom_id')::bigint
    when v_notification.related_table = 'classrooms' and coalesce(v_notification.related_id, '') ~ '^[0-9]+$' then v_notification.related_id::bigint
    else null
  end;

  return jsonb_build_object(
    'queue', jsonb_build_object(
      'id', v_queue.id,
      'status', v_queue.status,
      'priority', v_queue.priority,
      'attempts', v_queue.attempts,
      'max_attempts', v_queue.max_attempts,
      'delivery_cycle', v_queue.delivery_cycle,
      'next_attempt_at', v_queue.next_attempt_at,
      'skip_reason', v_queue.skip_reason,
      'last_error_code', v_queue.last_error_code,
      'last_error_message', v_queue.last_error_message,
      'enqueued_at', v_queue.enqueued_at,
      'completed_at', v_queue.completed_at,
      'created_at', v_queue.created_at,
      'updated_at', v_queue.updated_at
    ),
    'notification', jsonb_build_object(
      'id', v_notification.id,
      'title', v_notification.title,
      'description', v_notification.description,
      'type', v_notification.type,
      'audience', v_notification.audience,
      'created_at', v_notification.created_at
    ),
    'recipient', jsonb_build_object(
      'id', v_profile.id,
      'alias', v_profile.alias,
      'role', v_profile.role_id,
      'active', coalesce(v_profile.active, true)
    ),
    'context', jsonb_strip_nulls(jsonb_build_object(
      'related_table', v_notification.related_table,
      'related_id', v_notification.related_id,
      'subject_id', v_subject_id,
      'subject_name', (select subject.name from public.subjects subject where subject.id = v_subject_id),
      'classroom_id', v_classroom_id,
      'classroom_name', (select classroom.name from public.classrooms classroom where classroom.id = v_classroom_id)
    )),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', token.id,
        'platform', token.platform,
        'device_name', token.device_name,
        'app_version', token.app_version,
        'active', token.active,
        'last_seen_at', token.last_seen_at
      ) order by token.active desc, token.last_seen_at desc)
      from public.push_tokens token
      where token.user_id = v_queue.user_id
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', delivery.id,
        'status', delivery.status,
        'attempt_number', delivery.attempt_number,
        'error_code', delivery.error_code,
        'error_message', delivery.error_message,
        'sent_at', delivery.sent_at,
        'receipt_checked_at', delivery.receipt_checked_at,
        'delivered_at', delivery.delivered_at,
        'device', case when token.id is null then null else jsonb_build_object(
          'id', token.id,
          'platform', token.platform,
          'device_name', token.device_name,
          'app_version', token.app_version,
          'active', token.active,
          'last_seen_at', token.last_seen_at
        ) end
      ) order by coalesce(delivery.sent_at, delivery.created_at) desc, delivery.id desc)
      from public.notification_push_deliveries delivery
      left join public.push_tokens token on token.id = delivery.push_token_id
      where delivery.queue_id = v_queue.id
        and delivery.delivery_cycle = v_queue.delivery_cycle
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_retry_push_delivery(p_queue_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queue public.notification_delivery_queue%rowtype;
  v_actor uuid := auth.uid();
begin
  if not public.admin_has_permission('notifications.manage') then raise exception 'Notification management permission required'; end if;
  select * into v_queue from public.notification_delivery_queue queue where queue.id = p_queue_id for update;
  if not found then raise exception 'Push delivery not found'; end if;
  if v_queue.status <> 'failed' then raise exception 'Only failed deliveries can be retried'; end if;

  update public.notification_delivery_queue
  set status = 'pending', delivery_cycle = delivery_cycle + 1, attempts = 0, next_attempt_at = now(), locked_at = null, locked_by = null,
      skip_reason = null, last_error_code = null, last_error_message = null, completed_at = null, updated_at = now()
  where id = p_queue_id;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, metadata)
  values (v_actor, 'admin.notification.retry', 'notification_delivery_queue', p_queue_id::text, jsonb_build_object('notification_id', v_queue.notification_id, 'previous_status', v_queue.status, 'previous_cycle', v_queue.delivery_cycle));

  return jsonb_build_object('ok', true, 'queue_id', p_queue_id, 'status', 'pending', 'delivery_cycle', v_queue.delivery_cycle + 1);
end;
$$;

create or replace function public.admin_cancel_push_delivery(p_queue_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queue public.notification_delivery_queue%rowtype;
  v_actor uuid := auth.uid();
begin
  if not public.admin_has_permission('notifications.manage') then raise exception 'Notification management permission required'; end if;
  select * into v_queue from public.notification_delivery_queue queue where queue.id = p_queue_id for update;
  if not found then raise exception 'Push delivery not found'; end if;
  if v_queue.status <> 'pending' then raise exception 'Only pending deliveries can be cancelled'; end if;

  update public.notification_delivery_queue
  set status = 'cancelled', completed_at = now(), locked_at = null, locked_by = null, updated_at = now()
  where id = p_queue_id;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, metadata)
  values (v_actor, 'admin.notification.cancel', 'notification_delivery_queue', p_queue_id::text, jsonb_build_object('notification_id', v_queue.notification_id, 'previous_status', v_queue.status));

  return jsonb_build_object('ok', true, 'queue_id', p_queue_id, 'status', 'cancelled');
end;
$$;

create or replace function public.admin_request_push_delivery_processing(p_queue_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queue public.notification_delivery_queue%rowtype;
  v_actor uuid := auth.uid();
begin
  if not public.admin_has_permission('notifications.manage') then raise exception 'Notification management permission required'; end if;
  select * into v_queue from public.notification_delivery_queue queue where queue.id = p_queue_id for update;
  if not found then raise exception 'Push delivery not found'; end if;
  if v_queue.status <> 'pending' then raise exception 'Only pending deliveries can be processed now'; end if;
  if v_queue.attempts >= v_queue.max_attempts then raise exception 'Push delivery has reached the retry limit'; end if;

  update public.notification_delivery_queue
  set next_attempt_at = now(), locked_at = null, locked_by = null, updated_at = now()
  where id = p_queue_id;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, metadata)
  values (v_actor, 'admin.notification.process_now', 'notification_delivery_queue', p_queue_id::text, jsonb_build_object('notification_id', v_queue.notification_id));

  return jsonb_build_object('ok', true, 'queue_id', p_queue_id, 'status', 'pending');
end;
$$;

-- Service-only exact claiming is used by the administrative "Procesar ahora"
-- action so it never accidentally processes a different queue item first.
create or replace function public.claim_notification_delivery_item(p_queue_id bigint, p_worker_id uuid)
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
  with candidate as (
    select queue.id
    from public.notification_delivery_queue queue
    where queue.id = p_queue_id
      and (
        queue.status = 'pending'
        or (queue.status = 'processing' and queue.locked_at < now() - interval '5 minutes')
      )
      and queue.next_attempt_at <= now()
      and queue.attempts < queue.max_attempts
    for update skip locked
  )
  update public.notification_delivery_queue queue
  set status = 'processing',
      attempts = queue.attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      updated_at = now()
  from candidate
  where queue.id = candidate.id
  returning queue.id, queue.notification_id, queue.user_id, queue.delivery_cycle,
            queue.attempts, queue.max_attempts, queue.priority;
$$;

revoke all on function public.claim_notification_delivery_item(bigint, uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery_item(bigint, uuid) to service_role;

-- The analytics endpoint must fail closed through the explicit admin permission
-- model. percentile_cont returns double precision on some PostgreSQL resolutions,
-- so cast to numeric before using round(value, scale).
create or replace function public.get_admin_usage_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz;
  v_result jsonb;
begin
  if not public.admin_has_permission('dashboard.read') then raise exception 'Admin dashboard permission required'; end if;
  v_since := now() - make_interval(days => v_days);

  with scoped as (
    select * from public.analytics_events where occurred_at >= v_since
  ),
  first_seen as (
    select reporting_id, min(occurred_at)::date as cohort_day from public.analytics_events where reporting_id is not null group by reporting_id
  ),
  retention as (
    select
      count(*) filter (where cohort_day <= current_date - 1) as d1_eligible,
      count(*) filter (where cohort_day <= current_date - 1 and exists (select 1 from public.analytics_events ae where ae.reporting_id = fs.reporting_id and ae.occurred_at::date = fs.cohort_day + 1)) as d1_retained,
      count(*) filter (where cohort_day <= current_date - 7) as d7_eligible,
      count(*) filter (where cohort_day <= current_date - 7 and exists (select 1 from public.analytics_events ae where ae.reporting_id = fs.reporting_id and ae.occurred_at::date = fs.cohort_day + 7)) as d7_retained,
      count(*) filter (where cohort_day <= current_date - 30) as d30_eligible,
      count(*) filter (where cohort_day <= current_date - 30 and exists (select 1 from public.analytics_events ae where ae.reporting_id = fs.reporting_id and ae.occurred_at::date = fs.cohort_day + 30)) as d30_retained
    from first_seen fs
  )
  select jsonb_build_object(
    'days', v_days,
    'screen_views', count(*) filter (where event_name = 'screen_view'),
    'form_abandoned', count(*) filter (where event_name = 'form_abandoned'),
    'course_joins', count(*) filter (where event_name = 'course_joined'),
    'game_started', count(*) filter (where event_name = 'game_started'),
    'game_finished', count(*) filter (where event_name = 'game_finished'),
    'game_abandoned', count(*) filter (where event_name = 'game_abandoned'),
    'game_errors', count(*) filter (where event_name = 'game_error'),
    'edge_function_errors', count(*) filter (where event_name = 'edge_function_error'),
    'badges_unlocked', count(*) filter (where event_name = 'badge_unlocked'),
    'active_users', count(distinct reporting_id),
    'completion_rate', case when count(*) filter (where event_name = 'game_started') = 0 then 0 else round(100.0 * count(*) filter (where event_name = 'game_finished') / nullif(count(*) filter (where event_name = 'game_started'), 0), 1) end,
    'funnel', jsonb_build_object(
      'screen_view', count(distinct reporting_id) filter (where event_name = 'screen_view'),
      'course_joined', count(distinct reporting_id) filter (where event_name = 'course_joined'),
      'game_started', count(distinct reporting_id) filter (where event_name = 'game_started'),
      'game_finished', count(distinct reporting_id) filter (where event_name = 'game_finished')
    ),
    'retention', (select jsonb_build_object(
      'd1', case when d1_eligible = 0 then 0 else round(100.0 * d1_retained / d1_eligible, 1) end,
      'd7', case when d7_eligible = 0 then 0 else round(100.0 * d7_retained / d7_eligible, 1) end,
      'd30', case when d30_eligible = 0 then 0 else round(100.0 * d30_retained / d30_eligible, 1) end
    ) from retention),
    'question_types', coalesce((select jsonb_object_agg(question_type, total) from (select properties->>'question_type' as question_type, count(*) as total from scoped where event_name = 'question_answered' and nullif(properties->>'question_type', '') is not null group by properties->>'question_type') question_type_rows), '{}'::jsonb),
    'rpc_latency_ms', coalesce((
      select jsonb_build_object(
        'p50', round((percentile_cont(0.5) within group (order by (properties->>'duration_ms')::numeric))::numeric, 1),
        'p95', round((percentile_cont(0.95) within group (order by (properties->>'duration_ms')::numeric))::numeric, 1)
      )
      from scoped
      where event_name = 'rpc_latency' and (properties->>'duration_ms') ~ '^[0-9]+(\.[0-9]+)?$'
    ), jsonb_build_object('p50', 0, 'p95', 0)),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'screen_views', screen_views, 'game_started', game_started, 'game_finished', game_finished, 'game_abandoned', game_abandoned, 'errors', errors) order by day) from (select occurred_at::date as day, count(*) filter (where event_name = 'screen_view') as screen_views, count(*) filter (where event_name = 'game_started') as game_started, count(*) filter (where event_name = 'game_finished') as game_finished, count(*) filter (where event_name = 'game_abandoned') as game_abandoned, count(*) filter (where event_name in ('game_error', 'edge_function_error')) as errors from scoped group by occurred_at::date) daily_rows), '[]'::jsonb)
  ) into v_result
  from scoped;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_admin_push_delivery_metrics(integer) from public, anon;
revoke all on function public.get_admin_push_delivery_page(text, text, text, text, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_admin_push_delivery_detail(bigint) from public, anon;
revoke all on function public.admin_retry_push_delivery(bigint) from public, anon;
revoke all on function public.admin_cancel_push_delivery(bigint) from public, anon;
revoke all on function public.admin_request_push_delivery_processing(bigint) from public, anon;
revoke all on function public.get_admin_usage_analytics(integer) from public, anon;

grant execute on function public.get_admin_push_delivery_metrics(integer) to authenticated;
grant execute on function public.get_admin_push_delivery_page(text, text, text, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_admin_push_delivery_detail(bigint) to authenticated;
grant execute on function public.admin_retry_push_delivery(bigint) to authenticated;
grant execute on function public.admin_cancel_push_delivery(bigint) to authenticated;
grant execute on function public.admin_request_push_delivery_processing(bigint) to authenticated;
grant execute on function public.get_admin_usage_analytics(integer) to authenticated;

notify pgrst, 'reload schema';

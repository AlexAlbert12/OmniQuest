-- OmniQuest - Notification delivery diagnostics
-- Read-only checks for a specific user. Replace TARGET_USER_ID before running.

-- 1) Notification preferences: both must allow an achievement push.
select user_id, push_enabled, activity_enabled, updated_at
from public.user_notification_preferences
where user_id = 'TARGET_USER_ID'::uuid;

-- 2) Active Expo push tokens owned by the user/device.
select id, user_id, platform, device_name, app_version, active, last_seen_at, updated_at
from public.push_tokens
where user_id = 'TARGET_USER_ID'::uuid
order by active desc, last_seen_at desc nulls last;

-- 3) Latest achievement notifications generated in the persistent feed.
select id, user_id, type, title, description, metadata, created_at, read_at
from public.notifications
where user_id = 'TARGET_USER_ID'::uuid
  and type = 'achievement'
order by created_at desc
limit 20;

-- 4) Delivery queue state for the user's latest notifications.
select q.id, q.notification_id, n.type, n.title, q.status, q.priority, q.attempts, q.skip_reason, q.last_error_code, q.last_error_message, q.available_at, q.created_at, q.updated_at
from public.notification_delivery_queue q
join public.notifications n on n.id = q.notification_id
where q.user_id = 'TARGET_USER_ID'::uuid
order by q.created_at desc
limit 30;

-- 5) Expo ticket / receipt state.
select d.id, d.notification_id, d.status, d.expo_ticket_id, d.error_code, d.error_message, d.sent_at, d.receipt_checked_at, d.delivered_at, d.created_at, d.updated_at
from public.notification_push_deliveries d
where d.user_id = 'TARGET_USER_ID'::uuid
order by d.created_at desc
limit 30;

-- 6) Push worker cron and its latest execution.
select distinct on (j.jobname)
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  r.status as last_status,
  r.start_time,
  r.end_time,
  r.return_message
from cron.job j
left join cron.job_run_details r on r.jobid = j.jobid
where j.jobname = 'omniquest-notification-delivery'
order by j.jobname, r.start_time desc nulls last;

-- 7) Recent pg_net responses from cron -> Edge Function calls.
select id, status_code, error_msg, created
from net._http_response
order by created desc
limit 30;

select jobid, jobname, schedule, active
from cron.job
where jobname like 'omniquest-%' or jobname = 'maintain-admin-audit-partitions'
order by jobname;

select distinct on (j.jobid)
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
where j.jobname like 'omniquest-%' or j.jobname = 'maintain-admin-audit-partitions'
order by j.jobid, r.start_time desc nulls last;

select j.jobname, r.status, r.start_time, r.end_time, r.return_message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where (j.jobname like 'omniquest-%' or j.jobname = 'maintain-admin-audit-partitions')
  and r.start_time >= now() - interval '24 hours'
  and coalesce(r.status, '') <> 'succeeded'
order by r.start_time desc;

select id, status_code, error_msg, created
from net._http_response
where created >= now() - interval '24 hours'
  and (status_code is null or status_code < 200 or status_code >= 300 or error_msg is not null)
order by created desc
limit 100;

select id, notification_id, user_id, status, attempts, max_attempts, next_attempt_at, locked_at, last_error_code, last_error_message, updated_at
from public.notification_delivery_queue
where status = 'failed'
   or (status = 'pending' and next_attempt_at <= now() - interval '15 minutes')
   or (status = 'processing' and coalesce(locked_at, updated_at) <= now() - interval '15 minutes')
order by updated_at asc
limit 100;

select id, queue_id, user_id, expo_ticket_id, sent_at, receipt_checked_at, error_code, error_message
from public.notification_push_deliveries
where status = 'ticketed'
  and sent_at <= now() - interval '20 minutes'
  and receipt_checked_at is null
order by sent_at asc
limit 100;

select id, ticket_id, recipient_id, status, attempts, max_attempts, next_attempt_at, locked_at, error_code, error_message, updated_at
from public.support_email_deliveries
where status = 'failed'
   or (status = 'retry' and next_attempt_at <= now() - interval '15 minutes')
   or (status = 'processing' and coalesce(locked_at, updated_at) <= now() - interval '15 minutes')
order by updated_at asc
limit 100;

select id, teacher_id, frequency, status, attempts, max_attempts, next_attempt_at, locked_at, last_error_code, last_error_message, updated_at
from public.teacher_digest_deliveries
where status = 'failed'
   or (status = 'retry' and next_attempt_at <= now() - interval '15 minutes')
   or (status = 'processing' and coalesce(locked_at, updated_at) <= now() - interval '15 minutes')
order by updated_at asc
limit 100;

select id, user_id, status, requested_at, started_at, completed_at, error_message, updated_at
from public.data_export_requests
where status = 'failed'
   or (status = 'queued' and requested_at <= now() - interval '30 minutes')
   or (status = 'processing' and coalesce(started_at, updated_at) <= now() - interval '30 minutes')
order by updated_at asc
limit 100;

select id, requested_by, export_type, status, processed_rows, row_count, started_at, completed_at, error_message, updated_at
from public.admin_export_jobs
where status = 'failed'
   or (status = 'queued' and created_at <= now() - interval '30 minutes')
   or (status = 'processing' and coalesce(started_at, updated_at) <= now() - interval '30 minutes')
order by updated_at asc
limit 100;

select id, teacher_id, status, row_count, requested_at, started_at, completed_at, error_message, updated_at
from public.teacher_audit_export_requests
where status = 'failed'
   or (status = 'queued' and requested_at <= now() - interval '30 minutes')
   or (status = 'processing' and coalesce(started_at, updated_at) <= now() - interval '30 minutes')
order by updated_at asc
limit 100;

select id, user_id, status, requested_at, scheduled_for, processed_at, error_message, updated_at
from public.account_deletion_requests
where status = 'failed'
   or (status = 'processing' and updated_at <= now() - interval '30 minutes')
order by updated_at asc
limit 100;

select id, teacher_id, pattern_key, severity, title, event_count, window_started_at, window_ended_at, created_at
from public.teacher_audit_alerts
where acknowledged_at is null
order by case severity when 'critical' then 0 else 1 end, created_at desc
limit 100;

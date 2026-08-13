alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.classrooms enable row level security;
alter table public.subject_topics enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.enrollments enable row level security;
alter table public.subject_scores enable row level security;
alter table public.topic_scores enable row level security;
alter table public.attempt_history enable row level security;
alter table public.student_badges enable row level security;
alter table public.notification_state enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.user_support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.data_export_requests enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.notifications enable row level security;

revoke all on table
  public.roles,
  public.profiles,
  public.subjects,
  public.classrooms,
  public.subject_topics,
  public.questions,
  public.answers,
  public.enrollments,
  public.subject_scores,
  public.topic_scores,
  public.attempt_history,
  public.student_badges,
  public.notification_state,
  public.user_preferences,
  public.user_notification_preferences,
  public.user_support_tickets,
  public.support_ticket_messages,
  public.support_ticket_attachments,
  public.account_deletion_requests,
  public.data_export_requests,
  public.admin_audit_logs,
  public.notifications
from public, anon, authenticated;

grant select on table public.roles to authenticated;
grant select on table public.profiles to authenticated;
grant update (alias, visibility) on table public.profiles to authenticated;
grant select on table public.subjects, public.classrooms, public.subject_topics, public.questions, public.answers to authenticated;
grant select, delete on table public.enrollments to authenticated;
grant select on table public.subject_scores, public.topic_scores, public.attempt_history, public.student_badges to authenticated;
grant select, insert, update on table public.notification_state, public.user_preferences, public.user_notification_preferences to authenticated;
grant select, insert on table public.user_support_tickets, public.support_ticket_attachments to authenticated;
grant select on table public.support_ticket_messages, public.account_deletion_requests, public.data_export_requests, public.admin_audit_logs to authenticated;

revoke all on sequence public.classrooms_id_seq, public.subject_topics_id_seq, public.enrollments_id_seq, public.subject_scores_id_seq, public.topic_scores_id_seq, public.notification_state_id_seq, public.user_support_tickets_id_seq from public, anon, authenticated;
grant usage, select on sequence public.notification_state_id_seq, public.user_support_tickets_id_seq to authenticated;

revoke all on table
  public.account_backup_codes,
  public.admin_audit_logs_default,
  public.admin_role_assignments,
  public.admin_roles,
  public.analytics_reporting_identities,
  public.analytics_retention_policy,
  public.attempt_sensitive_data_retention_policy,
  public.auth_rate_limits,
  public.game_answer_submission_receipts,
  public.notification_delivery_queue,
  public.notification_push_deliveries,
  public.question_media_assets,
  public.teacher_audit_retention_policy,
  public.teacher_digest_deliveries,
  public.teacher_student_recovery_requests
from public, anon, authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

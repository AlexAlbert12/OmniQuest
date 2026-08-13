alter table public.user_notification_preferences
  add column if not exists teacher_reminder_email text,
  add column if not exists teacher_inactive_student_alerts boolean not null default true,
  add column if not exists teacher_open_review_alerts boolean not null default true,
  add column if not exists teacher_sensitive_action_alerts boolean not null default true,
  add column if not exists teacher_digest_frequency text not null default 'daily';

alter table public.user_notification_preferences
  drop constraint if exists user_notification_preferences_teacher_digest_frequency_check;

alter table public.user_notification_preferences
  add constraint user_notification_preferences_teacher_digest_frequency_check
  check (teacher_digest_frequency in ('off', 'daily', 'weekly'));

comment on column public.user_notification_preferences.teacher_reminder_email is
  'Optional address used for teacher reminders and operational summaries.';
comment on column public.user_notification_preferences.teacher_inactive_student_alerts is
  'Whether the teacher wants alerts about students without recent activity.';
comment on column public.user_notification_preferences.teacher_open_review_alerts is
  'Whether the teacher wants alerts about pending manual reviews.';
comment on column public.user_notification_preferences.teacher_sensitive_action_alerts is
  'Whether the teacher wants alerts about sensitive or audited actions.';
comment on column public.user_notification_preferences.teacher_digest_frequency is
  'Frequency for the teacher operational summary: off, daily or weekly.';

notify pgrst, 'reload schema';

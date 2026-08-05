-- Support-ticket activity is fanned out to administrators by
-- on_support_ticket_message(). Keep that server-side audience compatible with
-- the notifications table constraint.

alter table public.notifications
  drop constraint if exists notifications_audience_check;

alter table public.notifications
  add constraint notifications_audience_check
  check (audience in ('teacher', 'student', 'admin'));

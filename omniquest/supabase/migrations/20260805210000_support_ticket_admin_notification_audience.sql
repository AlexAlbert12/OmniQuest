alter table public.notifications
  drop constraint if exists notifications_audience_check;

alter table public.notifications
  add constraint notifications_audience_check
  check (audience in ('teacher', 'student', 'admin'));

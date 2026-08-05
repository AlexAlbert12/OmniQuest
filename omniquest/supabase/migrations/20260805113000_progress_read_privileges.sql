revoke select on table public.attempt_history, public.student_badges from public, anon;
grant select on table public.attempt_history, public.student_badges to authenticated;

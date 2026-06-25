insert into public.roles (id, name)
values ('admin', 'Administrador')
on conflict (id) do update set name = excluded.name;

alter table public.profiles add column if not exists email text;

update public.profiles
set email = users.email
from auth.users
where profiles.id = users.id
  and profiles.email is null;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role_id = 'admin'
      and coalesce(active, true)
  )
$$;

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
alter table public.user_support_tickets enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.notification_state enable row level security;

drop policy if exists "admin_select_subjects" on public.subjects;
create policy "admin_select_subjects"
on public.subjects for select to authenticated
using (public.is_admin());

drop policy if exists "admin_manage_subjects" on public.subjects;
create policy "admin_manage_subjects"
on public.subjects for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_select_classrooms" on public.classrooms;
create policy "admin_select_classrooms"
on public.classrooms for select to authenticated
using (public.is_admin());

drop policy if exists "admin_manage_classrooms" on public.classrooms;
create policy "admin_manage_classrooms"
on public.classrooms for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_select_subject_topics" on public.subject_topics;
create policy "admin_select_subject_topics"
on public.subject_topics for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_questions" on public.questions;
create policy "admin_select_questions"
on public.questions for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_answers" on public.answers;
create policy "admin_select_answers"
on public.answers for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_enrollments" on public.enrollments;
create policy "admin_select_enrollments"
on public.enrollments for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_subject_scores" on public.subject_scores;
create policy "admin_select_subject_scores"
on public.subject_scores for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_topic_scores" on public.topic_scores;
create policy "admin_select_topic_scores"
on public.topic_scores for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_attempt_history" on public.attempt_history;
create policy "admin_select_attempt_history"
on public.attempt_history for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_student_badges" on public.student_badges;
create policy "admin_select_student_badges"
on public.student_badges for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_user_support_tickets" on public.user_support_tickets;
create policy "admin_select_user_support_tickets"
on public.user_support_tickets for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_user_preferences" on public.user_preferences;
create policy "admin_select_user_preferences"
on public.user_preferences for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_user_notification_preferences" on public.user_notification_preferences;
create policy "admin_select_user_notification_preferences"
on public.user_notification_preferences for select to authenticated
using (public.is_admin());

drop policy if exists "admin_select_notification_state" on public.notification_state;
create policy "admin_select_notification_state"
on public.notification_state for select to authenticated
using (public.is_admin());

grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin_select_profiles" on public.profiles;
create policy "admin_select_profiles"
on public.profiles for select to authenticated
using (public.is_admin());

drop policy if exists "admin_update_profiles" on public.profiles;
create policy "admin_update_profiles"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

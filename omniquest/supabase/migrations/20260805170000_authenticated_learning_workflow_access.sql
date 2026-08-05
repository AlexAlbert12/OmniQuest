revoke all on table public.enrollments, public.subject_scores, public.topic_scores, public.user_preferences, public.user_support_tickets from public, anon, authenticated;

grant select, delete on table public.enrollments to authenticated;
grant select on table public.subject_scores, public.topic_scores to authenticated;
grant select, insert, update on table public.user_preferences to authenticated;
grant select, insert on table public.user_support_tickets to authenticated;

revoke all on sequence public.enrollments_id_seq, public.subject_scores_id_seq, public.topic_scores_id_seq, public.user_support_tickets_id_seq from public, anon, authenticated;
grant usage, select on sequence public.user_support_tickets_id_seq to authenticated;

drop policy if exists "enrollments_delete_self_or_teacher" on public.enrollments;
drop policy if exists "enrollments_delete_self" on public.enrollments;
create policy "enrollments_delete_self"
on public.enrollments
for delete
to authenticated
using (student_id = auth.uid());

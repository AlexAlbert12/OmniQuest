revoke all on table public.classrooms from public, anon, authenticated;
grant select, insert, update, delete on table public.classrooms to authenticated;

revoke all on sequence public.classrooms_id_seq from public, anon, authenticated;
grant usage, select on sequence public.classrooms_id_seq to authenticated;

alter function public.create_teacher_classroom(bigint, text, text) owner to postgres;
alter function public.create_teacher_classroom(bigint, text, text) security definer;
alter function public.create_teacher_classroom(bigint, text, text) set search_path to public, pg_catalog;
revoke all on function public.create_teacher_classroom(bigint, text, text) from public, anon, authenticated;
grant execute on function public.create_teacher_classroom(bigint, text, text) to authenticated, service_role;

alter function public.generate_unique_subject_code() owner to postgres;
alter function public.generate_unique_subject_code() security definer;
alter function public.generate_unique_subject_code() set search_path to public, pg_catalog;
revoke all on function public.generate_unique_subject_code() from public, anon, authenticated;
grant execute on function public.generate_unique_subject_code() to authenticated, service_role;

alter function public.enforce_global_invite_code_uniqueness() owner to postgres;
alter function public.enforce_global_invite_code_uniqueness() security definer;
alter function public.enforce_global_invite_code_uniqueness() set search_path to public, pg_catalog;
revoke all on function public.enforce_global_invite_code_uniqueness() from public, anon, authenticated;

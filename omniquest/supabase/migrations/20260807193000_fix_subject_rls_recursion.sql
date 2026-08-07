create or replace function public.is_subject_enrolled(p_subject_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.enrollments
    where subject_id = p_subject_id
      and student_id = auth.uid()
  );
$$;

alter function public.is_subject_enrolled(bigint) owner to postgres;
revoke all on function public.is_subject_enrolled(bigint) from public, anon;
grant execute on function public.is_subject_enrolled(bigint) to authenticated, service_role;

drop policy if exists "subjects_select_authenticated" on public.subjects;
drop policy if exists "subjects_select_teacher_or_enrolled" on public.subjects;
drop policy if exists "subjects_select_authenticated_no_recursion" on public.subjects;
drop policy if exists "subjects_select_authorized" on public.subjects;

create policy "subjects_select_authorized"
on public.subjects
for select
to authenticated
using (
  public.is_admin()
  or (teacher_id = auth.uid() and public.is_active_teacher())
  or (
    coalesce(active, true)
    and not coalesce(is_archived, false)
    and public.is_subject_enrolled(subjects.id)
  )
);

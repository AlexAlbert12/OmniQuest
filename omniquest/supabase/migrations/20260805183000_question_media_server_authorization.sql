grant select, insert, update, delete on table public.question_media_assets to service_role;

alter function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text, numeric, text, text
) owner to postgres;
alter function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text, numeric, text, text
) security definer;
revoke all on function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text, numeric, text, text
) from public, anon, authenticated;
grant execute on function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text, numeric, text, text
) to authenticated, service_role;

alter function public.can_access_question_media(bigint, bigint) owner to postgres;
alter function public.can_access_question_media(bigint, bigint) security definer;
revoke all on function public.can_access_question_media(bigint, bigint) from public, anon, authenticated;
grant execute on function public.can_access_question_media(bigint, bigint) to authenticated, service_role;

alter function public.get_question_media_manifest(bigint[]) owner to postgres;
alter function public.get_question_media_manifest(bigint[]) security definer;
revoke all on function public.get_question_media_manifest(bigint[]) from public, anon, authenticated;
grant execute on function public.get_question_media_manifest(bigint[]) to authenticated, service_role;

alter function public.mark_question_media_orphaned() owner to postgres;
alter function public.mark_question_media_orphaned() security definer;
revoke all on function public.mark_question_media_orphaned() from public, anon, authenticated;

create or replace function public.can_access_question_media_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    split_part(coalesce(p_name, ''), '/', 1) = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1
      from public.questions q
      where q.media_path = p_name
        and public.can_access_question_media(q.subject_id, q.classroom_id)
    )
    or exists (
      select 1
      from public.question_media_assets a
      join public.questions q on q.id = a.attached_question_id
      where (a.thumbnail_path = p_name or a.processed_path = p_name)
        and public.can_access_question_media(q.subject_id, q.classroom_id)
    )
  );
$$;

alter function public.can_access_question_media_object(text) owner to postgres;
revoke all on function public.can_access_question_media_object(text) from public, anon, authenticated;
grant execute on function public.can_access_question_media_object(text) to authenticated, service_role;

drop policy if exists "question_media_select_authorized" on storage.objects;
create policy "question_media_select_authorized"
on storage.objects for select to authenticated
using (
  bucket_id = 'question-media'
  and public.can_access_question_media_object(name)
);

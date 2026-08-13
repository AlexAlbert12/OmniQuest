-- Add student profile photos to the paginated teacher directories without
-- weakening the authorization and filtering owned by the existing RPCs.

create or replace function public.teacher_attach_student_avatars(p_items jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      entry.item || jsonb_build_object('avatar', profile.avatar)
      order by entry.position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end
  ) with ordinality as entry(item, position)
  left join public.profiles profile on profile.id = nullif(entry.item ->> 'id', '')::uuid;
$$;

revoke all on function public.teacher_attach_student_avatars(jsonb) from public, anon, authenticated;

create or replace function public.get_teacher_students_page_with_avatars(
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_status text default null,
  p_search text default null,
  p_order text default 'attention',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  v_payload := public.get_teacher_students_page(
    p_subject_id,
    p_classroom_id,
    p_status,
    p_search,
    p_order,
    p_limit,
    p_offset
  );

  v_payload := jsonb_set(v_payload, '{items}', public.teacher_attach_student_avatars(v_payload -> 'items'), true);
  v_payload := jsonb_set(v_payload, '{attention}', public.teacher_attach_student_avatars(v_payload -> 'attention'), true);
  v_payload := jsonb_set(v_payload, '{pending}', public.teacher_attach_student_avatars(v_payload -> 'pending'), true);
  return v_payload;
end;
$$;

create or replace function public.get_teacher_subject_students_page_with_avatars(
  p_subject_id bigint,
  p_classroom_id bigint,
  p_search text default null,
  p_status text default null,
  p_sort text default 'xp',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_best_student jsonb;
begin
  v_payload := public.get_teacher_subject_students_page(
    p_subject_id,
    p_classroom_id,
    p_search,
    p_status,
    p_sort,
    p_limit,
    p_offset
  );

  v_payload := jsonb_set(v_payload, '{items}', public.teacher_attach_student_avatars(v_payload -> 'items'), true);
  v_payload := jsonb_set(v_payload, '{summary,attention}', public.teacher_attach_student_avatars(v_payload #> '{summary,attention}'), true);

  v_best_student := v_payload #> '{summary,bestStudent}';
  if jsonb_typeof(v_best_student) = 'object' then
    v_best_student := public.teacher_attach_student_avatars(jsonb_build_array(v_best_student)) -> 0;
    v_payload := jsonb_set(v_payload, '{summary,bestStudent}', v_best_student, true);
  end if;

  return v_payload;
end;
$$;

revoke all on function public.get_teacher_students_page_with_avatars(bigint, bigint, text, text, text, integer, integer) from public, anon;
revoke all on function public.get_teacher_subject_students_page_with_avatars(bigint, bigint, text, text, text, integer, integer) from public, anon;
grant execute on function public.get_teacher_students_page_with_avatars(bigint, bigint, text, text, text, integer, integer) to authenticated;
grant execute on function public.get_teacher_subject_students_page_with_avatars(bigint, bigint, text, text, text, integer, integer) to authenticated;

comment on function public.get_teacher_students_page_with_avatars(bigint, bigint, text, text, text, integer, integer) is
  'Returns the authorized paginated teacher student directory enriched with profile photos.';
comment on function public.get_teacher_subject_students_page_with_avatars(bigint, bigint, text, text, text, integer, integer) is
  'Returns the authorized paginated classroom student directory enriched with profile photos.';

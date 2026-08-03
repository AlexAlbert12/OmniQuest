create or replace function public.archive_teacher_question(p_question_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_question public.questions%rowtype;
begin
  if v_teacher_id is null then
    raise exception 'Teacher session required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_teacher_id
      and role_id = 'teacher'
      and coalesce(active, true)
  ) then
    raise exception 'Teacher access required';
  end if;

  select question.*
  into v_question
  from public.questions question
  join public.subjects subject on subject.id = question.subject_id
  where question.id = p_question_id
    and subject.teacher_id = v_teacher_id
  for update of question;

  if not found then
    raise exception 'Question not found or access denied';
  end if;

  if coalesce(v_question.active, true) then
    update public.questions
    set active = false
    where id = v_question.id;

    insert into public.teacher_audit_logs (
      teacher_id,
      action,
      target_table,
      target_id,
      metadata,
      before_state,
      after_state
    )
    values (
      v_teacher_id,
      'teacher.question.archive',
      'questions',
      v_question.id::text,
      jsonb_build_object(
        'subject_id', v_question.subject_id,
        'classroom_id', v_question.classroom_id,
        'topic_id', v_question.topic_id,
        'type', v_question.type
      ),
      jsonb_build_object('active', coalesce(v_question.active, true)),
      jsonb_build_object('active', false)
    );
  end if;

  return jsonb_build_object(
    'id', v_question.id,
    'active', false
  );
end;
$$;

revoke all on function public.archive_teacher_question(bigint) from public, anon;
grant execute on function public.archive_teacher_question(bigint) to authenticated;

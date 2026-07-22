-- Restrict the low-level notification writer and expose a narrow teacher RPC.
-- create_notification remains available to database-owned trigger functions and
-- service-role Edge Functions, but it is no longer callable by normal clients.

revoke all on function public.create_notification(
  uuid, text, text, text, text, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.create_notification(
  uuid, text, text, text, text, text, text, text, text, text, jsonb, text
) to service_role;

create or replace function public.create_teacher_notification(
  p_student_id uuid,
  p_type text,
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_subject_name text;
  v_classroom_name text;
  v_type text := lower(trim(coalesce(p_type, '')));
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_notification_type text;
  v_title text;
  v_description text;
  v_icon text;
  v_color text;
  v_action_url text;
  v_notification_id uuid;
begin
  if v_teacher_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_teacher_id
      and p.role_id = 'teacher'
      and coalesce(p.active, true)
  ) then
    raise exception 'Teacher access required';
  end if;

  select s.name
  into v_subject_name
  from public.subjects s
  where s.id = p_subject_id
    and s.teacher_id = v_teacher_id
    and coalesce(s.is_archived, false) = false;

  if not found then
    raise exception 'Course not found or not owned by current teacher';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_student_id
      and p.role_id in ('student', 'guest')
      and coalesce(p.active, true)
  ) then
    raise exception 'Student not found or inactive';
  end if;

  if p_classroom_id is null then
    if not exists (
      select 1
      from public.enrollments e
      where e.student_id = p_student_id
        and e.subject_id = p_subject_id
    ) then
      raise exception 'Student is not enrolled in this course';
    end if;
  else
    select c.name
    into v_classroom_name
    from public.classrooms c
    where c.id = p_classroom_id
      and c.subject_id = p_subject_id
      and coalesce(c.active, true);

    if not found then
      raise exception 'Classroom not found for this course';
    end if;

    if not exists (
      select 1
      from public.enrollments e
      where e.student_id = p_student_id
        and e.subject_id = p_subject_id
        and e.classroom_id = p_classroom_id
    ) then
      raise exception 'Student is not enrolled in this classroom';
    end if;
  end if;

  if v_message is not null and length(v_message) > 500 then
    raise exception 'Notification message is too long';
  end if;

  case v_type
    when 'student_activity' then
      v_notification_type := 'student_activity';
      v_title := 'Continúa tu progreso';
      v_description := coalesce(
        v_message,
        format(
          'Tu profesor te recuerda continuar en %s%s.',
          v_subject_name,
          case when v_classroom_name is null then '' else ' · ' || v_classroom_name end
        )
      );
      v_icon := 'school-outline';
      v_color := '#38BDF8';
    when 'announcement' then
      if v_message is null then
        raise exception 'A message is required for an announcement';
      end if;
      v_notification_type := 'announcement';
      v_title := format('Aviso de %s', v_subject_name);
      v_description := v_message;
      v_icon := 'megaphone-outline';
      v_color := '#8B5CF6';
    when 'new_class' then
      v_notification_type := 'new_class';
      v_title := 'Novedades en tu curso';
      v_description := coalesce(
        v_message,
        format('Hay nuevo contenido disponible en %s.', v_subject_name)
      );
      v_icon := 'book-outline';
      v_color := '#58B5FF';
    else
      raise exception 'Unsupported teacher notification type';
  end case;

  v_action_url := format(
    '/(student)/class/%s%s',
    p_subject_id,
    case
      when p_classroom_id is null then ''
      else '?classroomId=' || p_classroom_id::text
    end
  );

  v_notification_id := public.create_notification(
    p_user_id => p_student_id,
    p_audience => 'student',
    p_type => v_notification_type,
    p_title => v_title,
    p_description => v_description,
    p_icon => v_icon,
    p_color => v_color,
    p_action_url => v_action_url,
    p_related_table => case when p_classroom_id is null then 'subjects' else 'classrooms' end,
    p_related_id => coalesce(p_classroom_id::text, p_subject_id::text),
    p_metadata => jsonb_build_object(
      'teacher_id', v_teacher_id,
      'student_id', p_student_id,
      'subject_id', p_subject_id,
      'classroom_id', p_classroom_id,
      'preference_category', 'activity'
    ),
    p_fingerprint => concat_ws(
      ':',
      'teacher-notification',
      v_teacher_id,
      p_student_id,
      p_subject_id,
      coalesce(p_classroom_id::text, 'course'),
      v_type
    )
  );

  return jsonb_build_object(
    'notification_id', v_notification_id,
    'student_id', p_student_id,
    'subject_id', p_subject_id,
    'classroom_id', p_classroom_id,
    'type', v_notification_type
  );
end;
$$;

revoke all on function public.create_teacher_notification(uuid, text, bigint, bigint, text)
  from public, anon;
grant execute on function public.create_teacher_notification(uuid, text, bigint, bigint, text)
  to authenticated;

comment on function public.create_notification(
  uuid, text, text, text, text, text, text, text, text, text, jsonb, text
) is 'Internal notification writer. Only database-owned functions and service-role processes may call it.';

comment on function public.create_teacher_notification(uuid, text, bigint, bigint, text)
  is 'Creates a whitelisted notification for a student enrolled in a course owned by the current teacher.';

notify pgrst, 'reload schema';

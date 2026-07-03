create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  audience text not null check (audience in ('teacher', 'student')),
  type text not null check (type in ('enrollment', 'student_activity', 'achievement', 'new_class', 'announcement')),
  title text not null,
  description text not null,
  icon text not null default 'notifications-outline',
  color text not null default '#8B5CF6',
  action_url text,
  related_table text,
  related_id text,
  fingerprint text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index if not exists notifications_user_created_at_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where read_at is null and deleted_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
on public.notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self"
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.touch_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_notifications_updated_at on public.notifications;
create trigger touch_notifications_updated_at
before update on public.notifications
for each row execute function public.touch_notifications_updated_at();

create or replace function public.create_notification(
  p_user_id uuid,
  p_audience text,
  p_type text,
  p_title text,
  p_description text,
  p_icon text default 'notifications-outline',
  p_color text default '#8B5CF6',
  p_action_url text default null,
  p_related_table text default null,
  p_related_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_fingerprint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_fingerprint text;
begin
  if p_user_id is null then
    return null;
  end if;

  v_fingerprint := coalesce(
    p_fingerprint,
    concat_ws(':', p_audience, p_type, coalesce(p_related_table, 'general'), coalesce(p_related_id, md5(p_title || p_description)))
  );

  insert into public.notifications (
    user_id,
    audience,
    type,
    title,
    description,
    icon,
    color,
    action_url,
    related_table,
    related_id,
    fingerprint,
    metadata
  ) values (
    p_user_id,
    p_audience,
    p_type,
    p_title,
    p_description,
    coalesce(p_icon, 'notifications-outline'),
    coalesce(p_color, '#8B5CF6'),
    p_action_url,
    p_related_table,
    p_related_id,
    v_fingerprint,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, fingerprint) do update
  set
    title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    action_url = excluded.action_url,
    related_table = excluded.related_table,
    related_id = excluded.related_id,
    metadata = excluded.metadata,
    deleted_at = null,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_notification(uuid, text, text, text, text, text, text, text, text, text, jsonb, text) to authenticated;

create or replace function public.notify_enrollment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_name text;
  v_teacher_id uuid;
  v_classroom_name text;
  v_student_alias text;
begin
  select name, teacher_id
  into v_subject_name, v_teacher_id
  from public.subjects
  where id = new.subject_id;

  if v_teacher_id is null then
    return new;
  end if;

  select name
  into v_classroom_name
  from public.classrooms
  where id = new.classroom_id;

  select coalesce(alias, 'Un alumno')
  into v_student_alias
  from public.profiles
  where id = new.student_id;

  perform public.create_notification(
    new.student_id,
    'student',
    'new_class',
    'Te has unido a un curso',
    concat('Ya puedes practicar en ', coalesce(v_subject_name, 'tu nuevo curso'), case when v_classroom_name is not null then ' · ' || v_classroom_name else '' end, '.'),
    'book-outline',
    '#58B5FF',
    concat('/(student)/class/', new.subject_id, case when new.classroom_id is not null then concat('?classroomId=', new.classroom_id) else '' end),
    'enrollments',
    new.id::text,
    jsonb_build_object('subject_id', new.subject_id, 'subject_name', v_subject_name, 'classroom_id', new.classroom_id, 'classroom_name', v_classroom_name),
    concat('student-enrollment:', new.id)
  );

  perform public.create_notification(
    v_teacher_id,
    'teacher',
    'enrollment',
    'Nuevo alumno inscrito',
    concat(coalesce(v_student_alias, 'Un alumno'), ' se unió a ', coalesce(v_subject_name, 'un curso'), case when v_classroom_name is not null then ' · ' || v_classroom_name else '' end, '.'),
    'person-add-outline',
    '#8B5CF6',
    concat('/(teacher)/subject/', new.subject_id, '?tab=students'),
    'enrollments',
    new.id::text,
    jsonb_build_object('student_id', new.student_id, 'student_name', v_student_alias, 'subject_id', new.subject_id, 'subject_name', v_subject_name, 'classroom_id', new.classroom_id, 'classroom_name', v_classroom_name),
    concat('teacher-enrollment:', new.id)
  );

  return new;
end;
$$;

drop trigger if exists notify_enrollment_event on public.enrollments;
create trigger notify_enrollment_event
after insert on public.enrollments
for each row execute function public.notify_enrollment_event();

create or replace function public.notify_attempt_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_text text;
  v_subject_id bigint;
  v_subject_name text;
  v_teacher_id uuid;
  v_student_alias text;
  v_title text;
  v_description text;
begin
  select text, subject_id
  into v_question_text, v_subject_id
  from public.questions
  where id = new.question_id;

  if v_subject_id is null then
    return new;
  end if;

  select name, teacher_id
  into v_subject_name, v_teacher_id
  from public.subjects
  where id = v_subject_id;

  if v_teacher_id is null then
    return new;
  end if;

  select coalesce(alias, 'Un alumno')
  into v_student_alias
  from public.profiles
  where id = new.student_id;

  v_title := case when new.is_correct then 'Respuesta correcta registrada' else 'Pregunta fallada' end;
  v_description := concat(
    coalesce(v_student_alias, 'Un alumno'),
    case when new.is_correct then ' acertó ' else ' falló ' end,
    '"', left(coalesce(v_question_text, 'una pregunta'), 70), '" en ', coalesce(v_subject_name, 'un curso'), '.'
  );

  perform public.create_notification(
    v_teacher_id,
    'teacher',
    'student_activity',
    v_title,
    v_description,
    case when new.is_correct then 'checkmark-circle-outline' else 'warning-outline' end,
    case when new.is_correct then '#43D991' else '#FB7185' end,
    concat('/(teacher)/question-report/', new.question_id),
    'attempt_history',
    new.id::text,
    jsonb_build_object('student_id', new.student_id, 'student_name', v_student_alias, 'subject_id', v_subject_id, 'subject_name', v_subject_name, 'question_id', new.question_id, 'is_correct', new.is_correct),
    concat('teacher-attempt:', new.id)
  );

  return new;
end;
$$;

drop trigger if exists notify_attempt_event on public.attempt_history;
create trigger notify_attempt_event
after insert on public.attempt_history
for each row execute function public.notify_attempt_event();

create or replace function public.notify_badge_award_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notification(
    new.student_id,
    'student',
    'achievement',
    'Logro desbloqueado',
    concat('Has conseguido una nueva insignia y ganado ', coalesce(new.reward_xp, 0), ' XP.'),
    'trophy-outline',
    '#F6A64A',
    '/(student)/badges',
    'student_badges',
    new.id::text,
    jsonb_build_object('badge_id', new.badge_id, 'reward_xp', new.reward_xp),
    concat('student-badge:', new.id)
  );

  return new;
end;
$$;

drop trigger if exists notify_badge_award_event on public.student_badges;
create trigger notify_badge_award_event
after insert on public.student_badges
for each row execute function public.notify_badge_award_event();

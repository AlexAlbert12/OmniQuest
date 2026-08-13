create extension if not exists pgcrypto;

alter table public.questions
  add column if not exists media_type text,
  add column if not exists media_url text,
  add column if not exists media_path text,
  add column if not exists media_alt_text text,
  add column if not exists media_caption text;

alter table public.questions
  drop constraint if exists questions_media_type_check;

alter table public.questions
  add constraint questions_media_type_check
  check (media_type is null or media_type in ('image', 'audio', 'video'));

alter table public.questions
  drop constraint if exists questions_media_consistency_check;

alter table public.questions
  add constraint questions_media_consistency_check
  check (
    (media_type is null and media_url is null and media_path is null)
    or (media_type is not null and nullif(trim(coalesce(media_url, '')), '') is not null)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-media',
  'question-media',
  true,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "question_media_insert_owner" on storage.objects;
create policy "question_media_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'question-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id in ('teacher', 'admin')
  )
);

drop policy if exists "question_media_update_owner" on storage.objects;
create policy "question_media_update_owner"
on storage.objects for update to authenticated
using (
  bucket_id = 'question-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'question-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "question_media_delete_owner" on storage.objects;
create policy "question_media_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'question-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop function if exists public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb
);

create or replace function public.save_teacher_question(
  p_subject_id bigint,
  p_question_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_type text default 'multiple_choice',
  p_text text default '',
  p_points_base integer default 10,
  p_time_limit_seconds integer default 30,
  p_difficulty integer default 1,
  p_explanation text default null,
  p_answers jsonb default '[]'::jsonb,
  p_media_type text default null,
  p_media_url text default null,
  p_media_path text default null,
  p_media_alt_text text default null,
  p_media_caption text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_question_id bigint;
  v_answer jsonb;
  v_classroom_id bigint;
  v_difficulty integer := coalesce(p_difficulty, 1);
  v_media_type text := nullif(trim(coalesce(p_media_type, '')), '');
  v_media_url text := nullif(trim(coalesce(p_media_url, '')), '');
  v_media_path text := nullif(trim(coalesce(p_media_path, '')), '');
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if not exists (
    select 1
    from public.subjects
    where id = p_subject_id
      and (teacher_id = v_teacher_id or public.is_admin())
  ) then
    raise exception 'No puedes modificar preguntas de este curso.';
  end if;

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1
    from public.classrooms
    where id = v_classroom_id
      and subject_id = p_subject_id
      and coalesce(active, true)
  ) then
    raise exception 'La clase seleccionada no pertenece a este curso.';
  end if;

  if p_topic_id is not null and not exists (
    select 1
    from public.subject_topics
    where id = p_topic_id
      and subject_id = p_subject_id
      and classroom_id = v_classroom_id
      and coalesce(active, true)
  ) then
    raise exception 'El tema seleccionado no pertenece a esta clase.';
  end if;

  if p_points_base < 1 or p_points_base > 100 then
    raise exception 'Los puntos deben estar entre 1 y 100.';
  end if;

  if p_time_limit_seconds < 5 or p_time_limit_seconds > 300 then
    raise exception 'El tiempo debe estar entre 5 y 300 segundos.';
  end if;

  if v_difficulty not in (1, 2, 3) then
    raise exception 'La dificultad debe ser fácil, medio o difícil.';
  end if;

  if nullif(trim(p_text), '') is null then
    raise exception 'El enunciado de la pregunta es obligatorio.';
  end if;

  if v_media_type is not null and v_media_type not in ('image', 'audio', 'video') then
    raise exception 'El tipo de contenido multimedia no es válido.';
  end if;

  if v_media_type is not null and v_media_url is null then
    raise exception 'El contenido multimedia necesita una URL válida.';
  end if;

  if v_media_path is not null
     and split_part(v_media_path, '/', 1) <> v_teacher_id::text
     and not public.is_admin() then
    raise exception 'El archivo multimedia no pertenece al profesor actual.';
  end if;

  if p_question_id is null then
    insert into public.questions (
      subject_id, classroom_id, topic_id, type, text, points_base,
      time_limit_seconds, difficulty, explanation,
      media_type, media_url, media_path, media_alt_text, media_caption
    )
    values (
      p_subject_id, v_classroom_id, p_topic_id, p_type, trim(p_text), p_points_base,
      p_time_limit_seconds, v_difficulty, nullif(trim(coalesce(p_explanation, '')), ''),
      v_media_type, v_media_url, v_media_path,
      nullif(trim(coalesce(p_media_alt_text, '')), ''),
      nullif(trim(coalesce(p_media_caption, '')), '')
    )
    returning id into v_question_id;
  else
    update public.questions
    set
      subject_id = p_subject_id,
      classroom_id = v_classroom_id,
      topic_id = p_topic_id,
      type = p_type,
      text = trim(p_text),
      points_base = p_points_base,
      time_limit_seconds = p_time_limit_seconds,
      difficulty = v_difficulty,
      explanation = nullif(trim(coalesce(p_explanation, '')), ''),
      media_type = v_media_type,
      media_url = v_media_url,
      media_path = v_media_path,
      media_alt_text = nullif(trim(coalesce(p_media_alt_text, '')), ''),
      media_caption = nullif(trim(coalesce(p_media_caption, '')), '')
    where id = p_question_id
      and subject_id = p_subject_id
      and (
        public.is_admin()
        or exists (
          select 1
          from public.subjects
          where subjects.id = questions.subject_id
            and subjects.teacher_id = v_teacher_id
        )
      )
    returning id into v_question_id;

    if v_question_id is null then
      raise exception 'No se encontró la pregunta a editar.';
    end if;

    delete from public.answers where question_id = v_question_id;
  end if;

  if jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) = 0 then
    raise exception 'La pregunta necesita al menos una respuesta.';
  end if;

  for v_answer in select value from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) loop
    if nullif(trim(coalesce(v_answer->>'text', '')), '') is null then
      raise exception 'Hay una respuesta vacía.';
    end if;

    insert into public.answers (question_id, text, is_correct, sort_order)
    values (
      v_question_id,
      trim(v_answer->>'text'),
      coalesce((v_answer->>'is_correct')::boolean, false),
      coalesce((v_answer->>'sort_order')::integer, 1)
    );
  end loop;

  return v_question_id;
end;
$$;

revoke all on function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text
) from public, anon;
grant execute on function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text
) to authenticated;

create or replace function public.get_safe_game_questions(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null,
  p_review_failed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_classroom_id bigint;
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_difficulty is not null and p_difficulty not in (1, 2, 3) then
    raise exception 'Invalid difficulty';
  end if;

  if p_topic_id is not null then
    perform public.assert_topic_playable(p_topic_id);
  end if;

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1
    from public.classrooms c
    join public.subjects s on s.id = c.subject_id
    where c.id = v_classroom_id
      and c.subject_id = p_subject_id
      and coalesce(c.active, true)
      and (
        s.teacher_id = v_user_id
        or public.is_admin()
        or exists (
          select 1
          from public.enrollments e
          where e.student_id = v_user_id
            and e.subject_id = p_subject_id
            and (e.classroom_id = c.id or e.classroom_id is null)
        )
      )
  ) then
    raise exception 'No puedes acceder a esta clase.';
  end if;

  select coalesce(jsonb_agg(question_payload order by random()), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'difficulty', coalesce(q.difficulty, 1),
      'points_base', q.points_base,
      'time_limit_seconds', q.time_limit_seconds,
      'topic_id', q.topic_id,
      'classroom_id', q.classroom_id,
      'media_type', q.media_type,
      'media_url', q.media_url,
      'media_alt_text', q.media_alt_text,
      'media_caption', q.media_caption,
      'blank_count',
        case
          when q.type = 'fill_blank' then (
            select count(*)
            from public.answers a
            where a.question_id = q.id
              and coalesce(a.is_correct, true)
              and public.normalize_answer_text(a.text) <> ''
          )
          else null
        end,
      'answers',
        case
          when q.type in ('open_answer', 'fill_blank') then '[]'::jsonb
          when q.type in ('match_pairs', 'drag_drop') then (
            select coalesce(
              jsonb_agg(jsonb_build_object('id', a.id, 'text', split_part(a.text, '|||', 1)) order by random()),
              '[]'::jsonb
            )
            from public.answers a
            where a.question_id = q.id
          )
          else (
            select coalesce(
              jsonb_agg(jsonb_build_object('id', a.id, 'text', a.text) order by random()),
              '[]'::jsonb
            )
            from public.answers a
            where a.question_id = q.id
          )
        end,
      'pair_options',
        case
          when q.type in ('match_pairs', 'drag_drop') then (
            select coalesce(jsonb_agg(pair_right order by random()), '[]'::jsonb)
            from (
              select split_part(a.text, '|||', 2) as pair_right
              from public.answers a
              where a.question_id = q.id
                and split_part(a.text, '|||', 2) <> ''
            ) pairs
          )
          else '[]'::jsonb
        end
    ) as question_payload
    from public.questions q
    left join public.subject_topics st on st.id = q.topic_id
    where q.subject_id = p_subject_id
      and q.classroom_id = v_classroom_id
      and coalesce(q.active, true)
      and (q.topic_id is null or st.available_until is null or st.available_until > now())
      and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
      and (
        (p_general_topic and q.topic_id is null)
        or (not p_general_topic and p_topic_id is null)
        or (not p_general_topic and p_topic_id is not null and q.topic_id = p_topic_id)
      )
      and (
        not p_review_failed
        or exists (
          select 1
          from (
            select distinct on (ah.question_id)
              ah.question_id,
              ah.is_correct
            from public.attempt_history ah
            where ah.student_id = v_user_id
            order by ah.question_id, ah.attempted_at desc, ah.id desc
          ) latest
          where latest.question_id = q.id
            and latest.is_correct = false
        )
      )
  ) safe_questions;

  return v_result;
end;
$$;

revoke all on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) from public, anon;
grant execute on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) to authenticated;

create table if not exists public.learning_tasks (
  id bigint generated by default as identity primary key,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  classroom_id bigint not null references public.classrooms(id) on delete cascade,
  topic_id bigint references public.subject_topics(id) on delete set null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz,
  due_at timestamptz not null,
  status text not null default 'draft',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_tasks_status_check check (status in ('draft', 'published', 'closed')),
  constraint learning_tasks_priority_check check (priority in ('low', 'normal', 'high')),
  constraint learning_tasks_dates_check check (starts_at is null or due_at > starts_at)
);

create table if not exists public.learning_task_completions (
  task_id bigint not null references public.learning_tasks(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (task_id, student_id)
);

create index if not exists learning_tasks_teacher_due_idx
  on public.learning_tasks(teacher_id, due_at, status);
create index if not exists learning_tasks_classroom_due_idx
  on public.learning_tasks(classroom_id, due_at, status);
create index if not exists learning_task_completions_student_idx
  on public.learning_task_completions(student_id, completed_at desc);

alter table public.learning_tasks enable row level security;
alter table public.learning_task_completions enable row level security;

drop policy if exists "learning_tasks_select_visible" on public.learning_tasks;
create policy "learning_tasks_select_visible"
on public.learning_tasks for select to authenticated
using (
  teacher_id = auth.uid()
  or public.is_admin()
  or (
    status = 'published'
    and exists (
      select 1
      from public.enrollments e
      where e.student_id = auth.uid()
        and e.subject_id = learning_tasks.subject_id
        and (e.classroom_id = learning_tasks.classroom_id or e.classroom_id is null)
    )
  )
);

drop policy if exists "learning_tasks_insert_teacher" on public.learning_tasks;
create policy "learning_tasks_insert_teacher"
on public.learning_tasks for insert to authenticated
with check (
  public.is_admin()
  or (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.subjects s
      where s.id = learning_tasks.subject_id
        and s.teacher_id = auth.uid()
    )
    and exists (
      select 1 from public.classrooms c
      where c.id = learning_tasks.classroom_id
        and c.subject_id = learning_tasks.subject_id
        and coalesce(c.active, true)
    )
    and (
      learning_tasks.topic_id is null
      or exists (
        select 1 from public.subject_topics st
        where st.id = learning_tasks.topic_id
          and st.subject_id = learning_tasks.subject_id
          and st.classroom_id = learning_tasks.classroom_id
          and coalesce(st.active, true)
      )
    )
  )
);

drop policy if exists "learning_tasks_update_teacher" on public.learning_tasks;
create policy "learning_tasks_update_teacher"
on public.learning_tasks for update to authenticated
using (teacher_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.subjects s
      where s.id = learning_tasks.subject_id
        and s.teacher_id = auth.uid()
    )
    and exists (
      select 1 from public.classrooms c
      where c.id = learning_tasks.classroom_id
        and c.subject_id = learning_tasks.subject_id
        and coalesce(c.active, true)
    )
    and (
      learning_tasks.topic_id is null
      or exists (
        select 1 from public.subject_topics st
        where st.id = learning_tasks.topic_id
          and st.subject_id = learning_tasks.subject_id
          and st.classroom_id = learning_tasks.classroom_id
          and coalesce(st.active, true)
      )
    )
  )
);

drop policy if exists "learning_tasks_delete_teacher" on public.learning_tasks;
create policy "learning_tasks_delete_teacher"
on public.learning_tasks for delete to authenticated
using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "learning_task_completions_select_visible" on public.learning_task_completions;
create policy "learning_task_completions_select_visible"
on public.learning_task_completions for select to authenticated
using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.learning_tasks t
    where t.id = learning_task_completions.task_id
      and t.teacher_id = auth.uid()
  )
);

drop policy if exists "learning_task_completions_insert_self" on public.learning_task_completions;
create policy "learning_task_completions_insert_self"
on public.learning_task_completions for insert to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.learning_tasks t
    join public.enrollments e
      on e.subject_id = t.subject_id
     and (e.classroom_id = t.classroom_id or e.classroom_id is null)
    where t.id = learning_task_completions.task_id
      and t.status = 'published'
      and e.student_id = auth.uid()
  )
);

drop policy if exists "learning_task_completions_delete_self" on public.learning_task_completions;
create policy "learning_task_completions_delete_self"
on public.learning_task_completions for delete to authenticated
using (student_id = auth.uid());

create or replace function public.touch_learning_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_learning_task_updated_at on public.learning_tasks;
create trigger touch_learning_task_updated_at
before update on public.learning_tasks
for each row execute function public.touch_learning_task_updated_at();

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'enrollment', 'student_activity', 'achievement', 'new_class', 'announcement',
    'task', 'manual_review'
  ));

create or replace function public.save_learning_task(
  p_task_id bigint default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_title text default '',
  p_description text default null,
  p_starts_at timestamptz default null,
  p_due_at timestamptz default null,
  p_status text default 'draft',
  p_priority text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.learning_tasks%rowtype;
  v_enrollment record;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if p_subject_id is null or p_classroom_id is null then
    raise exception 'Selecciona un curso y una clase.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'El título de la tarea es obligatorio.';
  end if;

  if p_due_at is null then
    raise exception 'La fecha límite es obligatoria.';
  end if;

  if p_starts_at is not null and p_due_at <= p_starts_at then
    raise exception 'La fecha límite debe ser posterior a la fecha de inicio.';
  end if;

  if p_status not in ('draft', 'published', 'closed') then
    raise exception 'El estado de la tarea no es válido.';
  end if;

  if p_priority not in ('low', 'normal', 'high') then
    raise exception 'La prioridad de la tarea no es válida.';
  end if;

  if not exists (
    select 1
    from public.subjects s
    where s.id = p_subject_id
      and (s.teacher_id = v_user_id or public.is_admin())
  ) then
    raise exception 'No puedes planificar tareas para este curso.';
  end if;

  if not exists (
    select 1
    from public.classrooms c
    where c.id = p_classroom_id
      and c.subject_id = p_subject_id
      and coalesce(c.active, true)
  ) then
    raise exception 'La clase seleccionada no pertenece al curso.';
  end if;

  if p_topic_id is not null and not exists (
    select 1
    from public.subject_topics st
    where st.id = p_topic_id
      and st.subject_id = p_subject_id
      and st.classroom_id = p_classroom_id
      and coalesce(st.active, true)
  ) then
    raise exception 'El tema seleccionado no pertenece a la clase.';
  end if;

  if p_task_id is null then
    insert into public.learning_tasks (
      subject_id, classroom_id, topic_id, teacher_id, title, description,
      starts_at, due_at, status, priority
    ) values (
      p_subject_id, p_classroom_id, p_topic_id, v_user_id, trim(p_title),
      nullif(trim(coalesce(p_description, '')), ''), p_starts_at, p_due_at,
      p_status, p_priority
    )
    returning * into v_task;
  else
    update public.learning_tasks
    set
      subject_id = p_subject_id,
      classroom_id = p_classroom_id,
      topic_id = p_topic_id,
      title = trim(p_title),
      description = nullif(trim(coalesce(p_description, '')), ''),
      starts_at = p_starts_at,
      due_at = p_due_at,
      status = p_status,
      priority = p_priority
    where id = p_task_id
      and (teacher_id = v_user_id or public.is_admin())
    returning * into v_task;

    if not found then
      raise exception 'No se encontró la tarea a editar.';
    end if;
  end if;

  if v_task.status = 'published' then
    for v_enrollment in
      select distinct e.student_id
      from public.enrollments e
      where e.subject_id = v_task.subject_id
        and (e.classroom_id = v_task.classroom_id or e.classroom_id is null)
    loop
      perform public.create_notification(
        v_enrollment.student_id,
        'student',
        'task',
        'Nueva tarea disponible',
        concat(v_task.title, ' · Fecha límite: ', to_char(v_task.due_at at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI')),
        'calendar-outline',
        '#60A5FA',
        '/(student)/tasks',
        'learning_tasks',
        v_task.id::text,
        jsonb_build_object(
          'task_id', v_task.id,
          'subject_id', v_task.subject_id,
          'classroom_id', v_task.classroom_id,
          'topic_id', v_task.topic_id,
          'due_at', v_task.due_at,
          'priority', v_task.priority
        ),
        concat('learning-task:', v_task.id)
      );
    end loop;
  end if;

  return to_jsonb(v_task);
end;
$$;

create or replace function public.delete_learning_task(p_task_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  delete from public.learning_tasks
  where id = p_task_id
    and (teacher_id = v_user_id or public.is_admin());

  if not found then
    raise exception 'No se encontró la tarea o no tienes permisos.';
  end if;

  return true;
end;
$$;

create or replace function public.get_teacher_learning_tasks_page(
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_status text default null,
  p_search text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role_id = 'teacher'
  ) then
    raise exception 'Solo los profesores pueden consultar esta planificación.';
  end if;

  with filtered as (
    select
      t.*,
      s.name as subject_name,
      s.theme_color,
      c.name as classroom_name,
      st.title as topic_name,
      (select count(*) from public.learning_task_completions tc where tc.task_id = t.id)::integer as completed_count,
      (select count(*) from public.enrollments e where e.subject_id = t.subject_id and (e.classroom_id = t.classroom_id or e.classroom_id is null))::integer as student_count
    from public.learning_tasks t
    join public.subjects s on s.id = t.subject_id
    join public.classrooms c on c.id = t.classroom_id
    left join public.subject_topics st on st.id = t.topic_id
    where (public.is_admin() or t.teacher_id = v_user_id)
      and (p_subject_id is null or t.subject_id = p_subject_id)
      and (p_classroom_id is null or t.classroom_id = p_classroom_id)
      and (nullif(trim(coalesce(p_status, '')), '') is null or t.status = p_status)
      and (p_from is null or t.due_at >= p_from)
      and (p_to is null or t.due_at < p_to)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or t.title ilike '%' || trim(p_search) || '%'
        or coalesce(t.description, '') ilike '%' || trim(p_search) || '%'
        or s.name ilike '%' || trim(p_search) || '%'
        or c.name ilike '%' || trim(p_search) || '%'
      )
  ),
  page as (
    select *
    from filtered
    order by due_at asc, id asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(page) order by page.due_at asc, page.id asc), '[]'::jsonb),
    'total', (select count(*) from filtered)
  )
  into v_result
  from page;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0));
end;
$$;

create or replace function public.get_student_learning_tasks_page(
  p_filter text default 'upcoming',
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  with filtered as (
    select distinct
      t.*,
      s.name as subject_name,
      s.theme_color,
      c.name as classroom_name,
      st.title as topic_name,
      (tc.task_id is not null) as is_completed,
      tc.completed_at,
      case
        when tc.task_id is not null then 'completed'
        when t.due_at < now() then 'overdue'
        else 'upcoming'
      end as student_status
    from public.learning_tasks t
    join public.subjects s on s.id = t.subject_id
    join public.classrooms c on c.id = t.classroom_id
    left join public.subject_topics st on st.id = t.topic_id
    join public.enrollments e
      on e.subject_id = t.subject_id
     and (e.classroom_id = t.classroom_id or e.classroom_id is null)
     and e.student_id = v_user_id
    left join public.learning_task_completions tc
      on tc.task_id = t.id
     and tc.student_id = v_user_id
    where t.status = 'published'
      and (
        p_filter = 'all'
        or (p_filter = 'completed' and tc.task_id is not null)
        or (p_filter = 'overdue' and tc.task_id is null and t.due_at < now())
        or (p_filter = 'upcoming' and tc.task_id is null and t.due_at >= now())
      )
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or t.title ilike '%' || trim(p_search) || '%'
        or coalesce(t.description, '') ilike '%' || trim(p_search) || '%'
        or s.name ilike '%' || trim(p_search) || '%'
      )
  ),
  page as (
    select *
    from filtered
    order by is_completed asc, due_at asc, id asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(page) order by page.is_completed asc, page.due_at asc, page.id asc), '[]'::jsonb),
    'total', (select count(*) from filtered)
  )
  into v_result
  from page;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0));
end;
$$;

create or replace function public.set_learning_task_completed(
  p_task_id bigint,
  p_completed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.learning_tasks%rowtype;
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  select t.*
  into v_task
  from public.learning_tasks t
  where t.id = p_task_id
    and t.status = 'published'
    and exists (
      select 1
      from public.enrollments e
      where e.student_id = v_user_id
        and e.subject_id = t.subject_id
        and (e.classroom_id = t.classroom_id or e.classroom_id is null)
    );

  if not found then
    raise exception 'La tarea no está disponible para este alumno.';
  end if;

  if p_completed then
    insert into public.learning_task_completions(task_id, student_id, completed_at)
    values (p_task_id, v_user_id, now())
    on conflict (task_id, student_id) do update
      set completed_at = excluded.completed_at
    returning completed_at into v_completed_at;
  else
    delete from public.learning_task_completions
    where task_id = p_task_id and student_id = v_user_id;
    v_completed_at := null;
  end if;

  return jsonb_build_object(
    'task_id', p_task_id,
    'completed', p_completed,
    'completed_at', v_completed_at
  );
end;
$$;

revoke all on function public.save_learning_task(bigint, bigint, bigint, bigint, text, text, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.save_learning_task(bigint, bigint, bigint, bigint, text, text, timestamptz, timestamptz, text, text) to authenticated;
revoke all on function public.delete_learning_task(bigint) from public, anon;
grant execute on function public.delete_learning_task(bigint) to authenticated;
revoke all on function public.get_teacher_learning_tasks_page(bigint, bigint, text, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_teacher_learning_tasks_page(bigint, bigint, text, text, timestamptz, timestamptz, integer, integer) to authenticated;
revoke all on function public.get_student_learning_tasks_page(text, text, integer, integer) from public, anon;
grant execute on function public.get_student_learning_tasks_page(text, text, integer, integer) to authenticated;
revoke all on function public.set_learning_task_completed(bigint, boolean) from public, anon;
grant execute on function public.set_learning_task_completed(bigint, boolean) to authenticated;

alter table public.attempt_history
  drop constraint if exists attempt_history_manual_review_status_check;
alter table public.attempt_history
  add constraint attempt_history_manual_review_status_check
  check (manual_review_status in (
    'not_required', 'pending', 'in_review', 'needs_changes', 'approved', 'rejected'
  ));

create table if not exists public.manual_review_comments (
  id bigint generated by default as identity primary key,
  attempt_history_id bigint not null references public.attempt_history(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  audience text not null default 'student',
  body text not null,
  created_at timestamptz not null default now(),
  constraint manual_review_comments_audience_check check (audience in ('student', 'internal')),
  constraint manual_review_comments_body_check check (char_length(trim(body)) between 1 and 2000)
);

create index if not exists manual_review_comments_attempt_idx
  on public.manual_review_comments(attempt_history_id, created_at asc);

insert into public.manual_review_comments (
  attempt_history_id, author_id, audience, body, created_at
)
select
  ah.id,
  ah.reviewed_by,
  'student',
  trim(ah.review_notes),
  coalesce(ah.reviewed_at, ah.attempted_at, now())
from public.attempt_history ah
where ah.reviewed_by is not null
  and nullif(trim(coalesce(ah.review_notes, '')), '') is not null
  and not exists (
    select 1
    from public.manual_review_comments c
    where c.attempt_history_id = ah.id
      and c.author_id = ah.reviewed_by
      and c.body = trim(ah.review_notes)
  );

alter table public.manual_review_comments enable row level security;

drop policy if exists "manual_review_comments_select_visible" on public.manual_review_comments;
create policy "manual_review_comments_select_visible"
on public.manual_review_comments for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id
    where ah.id = manual_review_comments.attempt_history_id
      and (
        s.teacher_id = auth.uid()
        or (ah.student_id = auth.uid() and manual_review_comments.audience = 'student')
      )
  )
);

drop policy if exists "manual_review_comments_insert_teacher" on public.manual_review_comments;
create policy "manual_review_comments_insert_teacher"
on public.manual_review_comments for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_admin()
    or exists (
      select 1
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      join public.subjects s on s.id = q.subject_id
      where ah.id = manual_review_comments.attempt_history_id
        and s.teacher_id = auth.uid()
    )
  )
);

create or replace function public.get_teacher_manual_review_queue(
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_status text default null,
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  with filtered as (
    select
      ah.id,
      ah.student_id,
      coalesce(p.alias, split_part(p.email, '@', 1), 'Alumno') as student_name,
      p.email as student_email,
      ah.question_id,
      q.text as question_text,
      ah.submitted_answer_text as answer_text,
      ah.submitted_answer_payload as answer_payload,
      ah.manual_review_status as status,
      ah.attempted_at,
      ah.reviewed_at,
      ah.review_notes,
      ah.earned_points,
      q.points_base as possible_points,
      ah.time_taken_seconds,
      s.id as subject_id,
      s.name as subject_name,
      c.id as classroom_id,
      c.name as classroom_name,
      st.id as topic_id,
      st.title as topic_name,
      (select count(*) from public.manual_review_comments mrc where mrc.attempt_history_id = ah.id)::integer as comments_count,
      (
        select mrc.body
        from public.manual_review_comments mrc
        where mrc.attempt_history_id = ah.id
        order by mrc.created_at desc, mrc.id desc
        limit 1
      ) as latest_comment
    from public.attempt_history ah
    join public.questions q on q.id = ah.question_id
    join public.subjects s on s.id = q.subject_id
    join public.classrooms c on c.id = q.classroom_id
    left join public.subject_topics st on st.id = q.topic_id
    left join public.profiles p on p.id = ah.student_id
    where q.type = 'open_answer'
      and ah.manual_review_status <> 'not_required'
      and (public.is_admin() or s.teacher_id = v_user_id)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_classroom_id is null or q.classroom_id = p_classroom_id)
      and (nullif(trim(coalesce(p_status, '')), '') is null or ah.manual_review_status = p_status)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or q.text ilike '%' || trim(p_search) || '%'
        or coalesce(ah.submitted_answer_text, '') ilike '%' || trim(p_search) || '%'
        or coalesce(p.alias, '') ilike '%' || trim(p_search) || '%'
        or coalesce(p.email, '') ilike '%' || trim(p_search) || '%'
        or s.name ilike '%' || trim(p_search) || '%'
      )
  ),
  page as (
    select *
    from filtered
    order by
      case status
        when 'pending' then 1
        when 'needs_changes' then 2
        when 'in_review' then 3
        else 4
      end,
      attempted_at asc,
      id asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(page) order by page.attempted_at asc, page.id asc), '[]'::jsonb),
    'total', (select count(*) from filtered)
  )
  into v_result
  from page;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0));
end;
$$;

create or replace function public.get_manual_review_thread(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id uuid;
  v_teacher_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  select ah.student_id, s.teacher_id
  into v_student_id, v_teacher_id
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where ah.id = p_attempt_history_id;

  if not found then
    raise exception 'Intento no encontrado.';
  end if;

  if v_user_id <> v_student_id and v_user_id <> v_teacher_id and not public.is_admin() then
    raise exception 'No puedes consultar esta revisión.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'author_id', c.author_id,
    'author_name', coalesce(p.alias, split_part(p.email, '@', 1), 'Usuario'),
    'audience', c.audience,
    'body', c.body,
    'created_at', c.created_at
  ) order by c.created_at asc, c.id asc), '[]'::jsonb)
  into v_result
  from public.manual_review_comments c
  left join public.profiles p on p.id = c.author_id
  where c.attempt_history_id = p_attempt_history_id
    and (v_user_id = v_teacher_id or public.is_admin() or c.audience = 'student');

  return v_result;
end;
$$;

create or replace function public.claim_open_answer_attempt(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.attempt_history%rowtype;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  select ah.*
  into v_attempt
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where ah.id = p_attempt_history_id
    and q.type = 'open_answer'
    and (s.teacher_id = v_user_id or public.is_admin())
  for update of ah;

  if not found then
    raise exception 'Respuesta abierta no encontrada.';
  end if;

  if v_attempt.manual_review_status not in ('pending', 'needs_changes', 'in_review') then
    raise exception 'Esta respuesta ya tiene una decisión final.';
  end if;

  update public.attempt_history
  set manual_review_status = 'in_review',
      reviewed_by = v_user_id
  where id = p_attempt_history_id;

  return jsonb_build_object('id', p_attempt_history_id, 'manual_review_status', 'in_review');
end;
$$;

create or replace function public.add_manual_review_comment(
  p_attempt_history_id bigint,
  p_body text,
  p_audience text default 'student'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment public.manual_review_comments%rowtype;
  v_student_id uuid;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null then
    raise exception 'Escribe un comentario.';
  end if;

  if p_audience not in ('student', 'internal') then
    raise exception 'La visibilidad del comentario no es válida.';
  end if;

  select ah.student_id
  into v_student_id
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where ah.id = p_attempt_history_id
    and (s.teacher_id = v_user_id or public.is_admin());

  if not found then
    raise exception 'No puedes comentar esta revisión.';
  end if;

  insert into public.manual_review_comments(attempt_history_id, author_id, audience, body)
  values (p_attempt_history_id, v_user_id, p_audience, trim(p_body))
  returning * into v_comment;

  if p_audience = 'student' then
    perform public.create_notification(
      v_student_id,
      'student',
      'manual_review',
      'Nuevo comentario del profesor',
      left(trim(p_body), 180),
      'chatbubble-ellipses-outline',
      '#A78BFA',
      '/(student)/activity-log',
      'attempt_history',
      p_attempt_history_id::text,
      jsonb_build_object('attempt_history_id', p_attempt_history_id),
      concat('manual-review-comment:', v_comment.id)
    );
  end if;

  return to_jsonb(v_comment);
end;
$$;

create or replace function public.review_open_answer_attempt_v2(
  p_attempt_history_id bigint,
  p_status text,
  p_notes text default null,
  p_comment_audience text default 'student'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_attempt public.attempt_history%rowtype;
  v_question public.questions%rowtype;
  v_classroom_id bigint;
  v_delta_points integer := 0;
  v_delta_correct integer := 0;
  v_new_earned_points integer := 0;
  v_new_is_correct boolean := false;
  v_student_id uuid;
  v_subject_max_score integer := 0;
  v_subject_correct_answers integer := 0;
  v_topic_max_score integer := 0;
  v_played_day date;
  v_rows integer := 0;
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if p_status not in ('approved', 'rejected', 'needs_changes') then
    raise exception 'El estado de revisión no es válido.';
  end if;

  select *
  into v_attempt
  from public.attempt_history
  where id = p_attempt_history_id
  for update;

  if not found then
    raise exception 'Intento no encontrado.';
  end if;

  select *
  into v_question
  from public.questions
  where id = v_attempt.question_id;

  if not found or v_question.type <> 'open_answer' then
    raise exception 'Solo se pueden revisar respuestas abiertas.';
  end if;

  if not exists (
    select 1
    from public.subjects
    where subjects.id = v_question.subject_id
      and (subjects.teacher_id = v_teacher_id or public.is_admin())
  ) then
    raise exception 'No puedes revisar respuestas de este curso.';
  end if;

  if v_attempt.manual_review_status = 'not_required' then
    raise exception 'Esta respuesta no requiere revisión manual.';
  end if;

  v_new_is_correct := p_status = 'approved';
  v_classroom_id := coalesce(v_question.classroom_id, public.ensure_default_classroom(v_question.subject_id));
  v_played_day := (coalesce(v_attempt.attempted_at, now()) at time zone 'Europe/Madrid')::date;
  v_new_earned_points := case when v_new_is_correct then coalesce(v_question.points_base, 10) else 0 end;
  v_delta_points := v_new_earned_points - coalesce(v_attempt.earned_points, 0);
  v_delta_correct := case when v_new_is_correct then 1 else 0 end
    - case when coalesce(v_attempt.is_correct, false) then 1 else 0 end;
  v_student_id := v_attempt.student_id;

  update public.attempt_history
  set is_correct = v_new_is_correct,
      earned_points = v_new_earned_points,
      manual_review_status = p_status,
      reviewed_by = v_teacher_id,
      reviewed_at = now(),
      review_notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_attempt_history_id;

  if v_attempt.attempt_id is not null then
    update public.game_attempts
    set total_score = greatest(0, coalesce(total_score, 0) + v_delta_points),
        correct_answers = greatest(0, coalesce(correct_answers, 0) + v_delta_correct),
        updated_at = now()
    where id = v_attempt.attempt_id;
  end if;

  select greatest(
    coalesce((
      select max(coalesce(ga.total_score, 0))::integer
      from public.game_attempts ga
      where ga.student_id = v_attempt.student_id
        and ga.subject_id = v_question.subject_id
        and coalesce(ga.classroom_id, v_classroom_id) = v_classroom_id
    ), 0),
    coalesce((
      select max(coalesce(ah.earned_points, 0))::integer
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where ah.student_id = v_attempt.student_id
        and q.subject_id = v_question.subject_id
        and coalesce(q.classroom_id, public.ensure_default_classroom(q.subject_id)) = v_classroom_id
    ), 0)
  )
  into v_subject_max_score;

  select count(*) filter (where coalesce(ah.is_correct, false))::integer
  into v_subject_correct_answers
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  where ah.student_id = v_attempt.student_id
    and q.subject_id = v_question.subject_id
    and coalesce(q.classroom_id, public.ensure_default_classroom(q.subject_id)) = v_classroom_id;

  update public.subject_scores
  set max_score = v_subject_max_score,
      correct_answers = v_subject_correct_answers,
      played_days = (
        select array_agg(distinct day order by day)
        from unnest(array_append(coalesce(played_days, '{}'::date[]), v_played_day)) as day
      ),
      played_at = greatest(coalesce(played_at, 'epoch'::timestamptz), coalesce(v_attempt.attempted_at, now())),
      updated_at = now(),
      subject_id = v_question.subject_id
  where student_id = v_attempt.student_id
    and classroom_id = v_classroom_id;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.subject_scores (
      student_id, subject_id, classroom_id, max_score, correct_answers,
      played_days, played_at, updated_at
    ) values (
      v_attempt.student_id, v_question.subject_id, v_classroom_id,
      v_subject_max_score, v_subject_correct_answers, array[v_played_day],
      coalesce(v_attempt.attempted_at, now()), now()
    );
  end if;

  if v_question.topic_id is not null then
    select greatest(
      coalesce((
        select max(coalesce(ga.total_score, 0))::integer
        from public.game_attempts ga
        where ga.student_id = v_attempt.student_id
          and ga.subject_id = v_question.subject_id
          and ga.topic_id = v_question.topic_id
          and coalesce(ga.classroom_id, v_classroom_id) = v_classroom_id
      ), 0),
      coalesce((
        select max(coalesce(ah.earned_points, 0))::integer
        from public.attempt_history ah
        join public.questions q on q.id = ah.question_id
        where ah.student_id = v_attempt.student_id
          and q.subject_id = v_question.subject_id
          and q.topic_id = v_question.topic_id
          and coalesce(q.classroom_id, public.ensure_default_classroom(q.subject_id)) = v_classroom_id
      ), 0)
    )
    into v_topic_max_score;

    update public.topic_scores
    set max_score = v_topic_max_score,
        played_at = greatest(coalesce(played_at, 'epoch'::timestamptz), coalesce(v_attempt.attempted_at, now())),
        updated_at = now(),
        classroom_id = v_classroom_id,
        subject_id = v_question.subject_id
    where student_id = v_attempt.student_id
      and topic_id = v_question.topic_id;

    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      insert into public.topic_scores (
        student_id, subject_id, classroom_id, topic_id, max_score,
        played_at, updated_at
      ) values (
        v_attempt.student_id, v_question.subject_id, v_classroom_id,
        v_question.topic_id, v_topic_max_score,
        coalesce(v_attempt.attempted_at, now()), now()
      );
    end if;
  end if;

  perform public.recalculate_student_points(v_attempt.student_id);

  if nullif(trim(coalesce(p_notes, '')), '') is not null then
    perform public.add_manual_review_comment(
      p_attempt_history_id,
      p_notes,
      p_comment_audience
    );
  end if;

  perform public.create_notification(
    v_student_id,
    'student',
    'manual_review',
    case
      when p_status = 'approved' then 'Respuesta abierta aprobada'
      when p_status = 'rejected' then 'Respuesta abierta revisada'
      else 'Tu respuesta necesita cambios'
    end,
    case
      when p_status = 'approved' then concat('Has obtenido ', v_new_earned_points, ' XP.')
      when p_status = 'rejected' then 'El profesor ha revisado tu respuesta. Consulta el comentario para mejorar.'
      else 'El profesor ha dejado indicaciones para que revises el contenido.'
    end,
    case when p_status = 'approved' then 'checkmark-circle-outline' else 'create-outline' end,
    case when p_status = 'approved' then '#34D399' else '#F59E0B' end,
    '/(student)/activity-log',
    'attempt_history',
    p_attempt_history_id::text,
    jsonb_build_object(
      'attempt_history_id', p_attempt_history_id,
      'manual_review_status', p_status,
      'earned_points', v_new_earned_points
    ),
    concat('manual-review-status:', p_attempt_history_id, ':', p_status)
  );

  return jsonb_build_object(
    'id', p_attempt_history_id,
    'is_correct', v_new_is_correct,
    'earned_points', v_new_earned_points,
    'manual_review_status', p_status,
    'subject_max_score', v_subject_max_score,
    'subject_correct_answers', v_subject_correct_answers,
    'topic_max_score', case when v_question.topic_id is null then null else v_topic_max_score end
  );
end;
$$;

create or replace function public.review_open_answer_attempt(
  p_attempt_history_id bigint,
  p_is_correct boolean,
  p_notes text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.review_open_answer_attempt_v2(
    p_attempt_history_id,
    case when p_is_correct then 'approved' else 'rejected' end,
    p_notes,
    'student'
  );
$$;

create or replace function public.get_attempt_feedback(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.attempt_history%rowtype;
  v_question public.questions%rowtype;
  v_subject_teacher_id uuid;
  v_correct_answer_id bigint := null;
  v_correct_answer_text text := null;
  v_requires_manual_review boolean := false;
  v_reveal_solution boolean := false;
  v_comments jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select ah.* into v_attempt
  from public.attempt_history ah
  where ah.id = p_attempt_history_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  select q.* into v_question
  from public.questions q
  where q.id = v_attempt.question_id;

  if not found then
    raise exception 'Question not found for attempt';
  end if;

  select s.teacher_id into v_subject_teacher_id
  from public.subjects s
  where s.id = v_question.subject_id;

  if v_attempt.student_id <> v_user_id
     and v_subject_teacher_id <> v_user_id
     and not public.is_admin() then
    raise exception 'No puedes consultar este intento.';
  end if;

  v_requires_manual_review := coalesce(v_attempt.manual_review_status, 'not_required') <> 'not_required';
  v_reveal_solution := coalesce(v_attempt.manual_review_status, 'not_required') in ('not_required', 'approved', 'rejected');

  if v_reveal_solution then
    if v_question.type in ('multiple_choice', 'true_false') then
      select a.id into v_correct_answer_id
      from public.answers a
      where a.question_id = v_question.id
        and coalesce(a.is_correct, false)
      order by a.sort_order nulls last, a.id
      limit 1;
    end if;

    select string_agg(
      case
        when v_question.type in ('match_pairs', 'drag_drop') then concat(split_part(a.text, '|||', 1), ' -> ', split_part(a.text, '|||', 2))
        else a.text
      end,
      ', '
      order by a.sort_order nulls last, a.id
    )
    into v_correct_answer_text
    from public.answers a
    where a.question_id = v_question.id
      and (
        coalesce(a.is_correct, true)
        or v_question.type in ('ordering', 'match_pairs', 'drag_drop')
      );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'author_name', coalesce(p.alias, split_part(p.email, '@', 1), 'Profesor'),
    'body', c.body,
    'created_at', c.created_at
  ) order by c.created_at asc, c.id asc), '[]'::jsonb)
  into v_comments
  from public.manual_review_comments c
  left join public.profiles p on p.id = c.author_id
  where c.attempt_history_id = p_attempt_history_id
    and (v_user_id = v_subject_teacher_id or public.is_admin() or c.audience = 'student');

  return jsonb_build_object(
    'attempt_history_id', v_attempt.id,
    'is_correct', v_attempt.is_correct,
    'requires_manual_review', v_requires_manual_review,
    'manual_review_status', v_attempt.manual_review_status,
    'earned_points', v_attempt.earned_points,
    'correct_answer_id', v_correct_answer_id,
    'correct_answer_text', v_correct_answer_text,
    'explanation', case when v_reveal_solution then v_question.explanation else null end,
    'review_notes', case when v_user_id = v_subject_teacher_id or public.is_admin() then v_attempt.review_notes else null end,
    'review_comments', v_comments
  );
end;
$$;

create or replace function public.get_activity_attempt_detail(p_attempt_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_owner_id uuid;
  v_teacher_id uuid;
  v_review_status text;
  v_reveal_solution boolean := false;
  v_comments jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  select ah.student_id, s.teacher_id, coalesce(ah.manual_review_status, 'not_required')
  into v_owner_id, v_teacher_id, v_review_status
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  where ah.id = p_attempt_history_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  if v_owner_id <> v_user_id
     and v_teacher_id <> v_user_id
     and not public.is_admin() then
    raise exception 'No puedes consultar este intento.';
  end if;

  v_reveal_solution := v_review_status in ('not_required', 'approved', 'rejected');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'author_name', coalesce(p.alias, split_part(p.email, '@', 1), 'Profesor'),
    'body', c.body,
    'created_at', c.created_at
  ) order by c.created_at asc, c.id asc), '[]'::jsonb)
  into v_comments
  from public.manual_review_comments c
  left join public.profiles p on p.id = c.author_id
  where c.attempt_history_id = p_attempt_history_id
    and (v_user_id = v_teacher_id or public.is_admin() or c.audience = 'student');

  select jsonb_build_object(
    'id', ah.id,
    'question_id', ah.question_id,
    'answer_id', ah.answer_id,
    'is_correct', ah.is_correct,
    'time_taken_seconds', ah.time_taken_seconds,
    'attempted_at', ah.attempted_at,
    'submitted_answer_text', ah.submitted_answer_text,
    'submitted_answer_payload', ah.submitted_answer_payload,
    'earned_points', ah.earned_points,
    'hint_used', ah.hint_used,
    'was_skipped', ah.was_skipped,
    'manual_review_status', ah.manual_review_status,
    'review_notes', case when v_user_id = v_teacher_id or public.is_admin() then ah.review_notes else null end,
    'review_comments', v_comments,
    'questions', jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'difficulty', coalesce(q.difficulty, 1),
      'subject_id', q.subject_id,
      'classroom_id', q.classroom_id,
      'topic_id', q.topic_id,
      'media_type', q.media_type,
      'media_url', q.media_url,
      'media_alt_text', q.media_alt_text,
      'media_caption', q.media_caption,
      'explanation', case when v_reveal_solution then q.explanation else null end,
      'subjects', jsonb_build_object('id', s.id, 'name', s.name),
      'subject_topics', case
        when st.id is null then null
        else jsonb_build_object('id', st.id, 'title', st.title)
      end,
      'answers', case
        when not v_reveal_solution then '[]'::jsonb
        else coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', a.id,
              'text', a.text,
              'is_correct', a.is_correct,
              'sort_order', a.sort_order
            )
            order by a.sort_order nulls last, a.id
          )
          from public.answers a
          where a.question_id = q.id
        ), '[]'::jsonb)
      end
    )
  )
  into v_result
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  join public.subjects s on s.id = q.subject_id
  left join public.subject_topics st on st.id = q.topic_id
  where ah.id = p_attempt_history_id;

  return v_result;
end;
$$;

revoke all on function public.get_teacher_manual_review_queue(bigint, bigint, text, text, integer, integer) from public, anon;
grant execute on function public.get_teacher_manual_review_queue(bigint, bigint, text, text, integer, integer) to authenticated;
revoke all on function public.get_manual_review_thread(bigint) from public, anon;
grant execute on function public.get_manual_review_thread(bigint) to authenticated;
revoke all on function public.claim_open_answer_attempt(bigint) from public, anon;
grant execute on function public.claim_open_answer_attempt(bigint) to authenticated;
revoke all on function public.add_manual_review_comment(bigint, text, text) from public, anon;
grant execute on function public.add_manual_review_comment(bigint, text, text) to authenticated;
revoke all on function public.review_open_answer_attempt_v2(bigint, text, text, text) from public, anon;
grant execute on function public.review_open_answer_attempt_v2(bigint, text, text, text) to authenticated;
revoke all on function public.review_open_answer_attempt(bigint, boolean, text) from public, anon;
grant execute on function public.review_open_answer_attempt(bigint, boolean, text) to authenticated;
revoke all on function public.get_attempt_feedback(bigint) from public, anon;
grant execute on function public.get_attempt_feedback(bigint) to authenticated;
revoke all on function public.get_activity_attempt_detail(bigint) from public, anon;
grant execute on function public.get_activity_attempt_detail(bigint) to authenticated;

notify pgrst, 'reload schema';

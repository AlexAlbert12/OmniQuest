begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'archive.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Archive Teacher","role_id":"teacher"}', now(), now()),
  ('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'archive.other.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Other Archive Teacher","role_id":"teacher"}', now(), now()),
  ('24000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'archive.student@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Archive Student","role_id":"student"}', now(), now()),
  ('24000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'archive.admin@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Archive Admin","role_id":"admin"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values
  ('24000000-0000-0000-0000-000000000001', 'Archive Teacher', 'archive.teacher@omniquest.test', 'teacher', true, 'private'),
  ('24000000-0000-0000-0000-000000000002', 'Other Archive Teacher', 'archive.other.teacher@omniquest.test', 'teacher', true, 'private'),
  ('24000000-0000-0000-0000-000000000003', 'Archive Student', 'archive.student@omniquest.test', 'student', true, 'private'),
  ('24000000-0000-0000-0000-000000000004', 'Archive Admin', 'archive.admin@omniquest.test', 'admin', true, 'private')
on conflict (id) do update
set alias = excluded.alias,
    email = excluded.email,
    role_id = excluded.role_id,
    active = excluded.active;

insert into public.admin_role_assignments (user_id, role_id, assigned_by)
values (
  '24000000-0000-0000-0000-000000000004',
  'super_admin',
  '24000000-0000-0000-0000-000000000004'
)
on conflict (user_id) do update
set role_id = excluded.role_id,
    assigned_by = excluded.assigned_by,
    updated_at = now();

insert into public.subjects (
  id, teacher_id, name, code, active, is_archived, archive_reason, archived_at, retention_until
)
values
  (924001, '24000000-0000-0000-0000-000000000001', 'Curso activo de archivo', 'ACT924', true, false, null, null, null),
  (924002, '24000000-0000-0000-0000-000000000001', 'Curso archivado propio', 'ARC924', false, true, 'Archivado por el profesor', '2026-09-01T10:00:00Z', '2026-11-30T10:00:00Z'),
  (924003, '24000000-0000-0000-0000-000000000002', 'Curso archivado ajeno', 'OTH924', false, true, null, null, null),
  (924004, '24000000-0000-0000-0000-000000000001', 'Curso inactivo', 'INA924', false, false, null, null, null);

insert into public.classrooms (id, subject_id, name, code, active)
values
  (924001, 924001, 'Clase activa de archivo', 'CLA924', true),
  (924002, 924002, 'Clase conservada de archivo', 'CLR924', true),
  (924004, 924004, 'Clase de curso inactivo', 'CLI924', true);

insert into public.subject_topics (id, subject_id, classroom_id, title, active)
values
  (924001, 924001, 924001, 'Tema activo de archivo', true),
  (924002, 924002, 924002, 'Tema conservado de archivo', true),
  (924004, 924004, 924004, 'Tema de curso inactivo', true);

insert into public.questions (
  id, subject_id, classroom_id, topic_id, type, text, points_base, time_limit_seconds, difficulty, active
)
values
  (924001, 924001, 924001, 924001, 'multiple_choice', 'Pregunta activa de archivo', 10, 30, 1, true),
  (924002, 924002, 924002, 924002, 'multiple_choice', 'Pregunta conservada de archivo', 10, 30, 1, true),
  (924004, 924004, 924004, 924004, 'multiple_choice', 'Pregunta de curso inactivo', 10, 30, 1, true);

insert into public.answers (id, question_id, text, is_correct, sort_order)
values
  (924001, 924001, 'Correcta activa', true, 1),
  (924002, 924001, 'Incorrecta activa', false, 2),
  (924003, 924002, 'Correcta archivada', true, 1),
  (924004, 924004, 'Correcta inactiva', true, 1);

insert into public.enrollments (student_id, subject_id, classroom_id)
values
  ('24000000-0000-0000-0000-000000000003', 924001, 924001),
  ('24000000-0000-0000-0000-000000000003', 924002, 924002),
  ('24000000-0000-0000-0000-000000000003', 924004, 924004);

set local role authenticated;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (public.get_teacher_courses_page(null, null, 'recent', 100, 0)->>'total')::integer,
  1,
  'the default teacher catalog still counts only active courses'
);

select ok(
  exists (select 1 from jsonb_array_elements(public.get_teacher_courses_page(null, null, 'recent', 100, 0)->'items') item where (item->>'id')::bigint = 924001)
  and not exists (select 1 from jsonb_array_elements(public.get_teacher_courses_page(null, null, 'recent', 100, 0)->'items') item where (item->>'id')::bigint in (924002, 924003, 924004)),
  'the active catalog includes the own active course and excludes archived, inactive and foreign courses'
);

select is(
  (public.get_teacher_courses_page(null, 'no_activity', 'recent', 100, 0)->>'total')::integer,
  1,
  'existing academic status filters still apply to active courses'
);

select is(
  (public.get_teacher_courses_page(null, 'archived', 'recent', 100, 0)->>'total')::integer,
  1,
  'the archived filter returns only the authenticated teacher archived courses'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_teacher_courses_page(null, 'archived', 'recent', 100, 0)->'items') item
    where (item->>'id')::bigint = 924002
      and (item->>'active')::boolean is false
      and (item->>'isArchived')::boolean is true
      and item->>'archiveReason' = 'Archivado por el profesor'
      and item ? 'archivedAt'
      and item ? 'retentionUntil'
  ),
  'archived items include status and retention metadata'
);

select is(
  (public.get_teacher_courses_page(null, 'archived', 'recent', 100, 0)->'summary'->>'courses')::integer,
  1,
  'the courses summary remains the active course count while browsing archived courses'
);

select is(
  (public.get_teacher_courses_page(null, 'archived', 'recent', 100, 0)->'summary'->>'archivedCourses')::integer,
  1,
  'the archived summary is exposed separately'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_teacher_courses_page(null, 'archived', 'recent', 100, 0)->'items') item
    where (item->>'id')::bigint = 924003
  ),
  'a teacher never sees another teacher archived course'
);

select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000003', true);

select is(
  jsonb_array_length(public.get_safe_game_questions(924001, 924001, 924001, false, 1, false)),
  1,
  'an active course still returns a safe question payload'
);

select is(
  jsonb_array_length(public.get_safe_game_questions_v2(924001, 924001, 924001, false, 1, false)),
  1,
  'the v2 safe question wrapper still works for an active course'
);

select is(
  jsonb_array_length(public.get_student_question_catalog(924001, 924001)),
  1,
  'the enrolled student question catalog still works for an active course'
);

select lives_ok(
  $$select public.start_game_attempt(924001, 924001, 924001, false, 1)$$,
  'an enrolled student can still start a game in an active course'
);

select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000004', true);

select is(
  (select count(*) from public.get_admin_subjects_page(null, 924002, null, true, null, null, null, 50, 0)),
  1::bigint,
  'the administrator continues to see a teacher archived course'
);

reset role;
update public.subjects
set active = false,
    is_archived = true,
    archive_reason = 'Archivado por el profesor',
    archived_at = now(),
    retention_until = now() + interval '90 days'
where id = 924001;

set local role authenticated;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select public.start_game_attempt(924001, 924001, 924001, false, 1)$$,
  'Este curso no está disponible para jugar.',
  'an archived subject cannot start a new game attempt'
);

select throws_ok(
  $$select public.get_safe_game_questions(924001, 924001, 924001, false, 1, false)$$,
  'Este curso no está disponible para jugar.',
  'an archived subject cannot return safe game questions'
);

select throws_ok(
  $$select public.get_safe_game_questions_v2(924001, 924001, 924001, false, 1, false)$$,
  'Este curso no está disponible para jugar.',
  'the v2 safe question wrapper also rejects an archived subject'
);

select is(
  jsonb_array_length(public.get_student_question_catalog(924001, 924001)),
  0,
  'the direct student question catalog returns no content for an archived subject'
);

select throws_ok(
  $$select public.join_subject_by_code('ACT924')$$,
  'No se ha encontrado ningún curso o clase con ese código.',
  'a student cannot join an archived subject by code'
);

select is(
  (select count(*) from jsonb_array_elements(public.get_student_progress_summary()->'subjects') item where (item->>'id')::bigint = 924001),
  0::bigint,
  'an archived subject disappears from the active student catalog'
);

reset role;

select ok(
  (select count(*) from public.enrollments where subject_id = 924001 and student_id = '24000000-0000-0000-0000-000000000003') = 1
  and (select count(*) from public.questions where subject_id = 924001) = 1
  and (select coalesce(active, false) from public.classrooms where id = 924001),
  'archiving preserves enrollment, questions and classroom state'
);

update public.subjects
set active = true,
    is_archived = false,
    archive_reason = null,
    archived_at = null,
    retention_until = null
where id = 924001;

set local role authenticated;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000003', true);

select lives_ok(
  $$select public.start_game_attempt(924001, 924001, 924001, false, 1)$$,
  'a restored course allows the normal game flow again'
);

select is(
  jsonb_array_length(public.get_safe_game_questions(924001, 924001, 924001, false, 1, false)),
  1,
  'a restored course returns its intact safe question payload again'
);

select is(
  (select count(*) from jsonb_array_elements(public.get_student_progress_summary()->'subjects') item where (item->>'id')::bigint = 924001),
  1::bigint,
  'a restored course returns to the student active catalog'
);

select throws_ok(
  $$select public.start_game_attempt(924004, 924004, 924004, false, 1)$$,
  'Este curso no está disponible para jugar.',
  'an inactive subject cannot start a new game attempt'
);

select throws_ok(
  $$select public.get_safe_game_questions(924004, 924004, 924004, false, 1, false)$$,
  'Este curso no está disponible para jugar.',
  'an inactive subject cannot return safe game questions'
);

select is(
  jsonb_array_length(public.get_student_question_catalog(924004, 924004)),
  0,
  'the direct student question catalog returns no content for an inactive subject'
);

select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000004', true);

select is(
  (select count(*) from public.get_admin_subjects_page(null, 924001, null, false, true, null, null, 50, 0)),
  1::bigint,
  'the restored course remains compatible with the administrator active view'
);

select * from finish();
rollback;

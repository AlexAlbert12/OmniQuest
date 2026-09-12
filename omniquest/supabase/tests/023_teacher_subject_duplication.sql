begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

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
  ('23000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'duplicate.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Duplicate Teacher","role_id":"teacher"}', now(), now()),
  ('23000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other.duplicate.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Other Duplicate Teacher","role_id":"teacher"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values
  ('23000000-0000-0000-0000-000000000001', 'Duplicate Teacher', 'duplicate.teacher@omniquest.test', 'teacher', true, 'private'),
  ('23000000-0000-0000-0000-000000000002', 'Other Duplicate Teacher', 'other.duplicate.teacher@omniquest.test', 'teacher', true, 'private')
on conflict (id) do update
set alias = excluded.alias,
    email = excluded.email,
    role_id = excluded.role_id,
    active = excluded.active;

insert into public.subjects (id, teacher_id, name, description, icon, code, academic_year, theme_color, active)
values (923001, '23000000-0000-0000-0000-000000000001', 'Curso para duplicar', 'Descripción original', 'book-outline', 'DUP230', '2026/27', '#2563EB', true);

insert into public.classrooms (id, subject_id, name, academic_year, code, active)
values
  (923001, 923001, 'Clase A', '2026/27', 'CLA230', true),
  (923002, 923001, 'Clase B', '2026/27', 'CLB230', true);

insert into public.subject_topics (id, subject_id, classroom_id, title, description, icon, sort_order, active, available_until)
values
  (923001, 923001, 923001, 'Tema A', 'Primer tema', 'book-outline', 1, true, '2027-06-01T12:00:00Z'),
  (923002, 923001, 923002, 'Tema B', 'Segundo tema', 'bulb-outline', 1, true, null);

insert into public.questions (
  id,
  subject_id,
  classroom_id,
  topic_id,
  type,
  text,
  points_base,
  time_limit_seconds,
  difficulty,
  explanation,
  hint,
  active
)
values
  (923001, 923001, 923001, 923001, 'multiple_choice', '¿Cuál es la respuesta correcta?', 20, 45, 2, 'La primera.', 'Mira la primera opción.', true),
  (923002, 923001, 923002, 923002, 'true_false', 'La duplicación conserva relaciones.', 10, 30, 1, 'Sí.', null, true);

insert into public.answers (id, question_id, text, is_correct, sort_order)
values
  (923001, 923001, 'Correcta', true, 1),
  (923002, 923001, 'Incorrecta', false, 2),
  (923003, 923002, 'Verdadero', true, 1),
  (923004, 923002, 'Falso', false, 2);

create temporary table teacher_subject_duplication_test_state (
  result jsonb
);
grant select, insert on teacher_subject_duplication_test_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$insert into pg_temp.teacher_subject_duplication_test_state select public.duplicate_teacher_subject(923001, ' (Copia)')$$,
  'an owning teacher can duplicate a course'
);

select is(
  (select name from public.subjects where id = ((select result from pg_temp.teacher_subject_duplication_test_state)->>'id')::bigint),
  'Curso para duplicar (Copia)',
  'the duplicated course has the expected name'
);

select is(
  (select count(*) from public.classrooms where subject_id = ((select result from pg_temp.teacher_subject_duplication_test_state)->>'id')::bigint),
  2::bigint,
  'all classrooms are duplicated'
);

select is(
  (select count(*) from public.subject_topics where subject_id = ((select result from pg_temp.teacher_subject_duplication_test_state)->>'id')::bigint),
  2::bigint,
  'all topics are duplicated'
);

select is(
  (
    select count(*)
    from public.subject_topics
    where subject_id = ((select result from pg_temp.teacher_subject_duplication_test_state)->>'id')::bigint
      and title = 'Tema A'
      and available_until = '2027-06-01T12:00:00Z'::timestamptz
  ),
  1::bigint,
  'topic deadlines are preserved'
);

select is(
  (
    select count(*)
    from public.questions question
    join public.subject_topics topic on topic.id = question.topic_id
    join public.classrooms classroom on classroom.id = question.classroom_id
    where question.subject_id = ((select result from pg_temp.teacher_subject_duplication_test_state)->>'id')::bigint
      and topic.subject_id = question.subject_id
      and classroom.subject_id = question.subject_id
      and question.hint = 'Mira la primera opción.'
  ),
  1::bigint,
  'questions keep valid target relations and hints'
);

select is(
  (
    select count(*)
    from public.answers answer
    join public.questions question on question.id = answer.question_id
    where question.subject_id = ((select result from pg_temp.teacher_subject_duplication_test_state)->>'id')::bigint
  ),
  4::bigint,
  'all answers are duplicated'
);

select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.duplicate_teacher_subject(923001, ' (Copia)')$$,
  'No puedes duplicar este curso.',
  'another teacher cannot duplicate a foreign course'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

-- Stable identities used only inside this rolled-back test transaction.
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
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher.security@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Teacher Security","role_id":"teacher"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.security@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Student Security","role_id":"student"}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider.security@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Outsider Student","role_id":"student"}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Other Teacher","role_id":"teacher"}', now(), now()),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.security@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Admin Security","role_id":"admin"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values
  ('10000000-0000-0000-0000-000000000001', 'Teacher Security', 'teacher.security@omniquest.test', 'teacher', true, 'private'),
  ('10000000-0000-0000-0000-000000000002', 'Student Security', 'student.security@omniquest.test', 'student', true, 'private'),
  ('10000000-0000-0000-0000-000000000003', 'Outsider Student', 'outsider.security@omniquest.test', 'student', true, 'private'),
  ('10000000-0000-0000-0000-000000000004', 'Other Teacher', 'other.teacher@omniquest.test', 'teacher', true, 'private'),
  ('10000000-0000-0000-0000-000000000005', 'Admin Security', 'admin.security@omniquest.test', 'admin', true, 'private')
on conflict (id) do update
set alias = excluded.alias,
    email = excluded.email,
    role_id = excluded.role_id,
    active = excluded.active;

insert into public.subjects (id, teacher_id, name, code, active)
values (910001, '10000000-0000-0000-0000-000000000001', 'Security Course', 'SEC-910001', true);

insert into public.classrooms (id, subject_id, name, code, active)
values (910001, 910001, 'Security Classroom', 'SEC-CLASS-910001', true);

insert into public.subject_topics (id, subject_id, classroom_id, title, active)
values (910001, 910001, 910001, 'Security Topic', true);

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
  active
)
values (
  910001,
  910001,
  910001,
  910001,
  'multiple_choice',
  'Which answer is correct?',
  10,
  30,
  1,
  'The protected explanation is only visible after submitting.',
  true
);

insert into public.answers (id, question_id, text, is_correct, sort_order)
values
  (910001, 910001, 'Correct answer', true, 1),
  (910002, 910001, 'Incorrect answer', false, 2);

insert into public.enrollments (student_id, subject_id, classroom_id)
values ('10000000-0000-0000-0000-000000000002', 910001, 910001);

create temporary table security_test_state (
  attempt_id uuid,
  submit_payload jsonb,
  attempt_history_id bigint
);
insert into security_test_state default values;
grant select, update on security_test_state to authenticated;

-- Enrolled students cannot inspect the base answer-key tables.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.questions where id = 910001),
  0::bigint,
  'student cannot read authoring questions through RLS'
);

select is(
  (select count(*) from public.answers where question_id = 910001),
  0::bigint,
  'student cannot read answer keys through RLS'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_game_questions(bigint,bigint,bigint,boolean,integer)',
    'EXECUTE'
  ),
  'legacy get_game_questions RPC is not executable by authenticated users'
);

select is(
  jsonb_array_length(public.get_safe_game_questions(910001, 910001, 910001, false, 1, false)),
  1,
  'safe game RPC returns enrolled questions'
);

select ok(
  not ((public.get_safe_game_questions(910001, 910001, 910001, false, 1, false)->0) ? 'explanation'),
  'safe game payload omits explanation'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements((public.get_safe_game_questions(910001, 910001, 910001, false, 1, false)->0)->'answers') answer
    where answer ? 'is_correct'
  ),
  'safe answer options omit is_correct'
);

update security_test_state
set attempt_id = public.start_game_attempt(910001, 910001, 910001, false, 1);

update security_test_state
set submit_payload = public.submit_answer(
  910001,
  910001,
  null,
  null,
  10,
  false,
  false,
  attempt_id
);

update security_test_state
set attempt_history_id = (submit_payload->>'attempt_history_id')::bigint;

select ok(
  not (submit_payload ? 'correct_answer_text')
  and not (submit_payload ? 'explanation')
  and not (submit_payload ? 'correct_answer_id'),
  'submit_answer returns scoring metadata but no answer key'
)
from security_test_state;

select is(
  (submit_payload->>'earned_points')::integer,
  20,
  'submit_answer awards server-calculated XP'
)
from security_test_state;

select is(
  (select earned_points from public.attempt_history where id = security_test_state.attempt_history_id),
  20,
  'earned XP is persisted in attempt_history'
)
from security_test_state;

select is(
  public.get_attempt_feedback(attempt_history_id)->>'correct_answer_text',
  'Correct answer',
  'attempt owner receives the correct answer only after submitting'
)
from security_test_state;

select is(
  public.get_attempt_feedback(attempt_history_id)->>'explanation',
  'The protected explanation is only visible after submitting.',
  'attempt owner receives explanation only after submitting'
)
from security_test_state;

select is(
  public.get_activity_attempt_detail(attempt_history_id)->'questions'->>'text',
  'Which answer is correct?',
  'attempt owner can load post-attempt activity detail'
)
from security_test_state;

select lives_ok(
  $$select public.sync_student_badges()$$,
  'badge synchronization completes after a scored attempt'
);

select ok(
  exists (
    select 1
    from public.student_badges
    where student_id = '10000000-0000-0000-0000-000000000002'
      and badge_id = 'first-step'
  ),
  'first correct answer unlocks the first-step badge'
);

-- An unenrolled student cannot load the game or another student's feedback.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select public.get_safe_game_questions(910001, 910001, 910001, false, 1, false)$$,
  'No puedes acceder a esta clase.',
  'unenrolled student cannot load safe questions'
);

select throws_ok(
  format(
    'select public.get_attempt_feedback(%s)',
    (select attempt_history_id from security_test_state)
  ),
  'No puedes consultar este intento.',
  'student cannot read another student attempt feedback'
);

-- The owning teacher can read the complete authoring data.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*) from public.questions where id = 910001),
  1::bigint,
  'owning teacher can select own questions'
);
select is(
  (select count(*) from public.answers where question_id = 910001),
  2::bigint,
  'owning teacher can select own answers'
);

-- A different teacher cannot inspect another teacher's answer key.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*) from public.answers where question_id = 910001),
  0::bigint,
  'other teacher cannot select foreign answers'
);

-- Admin policy remains available.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select is(
  (select count(*) from public.answers where question_id = 910001),
  2::bigint,
  'administrator can inspect answers for support and audit purposes'
);

select * from finish();
rollback;

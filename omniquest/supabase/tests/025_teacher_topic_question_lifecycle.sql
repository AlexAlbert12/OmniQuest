begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('25000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Lifecycle Teacher","role_id":"teacher"}', now(), now()),
  ('25000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle.other.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Other Lifecycle Teacher","role_id":"teacher"}', now(), now()),
  ('25000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle.student@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Lifecycle Student","role_id":"student"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values
  ('25000000-0000-0000-0000-000000000001', 'Lifecycle Teacher', 'lifecycle.teacher@omniquest.test', 'teacher', true, 'private'),
  ('25000000-0000-0000-0000-000000000002', 'Other Lifecycle Teacher', 'lifecycle.other.teacher@omniquest.test', 'teacher', true, 'private'),
  ('25000000-0000-0000-0000-000000000003', 'Lifecycle Student', 'lifecycle.student@omniquest.test', 'student', true, 'private')
on conflict (id) do update
set alias = excluded.alias, email = excluded.email, role_id = excluded.role_id, active = excluded.active;

insert into public.subjects (id, teacher_id, name, code, active, is_archived)
values
  (925001, '25000000-0000-0000-0000-000000000001', 'Curso lifecycle', 'LCY925', true, false),
  (925002, '25000000-0000-0000-0000-000000000001', 'Curso lifecycle archivado', 'LCA925', false, true),
  (925003, '25000000-0000-0000-0000-000000000002', 'Curso lifecycle ajeno', 'LCO925', true, false);

insert into public.classrooms (id, subject_id, name, code, active)
values
  (925001, 925001, 'Clase lifecycle', 'CLC925', true),
  (925002, 925002, 'Clase archivada lifecycle', 'CLA925', true),
  (925003, 925003, 'Clase ajena lifecycle', 'CLO925', true);

insert into public.subject_topics (id, subject_id, classroom_id, title, active)
values
  (925001, 925001, 925001, 'Tema lifecycle principal', true),
  (925002, 925002, 925002, 'Tema de curso archivado', false),
  (925003, 925003, 925003, 'Tema lifecycle ajeno', false),
  (925010, 925001, 925001, 'Tema eliminable', true),
  (925020, 925001, 925001, 'Tema con histórico', true),
  (925040, 925001, 925001, 'Tema de juego', true);

insert into public.questions (
  id, subject_id, classroom_id, topic_id, type, text, points_base, time_limit_seconds, difficulty, active
)
values
  (925001, 925001, 925001, 925001, 'multiple_choice', 'Pregunta activa que conserva estado', 10, 30, 1, true),
  (925002, 925001, 925001, 925001, 'multiple_choice', 'Pregunta ya archivada', 10, 30, 1, false),
  (925010, 925001, 925001, 925010, 'multiple_choice', 'Pregunta de tema eliminable', 10, 30, 1, true),
  (925020, 925001, 925001, 925020, 'multiple_choice', 'Pregunta de tema con histórico', 10, 30, 1, true),
  (925030, 925001, 925001, null, 'multiple_choice', 'Pregunta eliminable', 10, 30, 1, true),
  (925031, 925001, 925001, null, 'multiple_choice', 'Pregunta con histórico', 10, 30, 1, true),
  (925040, 925001, 925001, 925040, 'multiple_choice', 'Pregunta jugable de tema', 10, 30, 1, true);

insert into public.answers (id, question_id, text, is_correct, sort_order)
values
  (925001, 925001, 'Correcta', true, 1),
  (925002, 925001, 'Incorrecta', false, 2),
  (925010, 925010, 'Correcta', true, 1),
  (925020, 925020, 'Correcta', true, 1),
  (925030, 925030, 'Correcta', true, 1),
  (925031, 925031, 'Correcta', true, 1),
  (925040, 925040, 'Correcta', true, 1);

insert into public.enrollments (student_id, subject_id, classroom_id)
values ('25000000-0000-0000-0000-000000000003', 925001, 925001);

insert into public.attempt_history (student_id, question_id, is_correct, earned_points)
values
  ('25000000-0000-0000-0000-000000000003', 925020, false, 0),
  ('25000000-0000-0000-0000-000000000003', 925031, false, 0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$select public.set_teacher_topic_archived(925001, true)$$,
  'the owning teacher can archive a topic'
);

select is((select active from public.subject_topics where id = 925001), false, 'archiving a topic marks only the topic inactive');

select ok(
  (select active from public.questions where id = 925001) is true
  and (select active from public.questions where id = 925002) is false,
  'archiving a topic preserves each question individual active state'
);

select is(
  (select count(*) from public.teacher_audit_logs where teacher_id = '25000000-0000-0000-0000-000000000001' and action = 'teacher.topic.archive' and target_id = '925001'),
  1::bigint,
  'topic archive is audited'
);

select lives_ok(
  $$select public.set_teacher_topic_archived(925001, false)$$,
  'the owning teacher can restore a topic'
);

select ok(
  (select active from public.subject_topics where id = 925001) is true
  and (select active from public.questions where id = 925002) is false,
  'restoring a topic does not reactivate an individually archived question'
);

select is(
  (select count(*) from public.teacher_audit_logs where teacher_id = '25000000-0000-0000-0000-000000000001' and action = 'teacher.topic.restore' and target_id = '925001'),
  1::bigint,
  'topic restore is audited'
);

select throws_ok(
  $$select public.set_teacher_topic_archived(925003, false)$$,
  'Topic not found or access denied',
  'a teacher cannot restore another teacher topic'
);

select throws_ok(
  $$select public.set_teacher_topic_archived(925002, false)$$,
  'No se puede restaurar el tema mientras el curso esté archivado o inactivo. Restaura primero el curso.',
  'a topic cannot be restored while its course is archived'
);

select lives_ok(
  $$select public.set_teacher_question_archived(925001, true)$$,
  'the owning teacher can archive a question'
);

select is((select active from public.questions where id = 925001), false, 'question archive marks the question inactive');

select is(
  (select count(*) from public.teacher_audit_logs where action = 'teacher.question.archive' and target_id = '925001'),
  1::bigint,
  'question archive is audited'
);

select lives_ok(
  $$select public.set_teacher_question_archived(925001, false)$$,
  'an archived question can be restored when its parents are active'
);

select is((select active from public.questions where id = 925001), true, 'question restore reactivates the question');

select lives_ok($$select public.set_teacher_question_archived(925001, true)$$, 'the question can be archived again before testing its parent state');
select lives_ok($$select public.set_teacher_topic_archived(925001, true)$$, 'the parent topic can be archived while preserving question state');

select throws_ok(
  $$select public.set_teacher_question_archived(925001, false)$$,
  'No se puede restaurar la pregunta porque su tema está archivado. Restaura primero el tema.',
  'a question cannot be restored while its topic is archived'
);

select lives_ok($$select public.set_teacher_topic_archived(925040, true)$$, 'an active topic with an active question can be archived without mutating the question');

select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000003', true);

select is(
  jsonb_array_length(public.get_safe_game_questions(925001, 925001, 925040, false, 1, false)),
  0,
  'an archived topic returns no playable question payload even when its child question remains active'
);

select ok(
  not exists (
    select 1 from jsonb_array_elements(public.get_student_question_catalog(925001, 925001)) item
    where (item->>'id')::bigint = 925040
  ),
  'the student catalog excludes an active question whose parent topic is archived'
);

select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.set_teacher_topic_archived(925001, false)$$, 'the topic can be restored before continuing lifecycle operations');
select lives_ok($$select public.set_teacher_question_archived(925001, false)$$, 'the question can be restored after its topic is restored');

select lives_ok($$select public.set_teacher_question_archived(925030, true)$$, 'an unused question can be archived before permanent deletion');
select lives_ok($$select public.delete_teacher_question(925030)$$, 'an archived question without academic history can be deleted permanently');

select ok(
  not exists (select 1 from public.questions where id = 925030)
  and not exists (select 1 from public.answers where question_id = 925030),
  'safe question deletion removes the question and definition answers'
);

select lives_ok($$select public.set_teacher_question_archived(925031, true)$$, 'a used question can still be archived');
select throws_ok(
  $$select public.delete_teacher_question(925031)$$,
  'Esta pregunta no se puede eliminar porque ya ha sido utilizada por alumnos y forma parte de su historial. Puedes mantenerla archivada para impedir que vuelva a utilizarse.',
  'a question with academic history cannot be deleted permanently'
);

select ok(
  exists (select 1 from public.questions where id = 925031)
  and exists (select 1 from public.attempt_history where question_id = 925031),
  'failed permanent deletion preserves both the question and its academic history'
);

select lives_ok($$select public.set_teacher_topic_archived(925010, true)$$, 'an unused topic can be archived before permanent deletion');
select lives_ok($$select public.delete_teacher_topic(925010)$$, 'an archived topic without academic history can be deleted atomically');

select ok(
  not exists (select 1 from public.subject_topics where id = 925010)
  and not exists (select 1 from public.questions where id = 925010),
  'safe topic deletion removes its questions instead of leaving them orphaned'
);

select lives_ok($$select public.set_teacher_topic_archived(925020, true)$$, 'a topic with historical attempts can still be archived');
select throws_ok(
  $$select public.delete_teacher_topic(925020)$$,
  'Este tema no se puede eliminar porque contiene preguntas o progreso que ya forman parte del historial del alumnado. Para conservar su historial debe permanecer archivado.',
  'a topic with academic history cannot be deleted permanently'
);

select ok(
  exists (select 1 from public.subject_topics where id = 925020)
  and exists (select 1 from public.questions where id = 925020)
  and exists (select 1 from public.attempt_history where question_id = 925020),
  'failed topic deletion is atomic and preserves topic, questions and academic history'
);

select is(
  (select count(*) from public.teacher_audit_logs where action = 'teacher.question.delete' and target_id = '925030')
  + (select count(*) from public.teacher_audit_logs where action = 'teacher.topic.delete' and target_id = '925010'),
  2::bigint,
  'successful permanent deletions are audited before their targets disappear'
);

select * from finish();
rollback;

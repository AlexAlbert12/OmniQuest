begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(42);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('26000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Review Teacher","role_id":"teacher"}', now(), now()),
  ('26000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review.student@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Review Student","role_id":"student"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility, points)
values
  ('26000000-0000-0000-0000-000000000001', 'Review Teacher', 'review.teacher@omniquest.test', 'teacher', true, 'private', 0),
  ('26000000-0000-0000-0000-000000000002', 'Review Student', 'review.student@omniquest.test', 'student', true, 'private', 0)
on conflict (id) do update
set alias = excluded.alias, email = excluded.email, role_id = excluded.role_id, active = excluded.active, points = excluded.points;

insert into public.subjects (id, teacher_id, name, code, active, is_archived)
values (926001, '26000000-0000-0000-0000-000000000001', 'Curso revisión abierta', 'REV926', true, false);

insert into public.classrooms (id, subject_id, name, code, active)
values (926001, 926001, 'Clase revisión', 'CLR926', true);

insert into public.subject_topics (id, subject_id, classroom_id, title, active)
values (926001, 926001, 926001, 'Tema revisión', true);

insert into public.questions (
  id, subject_id, classroom_id, topic_id, type, text, points_base, time_limit_seconds, difficulty, active
)
values
  (926001, 926001, 926001, 926001, 'multiple_choice', 'Pregunta automática correcta', 10, 30, 1, true),
  (926002, 926001, 926001, 926001, 'open_answer', 'Pregunta abierta pendiente', 20, 60, 1, true);

insert into public.answers (id, question_id, text, is_correct, sort_order)
values
  (926001, 926001, 'Correcta', true, 1),
  (926002, 926001, 'Incorrecta', false, 2);

insert into public.enrollments (student_id, subject_id, classroom_id)
values ('26000000-0000-0000-0000-000000000002', 926001, 926001);

insert into public.game_attempts (
  id, student_id, subject_id, classroom_id, topic_id, status, total_score, correct_answers, started_at, updated_at, finished_at
)
values (
  '26000000-0000-0000-0000-000000000010',
  '26000000-0000-0000-0000-000000000002',
  926001, 926001, 926001, 'finished', 10, 1,
  now() - interval '5 minutes', now(), now() - interval '1 minute'
);

insert into public.attempt_history (
  id, student_id, question_id, answer_id, is_correct, time_taken_seconds, attempted_at,
  submitted_answer_text, earned_points, hint_used, was_skipped, attempt_id, manual_review_status
)
values
  (926001, '26000000-0000-0000-0000-000000000002', 926001, 926001, true, 12, now() - interval '4 minutes', null, 10, false, false, '26000000-0000-0000-0000-000000000010', 'not_required'),
  (926002, '26000000-0000-0000-0000-000000000002', 926002, null, false, 25, now() - interval '3 minutes', 'Mi respuesta abierta', 0, false, false, '26000000-0000-0000-0000-000000000010', 'pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((public.get_student_progress_summary()->>'totalAttempts')::integer, 2, 'progress still counts both submitted answers as attempts');
select is((public.get_student_progress_summary()->>'evaluatedAttempts')::integer, 1, 'pending open answer is excluded from evaluated attempts');
select is((public.get_student_progress_summary()->>'pendingReviewAttempts')::integer, 1, 'pending open answer is counted separately');
select is((public.get_student_progress_summary()->>'correctAttempts')::integer, 1, 'pending answer does not increase correct attempts');
select is((public.get_student_progress_summary()->>'accuracyPercent')::integer, 100, 'pending answer does not reduce student accuracy');
select is((public.get_student_progress_summary()->'subjects'->0->>'failedQuestions')::integer, 0, 'pending open answer is not a failed question');
select is((public.get_student_progress_summary()->'subjects'->0->>'pendingReviewQuestions')::integer, 1, 'pending question is exposed separately in subject progress');

select is((public.get_student_attempt_history_page('incorrect', null, 926001, 926001, 926001, 1, 20, 0)->>'total')::integer, 0, 'pending answer is not returned by the incorrect activity filter');
select is((public.get_student_attempt_history_page('pending', null, 926001, 926001, 926001, 1, 20, 0)->>'total')::integer, 1, 'pending answer is returned by the pending activity filter');

select is((public.get_game_attempt_review_index('26000000-0000-0000-0000-000000000010', null, null, null, false, null)->>'evaluated_total')::integer, 1, 'game review counts only evaluated answers');
select is((public.get_game_attempt_review_index('26000000-0000-0000-0000-000000000010', null, null, null, false, null)->>'pending_total')::integer, 1, 'game review exposes pending answers');
select is((public.get_game_attempt_review_index('26000000-0000-0000-0000-000000000010', null, null, null, false, null)->>'incorrect_total')::integer, 0, 'game review does not report pending as incorrect');
select is(jsonb_array_length(public.get_game_attempt_review_index('26000000-0000-0000-0000-000000000010', null, null, null, false, null)->'failed_attempt_history_ids'), 0, 'pending answer is excluded from failed review IDs');

select is((public.get_student_recent_game_attempts(5)->0->>'pendingTotal')::integer, 1, 'recent game card exposes one pending review');
select is((public.get_student_recent_game_attempts(5)->0->>'evaluatedTotal')::integer, 1, 'recent game card exposes evaluated answer count');
select ok(not (public.get_student_recent_game_attempts(5)->0 ? 'sort_at'), 'recent game payload does not leak its internal sort key');

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);

select is((public.get_teacher_question_report(926002, 926001, null, null)->'summary'->>'evaluatedAttempts')::integer, 0, 'teacher question report excludes pending answer from evaluated attempts');
select is((public.get_teacher_question_report(926002, 926001, null, null)->'summary'->>'pendingAttempts')::integer, 1, 'teacher question report exposes pending answer separately');
select is((public.get_teacher_question_report(926002, 926001, null, null)->'summary'->>'failedAttempts')::integer, 0, 'teacher question report does not count pending answer as failure');
select is((public.get_teacher_question_affected_students_page(926002, 926001, null, null, 20, 0)->>'total')::integer, 0, 'pending answer does not place the student in affected failures');

select lives_ok($$select public.review_manual_review_attempt(926002, 'approved', null, 'student')$$, 'teacher can approve a pending open answer');
select ok((select is_correct and earned_points = 20 and manual_review_status = 'approved' from public.attempt_history where id = 926002), 'approval makes the attempt correct and grants its base XP');
reset role;
select ok((select total_score = 30 and correct_answers = 2 from public.game_attempts where id = '26000000-0000-0000-0000-000000000010'), 'approval updates the original game attempt totals');
set local role authenticated;
select lives_ok($$select public.review_manual_review_attempt(926002, 'approved', null, 'student')$$, 'saving the same approval again is idempotent');
reset role;
select ok((select total_score = 30 and correct_answers = 2 from public.game_attempts where id = '26000000-0000-0000-0000-000000000010'), 'repeated approval does not duplicate XP or correct answers');
select is((select count(*) from public.notifications where user_id = '26000000-0000-0000-0000-000000000002' and type = 'manual_review' and fingerprint = 'manual-review-status:926002:approved'), 1::bigint, 'approval status notification is emitted once');
set local role authenticated;

select lives_ok($$select public.review_manual_review_attempt(926002, 'needs_changes', 'Revisa el razonamiento.', 'student')$$, 'teacher can request changes after approval and scores are recalculated');
select ok((select not is_correct and earned_points = 0 and manual_review_status = 'needs_changes' from public.attempt_history where id = 926002), 'needs changes becomes unresolved with no awarded XP');

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000002', true);
select is((public.get_student_progress_summary()->>'evaluatedAttempts')::integer, 1, 'needs changes is excluded from evaluated progress like pending');
select is((public.get_student_progress_summary()->>'accuracyPercent')::integer, 100, 'needs changes does not reduce accuracy before a final decision');

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.review_manual_review_attempt(926002, 'rejected', 'La respuesta no es correcta.', 'student')$$, 'teacher can make a final rejected decision after needs changes');
select ok((select not is_correct and earned_points = 0 and manual_review_status = 'rejected' from public.attempt_history where id = 926002), 'rejection is a definitive incorrect answer with zero XP');
reset role;
select ok((select total_score = 10 and correct_answers = 1 from public.game_attempts where id = '26000000-0000-0000-0000-000000000010'), 'rejection keeps the previously granted approval XP removed from the game');
select is((select count(*) from public.notifications where user_id = '26000000-0000-0000-0000-000000000002' and type = 'manual_review' and fingerprint = 'manual-review-status:926002:rejected'), 1::bigint, 'rejection creates its manual-review status notification');
set local role authenticated;

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000002', true);
select is((public.get_student_progress_summary()->>'evaluatedAttempts')::integer, 2, 'rejected answer becomes evaluated student progress');
select is((public.get_student_progress_summary()->>'correctAttempts')::integer, 1, 'rejected answer does not increase correct attempts');
select is((public.get_student_progress_summary()->>'accuracyPercent')::integer, 50, 'rejected answer now participates in accuracy as incorrect');
select is((public.get_student_progress_summary()->'subjects'->0->>'failedQuestions')::integer, 1, 'rejected open answer becomes a failed question');
select ok((public.get_student_recent_game_attempts(5)->0->>'pendingTotal')::integer = 0 and (public.get_student_recent_game_attempts(5)->0->>'incorrectTotal')::integer = 1, 'recent game moves the review from pending to incorrect after rejection');
select is(jsonb_array_length(public.get_safe_game_questions(926001, 926001, 926001, false, 1, true)), 1, 'review-failed mode includes the definitively rejected open answer');

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);
select is((public.get_teacher_question_report(926002, 926001, null, null)->'summary'->>'failedAttempts')::integer, 1, 'teacher question report counts a rejected answer as a failure');
select is((public.get_teacher_question_affected_students_page(926002, 926001, null, null, 20, 0)->>'total')::integer, 1, 'rejected answer places the student in affected failures');

select * from finish();
rollback;

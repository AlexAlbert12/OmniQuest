begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select ok(
  position($needle$manual_review_status <> 'pending'$needle$ in pg_get_functiondef('public.get_teacher_student_history_summary(uuid,bigint,bigint,integer)'::regprocedure)) > 0
  and position($needle$'evaluatedAttempts'$needle$ in pg_get_functiondef('public.get_teacher_student_history_summary(uuid,bigint,bigint,integer)'::regprocedure)) > 0,
  'history summary calculates accuracy only from evaluated answers'
);

select ok(
  position($needle$manual_review_status = 'pending'$needle$ in pg_get_functiondef('public.get_teacher_student_history_summary(uuid,bigint,bigint,integer)'::regprocedure)) > 0
  and position($needle$'pendingEvaluation'$needle$ in pg_get_functiondef('public.get_teacher_student_history_summary(uuid,bigint,bigint,integer)'::regprocedure)) > 0,
  'history summary exposes pending evaluation separately'
);

select ok(
  position($needle$manual_review_status, 'not_required') <> 'pending'$needle$ in pg_get_functiondef('public.get_teacher_student_history_weaknesses(uuid,bigint,bigint,integer)'::regprocedure)) > 0,
  'reinforcement diagnostics exclude answers awaiting teacher review'
);

select ok(
  position($needle$'evaluated'$needle$ in pg_get_functiondef('public.get_teacher_student_history_metrics(uuid,bigint,bigint,integer)'::regprocedure)) > 0
  and position($needle$'pending'$needle$ in pg_get_functiondef('public.get_teacher_student_history_metrics(uuid,bigint,bigint,integer)'::regprocedure)) > 0,
  'history metrics preserve total activity while separating evaluated and pending answers'
);

select ok(
  position($needle$'subjectId', (select subject_id from weak_topic)$needle$ in pg_get_functiondef('public.get_teacher_student_history_summary(uuid,bigint,bigint,integer)'::regprocedure)) > 0
  and position($needle$'classroomId', (select classroom_id from weak_topic)$needle$ in pg_get_functiondef('public.get_teacher_student_history_summary(uuid,bigint,bigint,integer)'::regprocedure)) > 0,
  'practice recommendation carries its exact course and classroom context'
);

select ok(
  to_regprocedure('public.get_teacher_manual_review_queue(bigint,bigint,text,text,uuid,bigint,integer,integer)') is not null
  and position('p_student_id is null or ah.student_id = p_student_id' in pg_get_functiondef('public.get_teacher_manual_review_queue(bigint,bigint,text,text,uuid,bigint,integer,integer)'::regprocedure)) > 0
  and position('p_attempt_id is null or ah.id = p_attempt_id' in pg_get_functiondef('public.get_teacher_manual_review_queue(bigint,bigint,text,text,uuid,bigint,integer,integer)'::regprocedure)) > 0,
  'manual review queue supports exact student and attempt context'
);

select ok(
  has_function_privilege('authenticated', 'public.get_teacher_manual_review_queue(bigint,bigint,text,text,uuid,bigint,integer,integer)', 'EXECUTE'),
  'authenticated reviewers retain execute access to the contextual review queue'
);

select * from finish();
rollback;

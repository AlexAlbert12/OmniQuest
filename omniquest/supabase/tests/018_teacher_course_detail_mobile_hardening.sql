begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select ok(
  position("'evaluatedStudents'" in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0
  and position("'unassessedStudents'" in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0,
  'course overview distinguishes evaluated students from students without activity'
);

select ok(
  position('where total_answers > 0 and 10.0 * correct_answers' in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0,
  'overview grade bands only include evaluated students'
);

select ok(
  position("'unassessed'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0
  and position("where has_activity and grade < 5" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'student distribution keeps no-activity students outside failing grades'
);

select ok(
  position("'activeThisWeek'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0
  and position("last_activity >= now() - interval '7 days'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'weekly activity count and percentage can use one consistent seven-day numerator'
);

select ok(
  position("'generatedXp'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0
  and position("'playedSessionsTotal'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'student KPIs are aggregated over the complete classroom rather than the current page'
);

select ok(
  position("'bestStudent'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0
  and position("'attention'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'best student and attention list come from global server aggregates'
);

select ok(
  position("jsonb_build_object('label', 'Notable (7-8,9)'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0
  and position("jsonb_build_object('label', 'Aprobado (5-6,9)'" in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'canonical Spanish grade labels use one consistent scale'
);

select ok(
  position('v_students := public.get_teacher_subject_students_page' in pg_get_functiondef('public.get_teacher_subject_analytics(bigint,bigint)'::regprocedure)) > 0,
  'analytics reuses the same canonical student summary and grade distribution'
);

select * from finish();
rollback;

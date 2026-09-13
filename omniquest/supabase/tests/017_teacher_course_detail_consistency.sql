begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

select ok(
  position('Notable (7-8,9)' in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0
  and position('Aprobado (5-6,9)' in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0
  and position('Suspenso (<5)' in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0,
  'course overview uses the canonical Spanish grade bands'
);

select ok(
  position('total_answers > 0 and 10.0 * correct_answers' in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0,
  'course overview excludes unevaluated students from grade bands'
);

select ok(
  position($needle$'activeThisWeek'$needle$ in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0
  and position($needle$interval '7 days'$needle$ in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'student summary exposes a real seven-day active count'
);

select ok(
  position('100.0 * sum(correct_answers) / sum(evaluated_answers)' in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'student analytics uses global answer accuracy instead of averaging individual percentages'
);

select ok(
  position('where evaluated_answers > 0 and grade < 5' in pg_get_functiondef('public.get_teacher_subject_students_page(bigint,bigint,text,text,text,integer,integer)'::regprocedure)) > 0,
  'students without answers are not classified as failed grades'
);

select ok(
  position('left join public.subject_scores ss' in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0
  and position('from selected_enrollments e' in pg_get_functiondef('public.get_teacher_subject_overview(bigint,bigint)'::regprocedure)) > 0,
  'overview XP average uses the enrolled population as its denominator'
);

select * from finish();
rollback;

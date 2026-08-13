begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select ok(
  position('role_id' in pg_get_functiondef('public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure)) > 0
  and position($needle$not in ('teacher', 'admin')$needle$ in pg_get_functiondef('public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure)) > 0,
  'question save requires an active teacher or admin profile'
);

select ok(
  position($needle$p_type not in ('multiple_choice', 'true_false', 'open_answer', 'fill_blank', 'ordering', 'match_pairs', 'drag_drop')$needle$ in pg_get_functiondef('public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure)) > 0,
  'question save validates the server-side type whitelist'
);

select ok(
  position('Las imágenes necesitan texto alternativo' in pg_get_functiondef('public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure)) > 0,
  'image alternative text is a server-side invariant'
);

select ok(
  position('v_correct_count <> 1' in pg_get_functiondef('public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure)) > 0
  and position($needle$p_type = 'multiple_choice'$needle$ in pg_get_functiondef('public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure)) > 0,
  'choice questions require exactly one correct answer'
);

select ok(
  position('v_answer_count <> v_blank_count' in pg_get_functiondef('public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure)) > 0,
  'fill-blank questions require one solution for every marker'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'questions_type_check' and conrelid = 'public.questions'::regclass),
  'questions table has a type integrity constraint'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'questions_text_length_check' and conrelid = 'public.questions'::regclass)
  and exists (select 1 from pg_constraint where conname = 'questions_explanation_length_check' and conrelid = 'public.questions'::regclass),
  'question authoring text has database length boundaries'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'answers_text_length_check' and conrelid = 'public.answers'::regclass),
  'answer text has a database length boundary'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select has_column('public', 'questions', 'hint', 'questions exposes the optional hint column');
select ok(has_function_privilege('authenticated', 'public.get_safe_game_questions_v2(bigint,bigint,bigint,boolean,integer,boolean)', 'EXECUTE'), 'students can execute the safe game RPC with hints');
select ok(has_function_privilege('authenticated', 'public.save_teacher_question_v2(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,text,jsonb,text,text,text,text,text,numeric,text,text)', 'EXECUTE'), 'authenticated teachers can execute the question save RPC with hints');

select ok(
  not exists (select 1 from public.subjects where icon in ('📚','🎓','🧮','🌐','🧪','🎨','🔤','🧲')),
  'legacy course emoji presets are migrated to standard icons'
);

select ok(
  not exists (select 1 from public.subject_topics where icon in ('📘','🧠','🧮','🔬','🌍','✍️','🎯','⚡')),
  'legacy topic emoji presets are migrated to standard icons'
);

select ok(
  exists (select 1 from information_schema.table_constraints where table_schema = 'public' and table_name = 'questions' and constraint_name = 'questions_hint_length_check'),
  'question hints have a bounded length'
);

select ok(
  position('book-outline' in pg_get_functiondef('public.create_subject_with_default_topic(text,text,text,text,text,text,text,text)'::regprocedure)) > 0
  and position('📘' in pg_get_functiondef('public.create_subject_with_default_topic(text,text,text,text,text,text,text,text)'::regprocedure)) = 0,
  'new courses create their default topic with a standard application icon'
);

select * from finish();
rollback;

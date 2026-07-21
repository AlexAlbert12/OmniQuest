begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(33);

-- Teacher planning and task completion.
select ok(to_regclass('public.learning_tasks') is not null, 'learning tasks table exists');
select ok(to_regclass('public.learning_task_completions') is not null, 'learning task completions table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.learning_tasks'::regclass), 'learning tasks have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.learning_task_completions'::regclass), 'learning task completions have RLS');
select ok(to_regprocedure('public.save_learning_task(bigint,bigint,bigint,bigint,text,text,timestamp with time zone,timestamp with time zone,text,text)') is not null, 'save learning task RPC exists');
select ok(to_regprocedure('public.delete_learning_task(bigint)') is not null, 'delete learning task RPC exists');
select ok(to_regprocedure('public.get_teacher_learning_tasks_page(bigint,bigint,text,text,timestamp with time zone,timestamp with time zone,integer,integer)') is not null, 'teacher task page RPC exists');
select ok(to_regprocedure('public.get_student_learning_tasks_page(text,text,integer,integer)') is not null, 'student task page RPC exists');
select ok(to_regprocedure('public.set_learning_task_completed(bigint,boolean)') is not null, 'task completion RPC exists');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_tasks' and policyname = 'learning_tasks_select_visible'), 'task visibility policy exists');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_task_completions' and policyname = 'learning_task_completions_insert_self'), 'students may only complete available tasks');

-- Advanced manual review.
select ok(to_regclass('public.manual_review_comments') is not null, 'manual review comments table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.manual_review_comments'::regclass), 'manual review comments have RLS');
select ok(to_regprocedure('public.get_teacher_manual_review_queue(bigint,bigint,text,text,integer,integer)') is not null, 'manual review queue RPC exists');
select ok(to_regprocedure('public.get_manual_review_thread(bigint)') is not null, 'manual review thread RPC exists');
select ok(to_regprocedure('public.claim_open_answer_attempt(bigint)') is not null, 'manual review claim RPC exists');
select ok(to_regprocedure('public.add_manual_review_comment(bigint,text,text)') is not null, 'manual review comment RPC exists');
select ok(to_regprocedure('public.review_open_answer_attempt_v2(bigint,text,text,text)') is not null, 'advanced review decision RPC exists');
select ok(to_regprocedure('public.get_activity_attempt_detail(bigint)') is not null, 'student activity detail exposes safe review feedback');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'manual_review_comments' and policyname = 'manual_review_comments_select_visible'), 'manual review comments visibility policy exists');
select ok(exists(select 1 from information_schema.check_constraints where constraint_name = 'attempt_history_manual_review_status_check' and check_clause like '%needs_changes%'), 'manual review statuses include needs_changes');

-- Rich media.
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_type'), 'question media type column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_url'), 'question media URL column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_path'), 'question media path column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_alt_text'), 'question media alternative text column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_caption'), 'question media caption column exists');
select ok(exists(select 1 from storage.buckets where id = 'question-media' and public), 'public question media bucket exists');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'question_media_insert_owner'), 'question media insert policy exists');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'question_media_delete_owner'), 'question media delete policy exists');
select ok(to_regprocedure('public.save_teacher_question(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,jsonb,text,text,text,text,text)') is not null, 'teacher question RPC accepts media metadata');
select ok(to_regprocedure('public.get_safe_game_questions(bigint,bigint,bigint,boolean,integer,boolean)') is not null, 'safe game questions RPC still exists');
select ok(has_function_privilege('authenticated', 'public.get_safe_game_questions(bigint,bigint,bigint,boolean,integer,boolean)', 'EXECUTE'), 'students can fetch safe rich-media questions');
select ok(not has_function_privilege('anon', 'public.save_learning_task(bigint,bigint,bigint,bigint,text,text,timestamp with time zone,timestamp with time zone,text,text)', 'EXECUTE'), 'anonymous users cannot create tasks');

select * from finish();
rollback;

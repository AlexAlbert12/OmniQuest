begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(37);

-- Standalone tasks were intentionally removed. Topic deadlines remain available.
select ok(to_regclass('public.learning_tasks') is null, 'standalone learning tasks table was removed');
select ok(to_regclass('public.learning_task_completions') is null, 'task completions table was removed');
select ok(to_regprocedure('public.save_learning_task(bigint,bigint,bigint,bigint,text,text,timestamp with time zone,timestamp with time zone,text,text)') is null, 'task save RPC was removed');
select ok(to_regprocedure('public.get_student_learning_tasks_page(text,text,integer,integer)') is null, 'student tasks RPC was removed');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subject_topics' and column_name = 'available_until'), 'topic deadline remains available');
select ok(to_regprocedure('public.assert_topic_playable(bigint)') is not null, 'topic deadline is enforced by the server');
select ok(not exists(select 1 from public.notifications where type = 'task' or related_table = 'learning_tasks'), 'obsolete task notifications were removed');

-- Advanced manual review.
select ok(to_regclass('public.manual_review_comments') is not null, 'manual review comments table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.manual_review_comments'::regclass), 'manual review comments have RLS');
select ok(to_regprocedure('public.get_teacher_manual_review_queue(bigint,bigint,text,text,uuid,bigint,integer,integer)') is not null, 'manual review queue RPC exists');
select ok(to_regprocedure('public.get_manual_review_thread(bigint)') is not null, 'manual review thread RPC exists');
select ok(to_regprocedure('public.claim_open_answer_attempt(bigint)') is null, 'manual review claim RPC was removed');
select ok(to_regprocedure('public.add_manual_review_comment(bigint,text,text)') is not null, 'manual review comment RPC exists');
select ok(to_regprocedure('public.review_manual_review_attempt(bigint,text,text,text)') is not null, 'owner-only manual review decision RPC exists');
select ok(to_regprocedure('public.get_activity_attempt_detail(bigint)') is not null, 'student activity detail exposes safe review feedback');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'manual_review_comments' and policyname = 'manual_review_comments_select_visible'), 'manual review comments visibility policy exists');
select ok(exists(select 1 from information_schema.check_constraints where constraint_name = 'attempt_history_manual_review_status_check' and check_clause like '%needs_changes%'), 'manual review statuses include needs_changes');
select ok(to_regclass('public.manual_review_rubrics') is null, 'manual review rubrics were removed');
select ok(to_regclass('public.manual_review_saved_filters') is null, 'manual review saved filters were removed');
select ok(to_regprocedure('public.assign_manual_review_attempts(bigint[],uuid)') is null, 'manual review assignment RPC was removed');
select ok(to_regprocedure('public.save_manual_review_rubric(uuid,text,bigint,jsonb)') is null, 'manual review rubric RPC was removed');
select ok(to_regprocedure('public.save_manual_review_filter(uuid,text,jsonb)') is null, 'manual review saved-filter RPC was removed');
select ok(to_regprocedure('public.review_open_answer_attempt(bigint,boolean,text)') is null, 'legacy direct manual review RPC was removed');
select ok(to_regprocedure('public.batch_review_manual_attempts(bigint[],text,text,text)') is not null, 'owner-only batch review RPC exists');
select ok(not exists(select 1 from information_schema.check_constraints where constraint_name = 'attempt_history_manual_review_status_check' and check_clause like '%in_review%'), 'manual review status no longer includes in_review');
select ok(not exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'attempt_history' and column_name in ('manual_review_assigned_to', 'manual_review_started_at', 'manual_review_rubric_id', 'manual_review_rubric_result')), 'obsolete assignment and rubric columns were removed');

-- Rich media.
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_type'), 'question media type column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_url'), 'question media URL column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_path'), 'question media path column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_alt_text'), 'question media alternative text column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'media_caption'), 'question media caption column exists');
select ok(exists(select 1 from storage.buckets where id = 'question-media' and not public), 'private question media bucket exists');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'question_media_insert_owner'), 'question media insert policy exists');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'question_media_delete_owner'), 'question media delete policy exists');
select ok(to_regprocedure('public.save_teacher_question(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,jsonb,text,text,text,text,text,numeric,text,text)') is not null, 'teacher question RPC accepts private media and accessibility metadata');
select ok(to_regprocedure('public.get_safe_game_questions(bigint,bigint,bigint,boolean,integer,boolean)') is not null, 'safe game questions RPC still exists');
select ok(has_function_privilege('authenticated', 'public.get_safe_game_questions(bigint,bigint,bigint,boolean,integer,boolean)', 'EXECUTE'), 'students can fetch safe rich-media questions');

select * from finish();
rollback;

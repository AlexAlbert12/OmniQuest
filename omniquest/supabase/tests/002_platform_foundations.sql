begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select ok(to_regclass('public.push_tokens') is not null, 'push token registry exists');
select ok((select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass), 'push token registry has RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.push_tokens', 'INSERT'), 'authenticated users cannot bypass the token registration RPC');
select ok(not has_table_privilege('authenticated', 'public.push_tokens', 'SELECT'), 'authenticated users cannot read complete push tokens directly');
select ok(to_regprocedure('public.register_push_token(text,text,text,text)') is not null, 'push registration RPC exists');
select ok(to_regprocedure('public.deactivate_push_token(text)') is not null, 'push deactivation RPC exists');
select ok(has_function_privilege('authenticated', 'public.register_push_token(text,text,text,text)', 'EXECUTE'), 'authenticated users may register their device');
select ok(not has_function_privilege('anon', 'public.register_push_token(text,text,text,text)', 'EXECUTE'), 'anonymous users cannot register push tokens');

select ok(to_regclass('public.game_answer_submission_receipts') is not null, 'idempotent answer receipt table exists');
select ok(not has_table_privilege('authenticated', 'public.game_answer_submission_receipts', 'SELECT'), 'answer receipts are not directly readable');
select ok(to_regprocedure('public.submit_answer_resumable(uuid,bigint,bigint,text,jsonb,integer,boolean,boolean,uuid)') is not null, 'resumable submission RPC exists');
select ok(has_function_privilege('authenticated', 'public.submit_answer_resumable(uuid,bigint,bigint,text,jsonb,integer,boolean,boolean,uuid)', 'EXECUTE'), 'students may use resumable submission');

select ok(to_regprocedure('public.get_admin_audit_logs_page_secured(text,uuid,text,text,text,timestamptz,timestamptz,text,integer,integer)') is not null, 'secured admin audit pagination RPC exists');
select ok(to_regprocedure('public.get_teacher_audit_logs_page(text,text,integer,integer)') is not null, 'teacher audit pagination RPC exists');
select ok(to_regprocedure('public.get_ranking_profiles_page(text,bigint,integer,integer,integer,integer)') is not null, 'ranking pagination RPC exists');
select ok(to_regprocedure('public.get_student_attempt_history_page(text,text,bigint,bigint,bigint,integer,integer,integer)') is not null, 'student activity pagination RPC exists');
select ok(to_regprocedure('public.get_teacher_student_attempts_page(uuid,bigint,bigint,integer,integer)') is not null, 'teacher student-history pagination RPC exists');

select * from finish();
rollback;

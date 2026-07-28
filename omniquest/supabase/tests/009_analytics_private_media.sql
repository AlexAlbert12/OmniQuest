begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_preferences' and column_name = 'analytics_enabled'), 'analytics consent preference exists');
select ok(to_regclass('public.analytics_reporting_identities') is not null, 'pseudonymous analytics identities exist');
select ok((select relrowsecurity from pg_class where oid = 'public.analytics_reporting_identities'::regclass), 'analytics identities have RLS');
select ok(to_regclass('public.analytics_retention_policy') is not null, 'analytics retention policy exists');
select ok(to_regprocedure('public.set_analytics_consent(boolean)') is not null, 'analytics consent RPC exists');
select ok(to_regprocedure('public.apply_analytics_retention()') is not null, 'analytics retention RPC exists');
select ok(not has_table_privilege('authenticated', 'public.analytics_events', 'SELECT'), 'authenticated users cannot read raw analytics');
select ok(exists(select 1 from pg_indexes where schemaname = 'public' and tablename = 'analytics_events' and indexname = 'analytics_events_occurred_at_brin_idx'), 'analytics date BRIN index exists');
select ok(exists(select 1 from pg_trigger where tgname = 'log_course_join_analytics' and not tgisinternal), 'course join analytics trigger exists');
select ok(exists(select 1 from pg_trigger where tgname = 'log_question_type_analytics' and not tgisinternal), 'question type analytics trigger exists');

select ok(exists(select 1 from storage.buckets where id = 'question-media' and not public), 'question media bucket is private');
select ok(to_regclass('public.question_media_assets') is not null, 'question media asset lifecycle table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.question_media_assets'::regclass), 'question media assets have RLS');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'question_media_select_authorized' and cmd = 'SELECT'), 'authorized private media select policy exists');
select ok(to_regprocedure('public.can_access_question_media(bigint,bigint)') is not null, 'question media authorization helper exists');
select ok(to_regprocedure('public.get_question_media_manifest(bigint[])') is not null, 'authorized media manifest RPC exists');
select ok(exists(select 1 from pg_trigger where tgname = 'mark_question_media_orphaned_delete' and not tgisinternal), 'question deletion marks media orphaned');
select ok(not exists(select 1 from public.questions where media_path is not null and media_url is not null), 'stored question media no longer keeps public URLs');

select * from finish();
rollback;

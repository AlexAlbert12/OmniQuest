begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

select ok(to_regclass('public.analytics_events') is not null, 'analytics event table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.analytics_events'::regclass), 'analytics event table has RLS');
select ok(to_regprocedure('public.track_usage_event(text,jsonb,bigint,bigint,bigint,uuid,text)') is not null, 'usage event RPC exists');
select ok(to_regprocedure('public.get_admin_usage_analytics(integer)') is not null, 'admin usage analytics RPC exists');
select ok(has_function_privilege('authenticated', 'public.track_usage_event(text,jsonb,bigint,bigint,bigint,uuid,text)', 'EXECUTE'), 'authenticated users can send allowed analytics events');
select ok(not has_function_privilege('anon', 'public.track_usage_event(text,jsonb,bigint,bigint,bigint,uuid,text)', 'EXECUTE'), 'anonymous users cannot send analytics events');

select ok(to_regprocedure('public.get_admin_support_tickets_page_secured(text,text,text,text,uuid,text,text,integer,integer)') is not null, 'secured admin support pagination RPC exists');
select ok(to_regprocedure('public.admin_update_support_ticket_secured(bigint,text,text,text,text,uuid,text[],bigint)') is not null, 'secured admin support update RPC exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_support_tickets' and column_name = 'admin_response'), 'support response column exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_support_tickets' and column_name = 'assigned_admin_id'), 'support assignment column exists');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'user_support_tickets' and policyname = 'user_support_tickets_select_self' and cmd = 'SELECT'), 'users may read their own support tickets');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'user_support_tickets' and policyname = 'user_support_tickets_insert_self' and cmd = 'INSERT'), 'users may create their own support tickets');
select ok(not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'user_support_tickets' and policyname = 'user_support_tickets_self'), 'old all-operations support policy is removed');
select ok(not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'user_support_tickets' and cmd in ('UPDATE', 'DELETE') and policyname like 'user_support_tickets%self%'), 'users cannot update or delete tickets directly');

select ok(to_regprocedure('public.search_app_entities(text,integer,integer)') is not null, 'role-aware paginated global search RPC exists');
select ok(has_function_privilege('authenticated', 'public.search_app_entities(text,integer,integer)', 'EXECUTE'), 'authenticated teachers and admins may call global search');
select ok(not has_function_privilege('anon', 'public.search_app_entities(text,integer,integer)', 'EXECUTE'), 'anonymous users cannot call global search');
select ok(exists(select 1 from pg_trigger where tgname = 'log_game_attempt_analytics_insert' and not tgisinternal), 'game start analytics trigger exists');
select ok(exists(select 1 from pg_trigger where tgname = 'log_game_attempt_analytics_status' and not tgisinternal), 'game status analytics trigger exists');
select ok(exists(select 1 from pg_trigger where tgname = 'log_badge_unlock_analytics' and not tgisinternal), 'badge analytics trigger exists');

select * from finish();
rollback;

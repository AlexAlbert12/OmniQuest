begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select ok(to_regprocedure('public.get_admin_push_delivery_page(text,text,text,text,timestamptz,timestamptz,integer,integer)') is not null, 'admin push page RPC exists');
select ok(to_regprocedure('public.get_admin_push_delivery_detail(bigint)') is not null, 'admin push detail RPC exists');
select ok(to_regprocedure('public.admin_retry_push_delivery(bigint)') is not null, 'admin push retry RPC exists');
select ok(to_regprocedure('public.admin_cancel_push_delivery(bigint)') is not null, 'admin push cancel RPC exists');
select ok(to_regprocedure('public.admin_request_push_delivery_processing(bigint)') is not null, 'admin process-now preparation RPC exists');
select ok(to_regprocedure('public.claim_notification_delivery_item(bigint,uuid)') is not null, 'service-only exact queue claim exists');
select ok(has_function_privilege('authenticated', 'public.get_admin_push_delivery_page(text,text,text,text,timestamptz,timestamptz,integer,integer)', 'EXECUTE'), 'authenticated callers may invoke the permission-checked page RPC');
select ok(has_function_privilege('authenticated', 'public.admin_retry_push_delivery(bigint)', 'EXECUTE'), 'authenticated callers may invoke the permission-checked retry RPC');
select ok(not has_function_privilege('authenticated', 'public.claim_notification_delivery_item(bigint,uuid)', 'EXECUTE'), 'authenticated clients cannot claim a push job directly');
select ok(has_function_privilege('service_role', 'public.claim_notification_delivery_item(bigint,uuid)', 'EXECUTE'), 'service worker can claim a selected push job');
select ok(not has_table_privilege('authenticated', 'public.notification_delivery_queue', 'SELECT'), 'clients cannot read the push queue directly');
select ok(not has_table_privilege('authenticated', 'public.notification_push_deliveries', 'SELECT'), 'clients cannot read push receipts directly');
select ok(not has_table_privilege('authenticated', 'public.push_tokens', 'SELECT'), 'clients cannot read complete Expo push tokens directly');

select * from finish();
rollback;

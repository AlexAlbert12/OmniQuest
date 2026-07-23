begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

select has_table('public', 'teacher_student_recovery_requests', 'teacher recovery audit table exists');
select has_table('public', 'notification_delivery_queue', 'notification delivery queue exists');
select has_table('public', 'notification_push_deliveries', 'per-device push delivery table exists');

select ok(
  to_regprocedure('public.reserve_teacher_student_recovery_request(uuid,uuid,bigint,bigint)') is not null,
  'rate-limited recovery reservation RPC exists'
);
select ok(
  to_regprocedure('public.claim_notification_delivery_batch(uuid,integer)') is not null,
  'queue claim RPC exists'
);
select ok(
  to_regprocedure('public.get_admin_push_delivery_metrics(integer)') is not null,
  'admin push delivery metrics RPC exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_teacher_student_recovery_request(uuid,uuid,bigint,bigint)',
    'EXECUTE'
  ),
  'authenticated clients cannot reserve recovery requests directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_teacher_student_recovery_request(uuid,uuid,bigint,bigint)',
    'EXECUTE'
  ),
  'service-role recovery function may reserve requests'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_notification_delivery_batch(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot claim push jobs'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_notification_delivery_batch(uuid,integer)',
    'EXECUTE'
  ),
  'service-role worker may claim push jobs'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_delivery_queue', 'SELECT'),
  'authenticated users cannot inspect the delivery queue'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_push_deliveries', 'SELECT'),
  'authenticated users cannot inspect device delivery receipts'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '80000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'push.queue.student@omniquest.test',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"alias":"Push Queue Student","role_id":"student"}',
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values (
  '80000000-0000-0000-0000-000000000001',
  'Push Queue Student',
  'push.queue.student@omniquest.test',
  'student',
  true,
  'private'
)
on conflict (id) do update
set alias = excluded.alias,
    email = excluded.email,
    role_id = excluded.role_id,
    active = excluded.active;

insert into public.notifications (
  user_id,
  audience,
  type,
  title,
  description,
  fingerprint,
  metadata
)
values (
  '80000000-0000-0000-0000-000000000001',
  'student',
  'announcement',
  'Prueba de cola',
  'Esta notificación debe quedar en la cola push.',
  'test:push-queue:insert',
  '{"preference_category":"system","push_priority":"high"}'::jsonb
)
on conflict (user_id, fingerprint) do update
set title = excluded.title,
    description = excluded.description,
    metadata = excluded.metadata,
    deleted_at = null,
    updated_at = now();

select ok(
  exists (
    select 1
    from public.notification_delivery_queue q
    join public.notifications n on n.id = q.notification_id
    where n.user_id = '80000000-0000-0000-0000-000000000001'
      and n.fingerprint = 'test:push-queue:insert'
      and q.status = 'pending'
      and q.priority = 'high'
  ),
  'persistent notification automatically creates a high-priority push job'
);

update public.notifications
set deleted_at = now()
where user_id = '80000000-0000-0000-0000-000000000001'
  and fingerprint = 'test:push-queue:insert';

select ok(
  exists (
    select 1
    from public.notification_delivery_queue q
    join public.notifications n on n.id = q.notification_id
    where n.user_id = '80000000-0000-0000-0000-000000000001'
      and n.fingerprint = 'test:push-queue:insert'
      and q.status = 'cancelled'
  ),
  'deleting a notification cancels any outstanding push job'
);

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'omniquest-notification-delivery'
  ),
  'minute-based push delivery cron job is installed'
);

select * from finish();
rollback;

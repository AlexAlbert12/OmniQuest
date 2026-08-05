begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

select ok(
  (
    select pg_get_constraintdef(constraint_row.oid) like '%''admin''%'
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.notifications'::regclass
      and constraint_row.conname = 'notifications_audience_check'
  ),
  'notification audiences include administrators'
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
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'support.student@omniquest.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"alias":"Support Student","role_id":"student"}',
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'support.admin@omniquest.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"alias":"Support Admin","role_id":"admin"}',
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values
  ('30000000-0000-0000-0000-000000000001', 'Support Student', 'support.student@omniquest.test', 'student', true, 'private'),
  ('30000000-0000-0000-0000-000000000002', 'Support Admin', 'support.admin@omniquest.test', 'admin', true, 'private')
on conflict (id) do update
set alias = excluded.alias,
    email = excluded.email,
    role_id = excluded.role_id,
    active = excluded.active,
    visibility = excluded.visibility;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    insert into public.user_support_tickets (
      user_id,
      role,
      contact_email,
      subject,
      message,
      category,
      priority,
      preferred_channel,
      status
    ) values (
      '30000000-0000-0000-0000-000000000001',
      'student',
      'support.student@omniquest.test',
      'Support submission regression',
      'A student can submit a support ticket without rolling back.',
      'plataforma',
      'medium',
      'in_app',
      'open'
    )
  $$,
  'students can submit support tickets through RLS'
);

reset role;

select is(
  (
    select count(*)
    from public.user_support_tickets
    where user_id = '30000000-0000-0000-0000-000000000001'
      and subject = 'Support submission regression'
  ),
  1::bigint,
  'the submitted support ticket is persisted'
);

select is(
  (
    select count(*)
    from public.support_ticket_messages message
    join public.user_support_tickets ticket on ticket.id = message.ticket_id
    where ticket.user_id = '30000000-0000-0000-0000-000000000001'
      and ticket.subject = 'Support submission regression'
      and message.author_role = 'student'
  ),
  1::bigint,
  'ticket creation seeds the initial support message'
);

select is(
  (
    select count(*)
    from public.notifications notification
    join public.user_support_tickets ticket on ticket.id::text = notification.related_id
    where notification.user_id = '30000000-0000-0000-0000-000000000002'
      and notification.audience = 'admin'
      and notification.related_table = 'user_support_tickets'
      and ticket.user_id = '30000000-0000-0000-0000-000000000001'
      and ticket.subject = 'Support submission regression'
  ),
  1::bigint,
  'ticket creation notifies administrators without rolling back'
);

select * from finish();
rollback;

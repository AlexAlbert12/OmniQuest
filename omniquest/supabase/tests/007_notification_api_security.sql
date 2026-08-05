begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select ok(
  to_regprocedure('public.create_teacher_notification(uuid,text,bigint,bigint,text)') is not null,
  'controlled teacher notification RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_notification(uuid,text,text,text,text,text,text,text,text,text,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the low-level notification writer'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_notification(uuid,text,text,text,text,text,text,text,text,text,jsonb,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot call the low-level notification writer'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_notification(uuid,text,text,text,text,text,text,text,text,text,jsonb,text)',
    'EXECUTE'
  ),
  'service-role processes can call the low-level notification writer'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_teacher_notification(uuid,text,bigint,bigint,text)',
    'EXECUTE'
  ),
  'authenticated sessions may invoke the protected teacher RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_teacher_notification(uuid,text,bigint,bigint,text)',
    'EXECUTE'
  ),
  'anonymous sessions cannot invoke the protected teacher RPC'
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
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher.notifications@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Notification Teacher","role_id":"teacher"}', now(), now()),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.notifications@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Notification Student","role_id":"student"}', now(), now()),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other.teacher.notifications@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Other Notification Teacher","role_id":"teacher"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values
  ('70000000-0000-0000-0000-000000000001', 'Notification Teacher', 'teacher.notifications@omniquest.test', 'teacher', true, 'private'),
  ('70000000-0000-0000-0000-000000000002', 'Notification Student', 'student.notifications@omniquest.test', 'student', true, 'private'),
  ('70000000-0000-0000-0000-000000000003', 'Other Notification Teacher', 'other.teacher.notifications@omniquest.test', 'teacher', true, 'private')
on conflict (id) do update
set alias = excluded.alias,
    email = excluded.email,
    role_id = excluded.role_id,
    active = excluded.active;

insert into public.subjects (id, teacher_id, name, code, active, is_archived)
values (970001, '70000000-0000-0000-0000-000000000001', 'Notification Security Course', 'NOTIFY-970001', true, false);

insert into public.classrooms (id, subject_id, name, code, active)
values (970001, 970001, 'Notification Security Classroom', 'NOTIFY-CLASS-970001', true);

insert into public.enrollments (student_id, subject_id, classroom_id)
values ('70000000-0000-0000-0000-000000000002', 970001, 970001);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.create_teacher_notification(
    '70000000-0000-0000-0000-000000000002',
    'student_activity',
    970001,
    970001,
    null
  )$$,
  'course owner can notify an enrolled student'
);

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);
select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_notifications_page('student', 20, null, null) -> 'rows') notification
    where notification ->> 'type' = 'student_activity'
      and notification ->> 'related_id' = '970001'
  ),
  'the intended student receives the notification through the protected API'
);

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.create_teacher_notification(
    '70000000-0000-0000-0000-000000000002',
    'student_activity',
    970001,
    970001,
    null
  )$$,
  'Course not found or not owned by current teacher',
  'another teacher cannot notify students through a course they do not own'
);

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.create_teacher_notification(
    '70000000-0000-0000-0000-000000000002',
    'student_activity',
    970001,
    970001,
    null
  )$$,
  'Teacher access required',
  'students cannot invoke the teacher notification workflow'
);

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.create_teacher_notification(
    '70000000-0000-0000-0000-000000000002',
    'custom_html',
    970001,
    970001,
    'Unsafe notification'
  )$$,
  'Unsupported teacher notification type',
  'teacher notification types are whitelisted'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(33);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.roles'::regclass),
  'role catalog has RLS enabled'
);
select is(
  (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) privilege
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'SECURITY DEFINER functions are never executable through PUBLIC'
);
select ok(
  not has_table_privilege('anon', 'public.roles', 'SELECT'),
  'anonymous clients cannot read the role catalog'
);
select is(
  (
    select count(*)
    from (    values
      ('account_backup_codes'),
      ('admin_audit_logs_default'),
      ('admin_role_assignments'),
      ('admin_roles'),
      ('analytics_reporting_identities'),
      ('analytics_retention_policy'),
      ('attempt_sensitive_data_retention_policy'),
      ('auth_rate_limits'),
      ('game_answer_submission_receipts'),
      ('notification_delivery_queue'),
      ('notification_push_deliveries'),
      ('question_media_assets'),
      ('teacher_audit_retention_policy'),
      ('teacher_digest_deliveries'),
      ('teacher_student_recovery_requests')
) as internal_table(table_name)
    where has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
       or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
  ),
  0::bigint,
  'anonymous clients have no direct privileges on internal tables'
);
select is(
  (
    select count(*)
    from (    values
      ('account_backup_codes'),
      ('admin_audit_logs_default'),
      ('admin_role_assignments'),
      ('admin_roles'),
      ('analytics_reporting_identities'),
      ('analytics_retention_policy'),
      ('attempt_sensitive_data_retention_policy'),
      ('auth_rate_limits'),
      ('game_answer_submission_receipts'),
      ('notification_delivery_queue'),
      ('notification_push_deliveries'),
      ('question_media_assets'),
      ('teacher_audit_retention_policy'),
      ('teacher_digest_deliveries'),
      ('teacher_student_recovery_requests')
) as internal_table(table_name)
    where has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
  ),
  0::bigint,
  'authenticated clients have no direct privileges on internal tables'
);
select ok(
  has_table_privilege('authenticated', 'public.roles', 'SELECT'),
  'authenticated clients can read the role catalog'
);
select ok(
  has_table_privilege('authenticated', 'public.subjects', 'SELECT')
    and not has_table_privilege('anon', 'public.subjects', 'SELECT'),
  'course reads are granted only to authenticated clients and remain RLS-scoped'
);
select ok(
  not has_table_privilege('authenticated', 'public.subjects', 'INSERT')
    and not has_table_privilege('authenticated', 'public.subjects', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.subjects', 'DELETE'),
  'course writes remain restricted to server operations'
);
select ok(
  has_table_privilege('authenticated', 'public.attempt_history', 'SELECT'),
  'authenticated users can read RLS-scoped attempt history'
);
select ok(
  not has_table_privilege('anon', 'public.attempt_history', 'SELECT'),
  'anonymous users cannot read attempt history'
);
select ok(
  has_table_privilege('authenticated', 'public.student_badges', 'SELECT'),
  'authenticated users can read RLS-scoped badge awards'
);
select ok(
  not has_table_privilege('anon', 'public.student_badges', 'SELECT'),
  'anonymous users cannot read badge awards'
);
select ok(
  not has_function_privilege('anon', 'public.delete_user_relational_data(uuid)', 'EXECUTE'),
  'anonymous clients cannot execute destructive user cleanup'
);
select ok(
  not has_function_privilege('authenticated', 'public.delete_user_relational_data(uuid)', 'EXECUTE'),
  'authenticated clients cannot execute destructive user cleanup'
);
select ok(
  has_function_privilege('service_role', 'public.delete_user_relational_data(uuid)', 'EXECUTE'),
  'service workers retain destructive user cleanup access'
);
select ok(
  not has_function_privilege('anon', 'public.start_game_attempt(bigint,bigint,bigint,boolean,integer)', 'EXECUTE'),
  'anonymous clients cannot start game attempts'
);
select ok(
  has_function_privilege('authenticated', 'public.start_game_attempt(bigint,bigint,bigint,boolean,integer)', 'EXECUTE'),
  'authenticated clients retain game attempt access'
);
select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'authenticated clients cannot invoke the auth provisioning trigger directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_teacher_audit_retention()', 'EXECUTE'),
  'authenticated clients cannot execute audit retention maintenance'
);
select ok(
  has_function_privilege('service_role', 'public.apply_teacher_audit_retention()', 'EXECUTE'),
  'service workers can execute audit retention maintenance'
);
select ok(
  not has_function_privilege('anon', 'public.join_subject_by_code(text)', 'EXECUTE'),
  'anonymous clients cannot join a course by code'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.subjects'::regclass
      and tgname = 'enforce_subject_invite_code_uniqueness'
      and not tgisinternal
  ),
  'course invitation codes are protected by a database trigger'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.classrooms'::regclass
      and tgname = 'enforce_classroom_invite_code_uniqueness'
      and not tgisinternal
  ),
  'classroom invitation codes are protected by a database trigger'
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
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'release.teacher@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Release Teacher","role_id":"teacher"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'release.student@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Release Student","role_id":"student"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'release.outsider@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Release Outsider","role_id":"student"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'release.inactive@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"alias":"Inactive Teacher","role_id":"teacher"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, null, now(), '{"provider":"anonymous","providers":["anonymous"]}', '{"alias":"Expired Guest","role_id":"guest"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility, expires_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'Release Teacher', 'release.teacher@omniquest.test', 'teacher', true, 'private', null),
  ('a0000000-0000-0000-0000-000000000002', 'Release Student', 'release.student@omniquest.test', 'student', true, 'private', null),
  ('a0000000-0000-0000-0000-000000000003', 'Release Outsider', 'release.outsider@omniquest.test', 'student', true, 'private', null),
  ('a0000000-0000-0000-0000-000000000004', 'Inactive Teacher', 'release.inactive@omniquest.test', 'teacher', false, 'private', null),
  ('a0000000-0000-0000-0000-000000000005', 'Expired Guest', null, 'guest', true, 'private', now() - interval '1 minute')
on conflict (id) do update
set alias = excluded.alias,
    email = excluded.email,
    role_id = excluded.role_id,
    active = excluded.active,
    expires_at = excluded.expires_at;

insert into public.subjects (id, teacher_id, name, code, active, is_archived)
values (990001, 'a0000000-0000-0000-0000-000000000001', 'Release Security Course', 'REL001', true, false);

insert into public.classrooms (id, subject_id, name, code, active)
values (990001, 990001, 'Release Security Classroom', 'REL002', true);

insert into public.enrollments (student_id, subject_id, classroom_id)
values ('a0000000-0000-0000-0000-000000000002', 990001, 990001);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$select public.create_subject_with_default_topic('Student Course')$$,
  'Teacher access required',
  'students cannot create courses through the server operation'
);
select throws_ok(
  $$select public.is_invite_code_available('NEW001')$$,
  'Teacher access required',
  'students cannot inspect global invitation-code availability'
);
select is(
  (select count(*) from public.subjects where id = 990001),
  1::bigint,
  'enrolled students can read their active course'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.subjects where id = 990001),
  0::bigint,
  'unenrolled students cannot read another course or its code'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select public.create_subject_with_default_topic('Inactive Teacher Course')$$,
  'Teacher access required',
  'inactive teachers cannot create courses'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$select public.join_subject_by_code('REL002')$$,
  'Solo los alumnos activos pueden unirse a clases.',
  'expired guest sessions cannot join a classroom'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select ok(
  public.is_invite_code_available('NEW001'),
  'active teachers can check an unused invitation code'
);
select ok(
  not public.is_invite_code_available('REL001'),
  'invitation-code checks detect existing course codes'
);
select is(
  (select count(*) from public.subjects where id = 990001),
  1::bigint,
  'the owning active teacher can read the course'
);

reset role;
select throws_ok(
  $$update public.subjects set teacher_id = 'a0000000-0000-0000-0000-000000000002' where id = 990001$$,
  'Course owner must be an active teacher',
  'database invariants reject a non-teacher course owner'
);

select * from finish();
rollback;

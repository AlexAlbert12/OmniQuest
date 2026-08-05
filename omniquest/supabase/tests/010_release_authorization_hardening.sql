begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(78);

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
  has_table_privilege('service_role', 'public.question_media_assets', 'SELECT')
    and has_table_privilege('service_role', 'public.question_media_assets', 'INSERT')
    and has_table_privilege('service_role', 'public.question_media_assets', 'UPDATE')
    and has_table_privilege('service_role', 'public.question_media_assets', 'DELETE'),
  'question-media workers retain explicit server-side asset access'
);
select ok(
  (
    select procedure.prosecdef and owner.rolname = 'postgres'
    from pg_proc procedure
    join pg_roles owner on owner.oid = procedure.proowner
    where procedure.oid = 'public.save_teacher_question(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,jsonb,text,text,text,text,text,numeric,text,text)'::regprocedure
  ),
  'question creation executes as a postgres-owned SECURITY DEFINER operation'
);
select ok(
  has_function_privilege('authenticated', 'public.save_teacher_question(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,jsonb,text,text,text,text,text,numeric,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.save_teacher_question(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,jsonb,text,text,text,text,text,numeric,text,text)', 'EXECUTE'),
  'only authenticated clients can invoke protected question creation'
);
select ok(
  (
    select procedure.prosecdef and owner.rolname = 'postgres'
    from pg_proc procedure
    join pg_roles owner on owner.oid = procedure.proowner
    where procedure.oid = 'public.can_access_question_media_object(text)'::regprocedure
  ),
  'question-media object authorization is isolated in a postgres-owned helper'
);
select ok(
  has_function_privilege('authenticated', 'public.can_access_question_media_object(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.can_access_question_media_object(text)', 'EXECUTE'),
  'only authenticated clients can invoke question-media object authorization'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'question_media_select_authorized'
      and qual like '%can_access_question_media_object%'
  ),
  'private question-media reads use the protected authorization helper'
);
select ok(
  has_table_privilege('authenticated', 'public.profiles', 'SELECT')
    and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    and has_column_privilege('authenticated', 'public.profiles', 'alias', 'UPDATE')
    and has_column_privilege('authenticated', 'public.profiles', 'visibility', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'role_id', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'active', 'UPDATE'),
  'authenticated clients can read profiles and update only safe self-service columns'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    and not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated clients cannot create or delete profiles directly'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT')
    and not has_table_privilege('anon', 'public.profiles', 'INSERT')
    and not has_table_privilege('anon', 'public.profiles', 'UPDATE')
    and not has_table_privilege('anon', 'public.profiles', 'DELETE'),
  'anonymous clients have no direct profile access'
);
select ok(
  has_table_privilege('authenticated', 'public.notification_state', 'SELECT')
    and has_table_privilege('authenticated', 'public.notification_state', 'INSERT')
    and has_table_privilege('authenticated', 'public.notification_state', 'UPDATE'),
  'authenticated clients can persist their RLS-scoped notification state'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_state', 'DELETE'),
  'authenticated clients cannot delete notification state directly'
);
select ok(
  not has_table_privilege('anon', 'public.notification_state', 'SELECT')
    and not has_table_privilege('anon', 'public.notification_state', 'INSERT')
    and not has_table_privilege('anon', 'public.notification_state', 'UPDATE')
    and not has_table_privilege('anon', 'public.notification_state', 'DELETE'),
  'anonymous clients have no direct notification-state access'
);
select ok(
  has_sequence_privilege('authenticated', 'public.notification_state_id_seq', 'USAGE')
    and has_sequence_privilege('authenticated', 'public.notification_state_id_seq', 'SELECT'),
  'authenticated clients can allocate notification-state identities'
);
select ok(
  not has_sequence_privilege('anon', 'public.notification_state_id_seq', 'USAGE')
    and not has_sequence_privilege('anon', 'public.notification_state_id_seq', 'SELECT'),
  'anonymous clients cannot use the notification-state identity sequence'
);
select ok(
  has_table_privilege('authenticated', 'public.user_notification_preferences', 'SELECT')
    and has_table_privilege('authenticated', 'public.user_notification_preferences', 'INSERT')
    and has_table_privilege('authenticated', 'public.user_notification_preferences', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.user_notification_preferences', 'DELETE'),
  'authenticated clients can manage only their RLS-scoped notification preferences'
);
select ok(
  not has_table_privilege('anon', 'public.user_notification_preferences', 'SELECT')
    and not has_table_privilege('anon', 'public.user_notification_preferences', 'INSERT')
    and not has_table_privilege('anon', 'public.user_notification_preferences', 'UPDATE')
    and not has_table_privilege('anon', 'public.user_notification_preferences', 'DELETE'),
  'anonymous clients have no notification-preference access'
);
select ok(
  has_function_privilege('authenticated', 'public.get_notifications_page(text,integer,timestamptz,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.mark_notifications_read(uuid[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.delete_notifications(uuid[])', 'EXECUTE'),
  'authenticated clients can use the protected notification API'
);
select ok(
  not has_function_privilege('anon', 'public.get_notifications_page(text,integer,timestamptz,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.mark_notifications_read(uuid[])', 'EXECUTE')
    and not has_function_privilege('anon', 'public.delete_notifications(uuid[])', 'EXECUTE'),
  'anonymous clients cannot use the protected notification API'
);
select ok(
  has_table_privilege('authenticated', 'public.classrooms', 'SELECT')
    and not has_table_privilege('authenticated', 'public.classrooms', 'INSERT')
    and not has_table_privilege('authenticated', 'public.classrooms', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.classrooms', 'DELETE'),
  'authenticated classroom reads remain RLS-scoped and writes remain server-controlled'
);
select ok(
  not has_table_privilege('anon', 'public.classrooms', 'SELECT')
    and not has_table_privilege('anon', 'public.classrooms', 'INSERT')
    and not has_table_privilege('anon', 'public.classrooms', 'UPDATE')
    and not has_table_privilege('anon', 'public.classrooms', 'DELETE'),
  'anonymous clients have no direct classroom access'
);
select ok(
  not has_sequence_privilege('authenticated', 'public.classrooms_id_seq', 'USAGE')
    and not has_sequence_privilege('authenticated', 'public.classrooms_id_seq', 'SELECT'),
  'classroom identities remain server-controlled'
);
select ok(
  not has_sequence_privilege('anon', 'public.classrooms_id_seq', 'USAGE')
    and not has_sequence_privilege('anon', 'public.classrooms_id_seq', 'SELECT'),
  'anonymous clients cannot use the classroom identity sequence'
);
select ok(
  has_table_privilege('authenticated', 'public.subject_topics', 'SELECT')
    and not has_table_privilege('authenticated', 'public.subject_topics', 'INSERT')
    and not has_table_privilege('authenticated', 'public.subject_topics', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.subject_topics', 'DELETE'),
  'authenticated clients can read RLS-scoped topics but cannot write them directly'
);
select ok(
  not has_table_privilege('anon', 'public.subject_topics', 'SELECT')
    and not has_table_privilege('anon', 'public.subject_topics', 'INSERT')
    and not has_table_privilege('anon', 'public.subject_topics', 'UPDATE')
    and not has_table_privilege('anon', 'public.subject_topics', 'DELETE'),
  'anonymous clients have no direct topic access'
);
select ok(
  has_table_privilege('service_role', 'public.subject_topics', 'SELECT')
    and has_table_privilege('service_role', 'public.subject_topics', 'INSERT')
    and has_table_privilege('service_role', 'public.subject_topics', 'UPDATE')
    and has_table_privilege('service_role', 'public.subject_topics', 'DELETE'),
  'teacher Edge Functions retain server-side topic access'
);
select ok(
  has_sequence_privilege('service_role', 'public.subject_topics_id_seq', 'USAGE')
    and has_sequence_privilege('service_role', 'public.subject_topics_id_seq', 'SELECT')
    and not has_sequence_privilege('anon', 'public.subject_topics_id_seq', 'USAGE')
    and not has_sequence_privilege('authenticated', 'public.subject_topics_id_seq', 'USAGE'),
  'only server-side workers can allocate topic identities'
);
select ok(
  has_table_privilege('authenticated', 'public.enrollments', 'SELECT')
    and has_table_privilege('authenticated', 'public.enrollments', 'DELETE'),
  'authenticated clients can read and leave RLS-scoped enrollments'
);
select ok(
  not has_table_privilege('authenticated', 'public.enrollments', 'INSERT')
    and not has_table_privilege('authenticated', 'public.enrollments', 'UPDATE'),
  'enrollment creation and mutation remain server-controlled'
);
select ok(
  not has_table_privilege('anon', 'public.enrollments', 'SELECT')
    and not has_table_privilege('anon', 'public.enrollments', 'INSERT')
    and not has_table_privilege('anon', 'public.enrollments', 'UPDATE')
    and not has_table_privilege('anon', 'public.enrollments', 'DELETE'),
  'anonymous clients have no direct enrollment access'
);
select ok(
  has_table_privilege('authenticated', 'public.subject_scores', 'SELECT')
    and has_table_privilege('authenticated', 'public.topic_scores', 'SELECT'),
  'authenticated clients can read RLS-scoped learning scores'
);
select ok(
  not has_table_privilege('authenticated', 'public.subject_scores', 'INSERT')
    and not has_table_privilege('authenticated', 'public.subject_scores', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.subject_scores', 'DELETE')
    and not has_table_privilege('authenticated', 'public.topic_scores', 'INSERT')
    and not has_table_privilege('authenticated', 'public.topic_scores', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.topic_scores', 'DELETE'),
  'learning-score writes remain server-controlled'
);
select ok(
  has_table_privilege('authenticated', 'public.user_preferences', 'SELECT')
    and has_table_privilege('authenticated', 'public.user_preferences', 'INSERT')
    and has_table_privilege('authenticated', 'public.user_preferences', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.user_preferences', 'DELETE'),
  'authenticated clients can manage only their RLS-scoped settings'
);
select ok(
  has_table_privilege('authenticated', 'public.user_support_tickets', 'SELECT')
    and has_table_privilege('authenticated', 'public.user_support_tickets', 'INSERT')
    and not has_table_privilege('authenticated', 'public.user_support_tickets', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.user_support_tickets', 'DELETE'),
  'authenticated clients can read and create only their RLS-scoped support tickets'
);
select ok(
  has_sequence_privilege('authenticated', 'public.user_support_tickets_id_seq', 'USAGE')
    and has_sequence_privilege('authenticated', 'public.user_support_tickets_id_seq', 'SELECT')
    and not has_sequence_privilege('anon', 'public.user_support_tickets_id_seq', 'USAGE'),
  'only authenticated support creation can allocate ticket identities'
);
select ok(
  not has_sequence_privilege('authenticated', 'public.enrollments_id_seq', 'USAGE')
    and not has_sequence_privilege('authenticated', 'public.subject_scores_id_seq', 'USAGE')
    and not has_sequence_privilege('authenticated', 'public.topic_scores_id_seq', 'USAGE'),
  'learning record identities remain server-controlled'
);
select ok(
  not has_table_privilege('anon', 'public.subject_scores', 'SELECT')
    and not has_table_privilege('anon', 'public.topic_scores', 'SELECT')
    and not has_table_privilege('anon', 'public.user_preferences', 'SELECT')
    and not has_table_privilege('anon', 'public.user_support_tickets', 'SELECT'),
  'anonymous clients cannot read learning records, settings, or support tickets'
);
select ok(
  (
    select procedure.prosecdef
      and pg_get_userbyid(procedure.proowner) = 'postgres'
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.oid = 'public.create_teacher_classroom(bigint,text,text)'::regprocedure
  )
    and has_function_privilege('authenticated', 'public.create_teacher_classroom(bigint,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.create_teacher_classroom(bigint,text,text)', 'EXECUTE'),
  'classroom creation executes only through the protected postgres-owned server operation'
);
select is(
  (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and (
        not has_table_privilege('service_role', relation.oid, 'SELECT')
        or not has_table_privilege('service_role', relation.oid, 'INSERT')
        or not has_table_privilege('service_role', relation.oid, 'UPDATE')
        or not has_table_privilege('service_role', relation.oid, 'DELETE')
      )
  ),
  0::bigint,
  'service workers retain server-side data access on public tables'
);
select is(
  (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'S'
      and (
        not has_sequence_privilege('service_role', relation.oid, 'USAGE')
        or not has_sequence_privilege('service_role', relation.oid, 'SELECT')
      )
  ),
  0::bigint,
  'service workers can use public identity sequences'
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

insert into public.question_media_assets (
  path, owner_id, subject_id, media_type, mime_type, size_bytes,
  scan_status, processing_status, processed_at, orphaned_at
)
values (
  'a0000000-0000-0000-0000-000000000001/release-image.png',
  'a0000000-0000-0000-0000-000000000001',
  990001,
  'image',
  'image/png',
  128,
  'clean',
  'basic_complete',
  now(),
  now()
);

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

reset role;
update public.classrooms
set code_expires_at = now() - interval '1 minute'
where id = 990001;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.join_subject_by_code('REL002')$$,
  'Este código de clase ha caducado.',
  'expired classroom invitation codes cannot be used'
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
select ok(
  (public.create_teacher_classroom(990001, 'Release Additional Classroom', null)->>'id')::bigint > 0,
  'the owning active teacher can create an additional classroom through the server operation'
);
select ok(
  public.save_teacher_question(
    990001,
    null,
    990001,
    null,
    'true_false',
    'Release media question',
    10,
    30,
    1,
    null,
    '[{"text":"Verdadero","is_correct":true,"sort_order":1},{"text":"Falso","is_correct":false,"sort_order":2}]'::jsonb,
    'image',
    null,
    'a0000000-0000-0000-0000-000000000001/release-image.png',
    'Imagen de validación',
    null,
    null,
    null,
    null
  ) > 0,
  'the owning teacher can create a question with validated private media'
);
reset role;
select is(
  (
    select count(*)
    from public.question_media_assets
    where path = 'a0000000-0000-0000-0000-000000000001/release-image.png'
      and attached_question_id is not null
      and orphaned_at is null
  ),
  1::bigint,
  'protected question creation attaches the validated private-media asset'
);
set local role authenticated;

delete from public.enrollments
where student_id = 'a0000000-0000-0000-0000-000000000002'
  and subject_id = 990001;
select is(
  (select count(*) from public.enrollments where student_id = 'a0000000-0000-0000-0000-000000000002' and subject_id = 990001),
  1::bigint,
  'teachers cannot bypass the server operation to remove student enrollments directly'
);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
delete from public.enrollments
where student_id = 'a0000000-0000-0000-0000-000000000002'
  and subject_id = 990001;
select is(
  (select count(*) from public.enrollments where student_id = 'a0000000-0000-0000-0000-000000000002' and subject_id = 990001),
  0::bigint,
  'students can leave their own enrollment through the RLS-scoped client operation'
);

reset role;
select throws_ok(
  $$update public.subjects set teacher_id = 'a0000000-0000-0000-0000-000000000002' where id = 990001$$,
  'Course owner must be an active teacher',
  'database invariants reject a non-teacher course owner'
);

select * from finish();
rollback;

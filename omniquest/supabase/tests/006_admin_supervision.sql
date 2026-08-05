begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

select ok(
  to_regprocedure('public.get_admin_directory_filters()') is not null,
  'advanced admin filter directory RPC exists'
);
select ok(
  to_regprocedure('public.get_admin_profiles_page(text,text,bigint,bigint,uuid,boolean,text,timestamptz,timestamptz,integer,integer)') is not null,
  'profile pagination RPC exposes advanced server filters'
);
select ok(
  to_regprocedure('public.get_admin_subjects_page(text,uuid,boolean,boolean,timestamptz,timestamptz,integer,integer)') is not null,
  'course supervision pagination RPC exists'
);
select ok(
  to_regprocedure('public.get_admin_classrooms_page(text,bigint,uuid,uuid,boolean,timestamptz,timestamptz,integer,integer)') is not null,
  'classroom supervision pagination RPC exists'
);
select ok(
  to_regprocedure('public.get_admin_audit_logs_page(text,uuid,text,text,text,timestamptz,timestamptz,text,integer,integer)') is not null,
  'advanced audit pagination RPC exists'
);
select ok(
  to_regprocedure('public.get_admin_profile_activity_page(uuid,text,text,timestamptz,timestamptz,integer,integer)') is not null,
  'safe profile activity pagination RPC exists'
);

select ok(
  has_function_privilege('authenticated', 'public.get_admin_directory_filters()', 'EXECUTE'),
  'authenticated sessions may invoke the protected directory RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.get_admin_profiles_page(text,text,bigint,bigint,uuid,boolean,text,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'authenticated sessions may invoke profile pagination'
);
select ok(
  has_function_privilege('authenticated', 'public.get_admin_subjects_page(text,uuid,boolean,boolean,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'authenticated sessions may invoke course supervision pagination'
);
select ok(
  has_function_privilege('authenticated', 'public.get_admin_classrooms_page(text,bigint,uuid,uuid,boolean,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'authenticated sessions may invoke classroom supervision pagination'
);
select ok(
  has_function_privilege('authenticated', 'public.get_admin_audit_logs_page_secured(text,uuid,text,text,text,timestamptz,timestamptz,text,integer,integer)', 'EXECUTE'),
  'authenticated sessions may invoke secured audit pagination'
);
select ok(
  has_function_privilege('authenticated', 'public.get_admin_profile_activity_page(uuid,text,text,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'authenticated sessions may invoke profile activity pagination'
);

select ok(
  not has_function_privilege('anon', 'public.get_admin_directory_filters()', 'EXECUTE'),
  'anonymous sessions cannot invoke the admin filter directory'
);
select ok(
  not has_function_privilege('anon', 'public.get_admin_profiles_page(text,text,bigint,bigint,uuid,boolean,text,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'anonymous sessions cannot invoke admin profile pagination'
);
select ok(
  not has_function_privilege('anon', 'public.get_admin_subjects_page(text,uuid,boolean,boolean,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'anonymous sessions cannot invoke admin course pagination'
);
select ok(
  not has_function_privilege('anon', 'public.get_admin_classrooms_page(text,bigint,uuid,uuid,boolean,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'anonymous sessions cannot invoke admin classroom pagination'
);
select ok(
  not has_function_privilege('anon', 'public.get_admin_audit_logs_page_secured(text,uuid,text,text,text,timestamptz,timestamptz,text,integer,integer)', 'EXECUTE'),
  'anonymous sessions cannot invoke secured admin audit pagination'
);
select ok(
  not has_function_privilege('anon', 'public.get_admin_profile_activity_page(uuid,text,text,timestamptz,timestamptz,integer,integer)', 'EXECUTE'),
  'anonymous sessions cannot invoke admin profile activity pagination'
);

select has_index('public', 'profiles', 'profiles_role_active_created_idx', 'profile filters have a supporting index');
select has_index('public', 'attempt_history', 'attempt_history_student_attempted_idx', 'profile activity has a student/date index');
select has_index('public', 'admin_audit_logs', 'admin_audit_logs_created_idx', 'audit pagination has a date index');

select * from finish();
rollback;

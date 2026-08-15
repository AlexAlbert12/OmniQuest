begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select has_column('public', 'profiles', 'onboarding_version', 'profiles stores onboarding version');
select col_not_null('public', 'profiles', 'onboarding_version', 'onboarding version is always defined');
select has_column('public', 'profiles', 'onboarding_completed_at', 'profiles stores onboarding completion timestamp');

select ok(
  to_regprocedure('public.complete_current_user_onboarding(integer)') is not null,
  'onboarding completion RPC exists'
);

select ok(
  position($needle$v_role_id not in ('student', 'teacher')$needle$ in pg_get_functiondef('public.complete_current_user_onboarding(integer)'::regprocedure)) > 0
  and position('greatest(profile.onboarding_version, p_version)' in pg_get_functiondef('public.complete_current_user_onboarding(integer)'::regprocedure)) > 0,
  'onboarding completion is role-scoped and version-monotonic'
);

select ok(
  has_function_privilege('authenticated', 'public.complete_current_user_onboarding(integer)', 'EXECUTE'),
  'authenticated students and teachers can complete onboarding through the RPC'
);

select ok(
  not has_function_privilege('anon', 'public.complete_current_user_onboarding(integer)', 'EXECUTE'),
  'anonymous clients cannot execute the onboarding completion RPC'
);

select * from finish();
rollback;

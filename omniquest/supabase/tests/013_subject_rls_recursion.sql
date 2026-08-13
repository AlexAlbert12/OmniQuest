begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

select ok(
  (
    select procedure.prosecdef
      and pg_get_userbyid(procedure.proowner) = 'postgres'
      and coalesce(procedure.proconfig, array[]::text[]) @> array['row_security=off']
    from pg_proc procedure
    where procedure.oid = 'public.is_subject_enrolled(bigint)'::regprocedure
  ),
  'course enrollment checks bypass nested enrollment RLS as a protected postgres-owned helper'
);

select ok(
  exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'subjects'
      and policy.policyname = 'subjects_select_authorized'
      and policy.qual like '%is_subject_enrolled%'
      and policy.qual not like '%FROM enrollments%'
  ),
  'course visibility uses the non-recursive enrollment helper'
);

select is(
  (
    select count(*)
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'subjects'
      and policy.policyname = 'subjects_select_authenticated_no_recursion'
  ),
  0::bigint,
  'the stale policy exposing all non-archived courses is removed'
);

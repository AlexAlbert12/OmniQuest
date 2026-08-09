begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

select ok(
  has_function_privilege('authenticated', 'public.mark_all_notifications_read(text)', 'EXECUTE'),
  'authenticated users can execute mark_all_notifications_read'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '85000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mark.all.read@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"alias":"Mark All Read","role_id":"student"}', now(), now()
)
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values ('85000000-0000-0000-0000-000000000001', 'Mark All Read', 'mark.all.read@omniquest.test', 'student', true, 'private')
on conflict (id) do update set alias = excluded.alias, email = excluded.email, role_id = excluded.role_id, active = excluded.active;

insert into public.notifications (user_id, audience, type, title, description, fingerprint)
values
  ('85000000-0000-0000-0000-000000000001', 'student', 'achievement', 'Logro 1', 'Primera notificación', 'mark-all-read-1'),
  ('85000000-0000-0000-0000-000000000001', 'student', 'new_class', 'Curso 1', 'Segunda notificación', 'mark-all-read-2');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '85000000-0000-0000-0000-000000000001', true);

select is(
  public.mark_all_notifications_read('student'),
  2,
  'mark_all_notifications_read updates every unread notification in the selected audience'
);

reset role;

select is(
  (select count(*)::integer from public.notifications where user_id = '85000000-0000-0000-0000-000000000001' and audience = 'student' and read_at is null and deleted_at is null),
  0,
  'no unread student notification remains after the batch action'
);

select is(
  (select count(*)::integer from public.notifications where user_id = '85000000-0000-0000-0000-000000000001' and audience = 'student' and read_at is not null),
  2,
  'both persistent notifications are marked as read'
);

select * from finish();
rollback;

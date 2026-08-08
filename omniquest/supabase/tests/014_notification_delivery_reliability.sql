begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ),
  'notifications are published through Supabase Realtime'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '84000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'push.owner.one@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"alias":"Push Owner One","role_id":"student"}', now(), now()
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'push.owner.two@omniquest.test', crypt('Test1234!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"alias":"Push Owner Two","role_id":"student"}', now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, alias, email, role_id, active, visibility)
values
  ('84000000-0000-0000-0000-000000000001', 'Push Owner One', 'push.owner.one@omniquest.test', 'student', true, 'private'),
  ('84000000-0000-0000-0000-000000000002', 'Push Owner Two', 'push.owner.two@omniquest.test', 'student', true, 'private')
on conflict (id) do update set alias = excluded.alias, email = excluded.email, role_id = excluded.role_id, active = excluded.active;

insert into public.user_notification_preferences (user_id, push_enabled, activity_enabled)
values ('84000000-0000-0000-0000-000000000002', true, true)
on conflict (user_id) do update set push_enabled = true, activity_enabled = true;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);

select is(
  (public.register_push_token('ExpoPushToken[OmniQuestReliabilityToken123456789]', 'android', 'TFM device', '1.0.0')->>'registered')::boolean,
  true,
  'first account can register the physical device token'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000002', true);

select is(
  (public.register_push_token('ExpoPushToken[OmniQuestReliabilityToken123456789]', 'android', 'TFM device', '1.0.0')->>'registered')::boolean,
  true,
  'same physical device token can move to the newly authenticated account'
);

reset role;

select is(
  (select user_id from public.push_tokens where expo_push_token = 'ExpoPushToken[OmniQuestReliabilityToken123456789]'),
  '84000000-0000-0000-0000-000000000002'::uuid,
  'push token belongs to the most recently authenticated account'
);

insert into public.student_badges (student_id, badge_id, reward_xp, awarded_at)
values ('84000000-0000-0000-0000-000000000002', 'first-step', 50, now())
on conflict (student_id, badge_id) do nothing;

select ok(
  exists (
    select 1
    from public.notifications n
    where n.user_id = '84000000-0000-0000-0000-000000000002'
      and n.audience = 'student'
      and n.type = 'achievement'
      and n.related_table = 'student_badges'
      and n.metadata->>'badge_id' = 'first-step'
      and n.metadata->>'push_priority' = 'high'
  ),
  'badge award creates a persistent high-priority achievement notification'
);

select ok(
  exists (
    select 1
    from public.notifications n
    where n.user_id = '84000000-0000-0000-0000-000000000002'
      and n.type = 'achievement'
      and n.description like '%Primer paso%'
  ),
  'badge notification identifies the unlocked badge'
);

select ok(
  exists (
    select 1
    from public.notification_delivery_queue q
    join public.notifications n on n.id = q.notification_id
    where n.user_id = '84000000-0000-0000-0000-000000000002'
      and n.type = 'achievement'
      and n.metadata->>'badge_id' = 'first-step'
      and q.status = 'pending'
      and q.priority = 'high'
  ),
  'badge notification is automatically enqueued for push delivery'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'notify_badge_award_event'
      and not tgisinternal
  ),
  'badge notification trigger remains installed'
);

select ok(
  exists (
    select 1 from cron.job
    where jobname = 'omniquest-notification-delivery'
      and active
  ),
  'push delivery cron remains active'
);

select * from finish();
rollback;

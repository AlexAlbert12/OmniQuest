-- Notification delivery reliability hardening.
-- 1. Keep the current device token associated with the most recently authenticated user.
-- 2. Ensure persistent notifications are published through Supabase Realtime.
-- 3. Make badge notifications explicit, actionable and high priority.

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id bigint;
  v_token text := trim(coalesce(p_expo_push_token, ''));
  v_platform text := lower(trim(coalesce(p_platform, '')));
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if length(v_token) < 20
     or length(v_token) > 255
     or not (v_token like 'ExpoPushToken[%]' or v_token like 'ExponentPushToken[%]') then
    raise exception 'Invalid Expo push token';
  end if;

  if v_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform';
  end if;

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_name,
    app_version,
    active,
    last_seen_at,
    updated_at
  ) values (
    v_user_id,
    v_token,
    v_platform,
    nullif(trim(coalesce(p_device_name, '')), ''),
    nullif(trim(coalesce(p_app_version, '')), ''),
    true,
    now(),
    now()
  )
  on conflict (expo_push_token) do update
  set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    active = true,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'registered', true);
end;
$$;

revoke execute on function public.register_push_token(text, text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;

comment on function public.register_push_token(text, text, text, text) is
  'Registers or refreshes the current physical device Expo token. If the device changes account, the latest authenticated registration owns that token.';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

create or replace function public.notify_badge_award_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge_title text;
  v_badge_icon text;
  v_badge_color text;
begin
  select bd.title, bd.icon, bd.color
  into v_badge_title, v_badge_icon, v_badge_color
  from public.badge_definitions bd
  where bd.badge_id = new.badge_id;

  perform public.create_notification(
    new.student_id,
    'student',
    'achievement',
    'Logro desbloqueado',
    case
      when coalesce(new.reward_xp, 0) > 0 then format('Has conseguido "%s" y ganado %s XP.', coalesce(v_badge_title, new.badge_id), new.reward_xp)
      else format('Has conseguido "%s".', coalesce(v_badge_title, new.badge_id))
    end,
    coalesce(v_badge_icon, 'trophy-outline'),
    coalesce(v_badge_color, '#F6A64A'),
    '/(student)/badges',
    'student_badges',
    new.id::text,
    jsonb_build_object(
      'badge_id', new.badge_id,
      'badge_title', coalesce(v_badge_title, new.badge_id),
      'reward_xp', coalesce(new.reward_xp, 0),
      'preference_category', 'activity',
      'push_priority', 'high'
    ),
    concat('student-badge:', new.id)
  );

  return new;
end;
$$;

comment on function public.notify_badge_award_event() is
  'Creates the persistent achievement notification that is subsequently enqueued for push delivery.';

notify pgrst, 'reload schema';

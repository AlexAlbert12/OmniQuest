create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias text;
  v_role_id text;
begin
  v_alias := nullif(trim(coalesce(
    new.raw_user_meta_data->>'alias',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    case when coalesce(new.is_anonymous, false) then 'Invitado' else 'Alumno' end
  )), '');

  v_role_id := case
    when coalesce(new.is_anonymous, false) then 'guest'
    else 'student'
  end;

  insert into public.profiles (
    id,
    email,
    alias,
    role_id,
    points,
    active
  )
  values (
    new.id,
    new.email,
    coalesce(v_alias, case when v_role_id = 'guest' then 'Invitado' else 'Alumno' end),
    v_role_id,
    0,
    true
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    alias = coalesce(public.profiles.alias, excluded.alias);

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates only student or guest profiles from public Auth sign-ups. Staff roles require a service-role workflow.';

create or replace function public.initialize_guest_profile(p_alias text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expires_at timestamptz;
  v_is_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
begin
  if v_user_id is null or not v_is_anonymous then
    raise exception 'Anonymous authentication required.';
  end if;

  update public.profiles
  set
    alias = left(coalesce(nullif(trim(p_alias), ''), 'Invitado'), 30),
    active = true,
    expires_at = coalesce(expires_at, now() + interval '30 days'),
    converted_at = null
  where id = v_user_id
    and role_id = 'guest'
  returning expires_at into v_expires_at;

  if v_expires_at is null then
    raise exception 'Guest profile was not initialized.';
  end if;

  return jsonb_build_object(
    'user_id', v_user_id,
    'role_id', 'guest',
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.initialize_guest_profile(text) from public, anon;
grant execute on function public.initialize_guest_profile(text) to authenticated;

create table if not exists public.auth_rate_limits (
  key_hash text not null,
  action text not null check (action in (
    'sign_in',
    'sign_up',
    'password_recovery',
    'resend_verification',
    'anonymous_sign_in'
  )),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (key_hash, action)
);

create index if not exists auth_rate_limits_cleanup_idx
  on public.auth_rate_limits(updated_at, blocked_until);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.auth_rate_limits to service_role;

create or replace function public.consume_auth_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.auth_rate_limits%rowtype;
  v_now timestamptz := now();
  v_attempts integer;
  v_blocked_until timestamptz;
  v_retry integer := 0;
begin
  if p_action not in ('sign_in','sign_up','password_recovery','resend_verification','anonymous_sign_in') then
    raise exception 'Invalid auth action.';
  end if;
  if nullif(trim(p_key_hash), '') is null then
    raise exception 'Rate-limit key is required.';
  end if;

  p_limit := greatest(1, least(coalesce(p_limit, 5), 100));
  p_window_seconds := greatest(30, least(coalesce(p_window_seconds, 900), 86400));
  p_block_seconds := greatest(30, least(coalesce(p_block_seconds, 900), 86400));

  insert into public.auth_rate_limits(key_hash, action, window_started_at, attempts, updated_at)
  values (left(p_key_hash, 128), p_action, v_now, 0, v_now)
  on conflict (key_hash, action) do nothing;

  select * into v_row
  from public.auth_rate_limits
  where key_hash = left(p_key_hash, 128) and action = p_action
  for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry, 'remaining', 0);
  end if;

  if v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) then
    v_attempts := 1;
    v_blocked_until := null;
    update public.auth_rate_limits
    set window_started_at = v_now, attempts = v_attempts, blocked_until = null, updated_at = v_now
    where key_hash = v_row.key_hash and action = v_row.action;
  else
    v_attempts := v_row.attempts + 1;
    if v_attempts > p_limit then
      v_blocked_until := v_now + make_interval(secs => p_block_seconds);
    else
      v_blocked_until := null;
    end if;
    update public.auth_rate_limits
    set attempts = v_attempts, blocked_until = v_blocked_until, updated_at = v_now
    where key_hash = v_row.key_hash and action = v_row.action;
  end if;

  if v_blocked_until is not null then
    v_retry := greatest(1, ceil(extract(epoch from (v_blocked_until - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry, 'remaining', 0);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'retry_after_seconds', 0,
    'remaining', greatest(0, p_limit - v_attempts)
  );
end;
$$;

revoke all on function public.consume_auth_rate_limit(text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text,text,integer,integer,integer) to service_role;

create or replace function public.cleanup_auth_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.auth_rate_limits
  where updated_at < now() - interval '2 days'
    and coalesce(blocked_until, '-infinity'::timestamptz) < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.cleanup_auth_rate_limits() from public, anon, authenticated;
grant execute on function public.cleanup_auth_rate_limits() to service_role;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'omniquest-auth-rate-limit-cleanup';
exception when undefined_table then
  null;
end $$;

select cron.schedule(
  'omniquest-auth-rate-limit-cleanup',
  '45 4 * * *',
  $$select public.cleanup_auth_rate_limits();$$
);

-- Privacy-aware product analytics and private rich media delivery.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Analytics consent, pseudonymous reporting and retention
-- ---------------------------------------------------------------------------

alter table public.user_preferences
  add column if not exists analytics_enabled boolean not null default false,
  add column if not exists analytics_consent_updated_at timestamptz;

alter table public.analytics_events
  add column if not exists reporting_id uuid,
  add column if not exists purpose text not null default 'product';

alter table public.analytics_events
  drop constraint if exists analytics_events_purpose_check;

alter table public.analytics_events
  add constraint analytics_events_purpose_check
  check (purpose in ('product', 'operational'));

create table if not exists public.analytics_reporting_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reporting_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.analytics_reporting_identities enable row level security;
revoke all on table public.analytics_reporting_identities from public, anon, authenticated;

insert into public.analytics_reporting_identities (user_id)
select distinct ae.user_id
from public.analytics_events ae
where ae.user_id is not null
on conflict (user_id) do nothing;

update public.analytics_events ae
set reporting_id = ari.reporting_id
from public.analytics_reporting_identities ari
where ae.user_id = ari.user_id
  and ae.reporting_id is null;

create index if not exists analytics_events_occurred_at_brin_idx
  on public.analytics_events using brin (occurred_at);
create index if not exists analytics_events_purpose_occurred_at_idx
  on public.analytics_events(purpose, occurred_at desc);
create index if not exists analytics_events_reporting_occurred_at_idx
  on public.analytics_events(reporting_id, occurred_at desc)
  where reporting_id is not null;

-- Raw events remain service-only. Product reporting is exposed through the
-- aggregate RPC below, so administrators do not need direct identifiers.
revoke select on table public.analytics_events from authenticated;
drop policy if exists "admin_select_analytics_events" on public.analytics_events;

create table if not exists public.analytics_retention_policy (
  singleton boolean primary key default true check (singleton),
  retention_days integer not null default 395 check (retention_days between 30 and 730),
  anonymize_after_days integer not null default 90 check (anonymize_after_days between 1 and 365),
  updated_at timestamptz not null default now(),
  check (anonymize_after_days < retention_days)
);

insert into public.analytics_retention_policy (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.analytics_retention_policy enable row level security;
revoke all on table public.analytics_retention_policy from public, anon, authenticated;

create or replace function public.ensure_analytics_reporting_id(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporting_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.analytics_reporting_identities (user_id)
  values (p_user_id)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning reporting_id into v_reporting_id;

  return v_reporting_id;
end;
$$;

revoke execute on function public.ensure_analytics_reporting_id(uuid) from public, anon, authenticated;

create or replace function public.analytics_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select up.analytics_enabled
    from public.user_preferences up
    where up.user_id = p_user_id
  ), false);
$$;

revoke execute on function public.analytics_allowed(uuid) from public, anon, authenticated;

create or replace function public.sanitize_analytics_properties(p_properties jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_properties jsonb := jsonb_strip_nulls(coalesce(p_properties, '{}'::jsonb))
    - array[
      'email', 'name', 'alias', 'password', 'token', 'authorization',
      'access_token', 'refresh_token', 'invite_code', 'url'
    ];
begin
  if jsonb_typeof(v_properties) <> 'object' then
    return '{}'::jsonb;
  end if;

  if octet_length(v_properties::text) > 8192 then
    return jsonb_build_object('truncated', true);
  end if;

  return v_properties;
end;
$$;

revoke execute on function public.sanitize_analytics_properties(jsonb) from public, anon, authenticated;

create or replace function public.track_usage_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_attempt_id uuid default null,
  p_session_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_event_name text := lower(trim(coalesce(p_event_name, '')));
  v_event_id bigint;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if v_event_name not in (
    'game_error',
    'game_resumed',
    'global_search',
    'support_ticket_created',
    'screen_view',
    'form_abandoned',
    'question_viewed',
    'rpc_latency',
    'edge_function_error'
  ) then
    raise exception 'Unsupported analytics event';
  end if;

  if not public.analytics_allowed(v_user_id) then
    return null;
  end if;

  select role_id into v_role
  from public.profiles
  where id = v_user_id;

  insert into public.analytics_events (
    user_id,
    reporting_id,
    role,
    event_name,
    subject_id,
    classroom_id,
    topic_id,
    attempt_id,
    session_id,
    properties,
    purpose
  ) values (
    v_user_id,
    public.ensure_analytics_reporting_id(v_user_id),
    v_role,
    v_event_name,
    p_subject_id,
    p_classroom_id,
    p_topic_id,
    p_attempt_id,
    left(nullif(trim(coalesce(p_session_id, '')), ''), 128),
    public.sanitize_analytics_properties(p_properties),
    'product'
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke execute on function public.track_usage_event(text, jsonb, bigint, bigint, bigint, uuid, text) from public, anon;
grant execute on function public.track_usage_event(text, jsonb, bigint, bigint, bigint, uuid, text) to authenticated;

create or replace function public.set_analytics_consent(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  insert into public.user_preferences (
    user_id,
    analytics_enabled,
    analytics_consent_updated_at,
    updated_at
  )
  values (v_user_id, coalesce(p_enabled, false), now(), now())
  on conflict (user_id) do update
  set
    analytics_enabled = excluded.analytics_enabled,
    analytics_consent_updated_at = excluded.analytics_consent_updated_at,
    updated_at = now();

  if p_enabled then
    perform public.ensure_analytics_reporting_id(v_user_id);
  end if;

  return coalesce(p_enabled, false);
end;
$$;

revoke execute on function public.set_analytics_consent(boolean) from public, anon;
grant execute on function public.set_analytics_consent(boolean) to authenticated;

create or replace function public.log_game_attempt_analytics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_event_name text;
begin
  if not public.analytics_allowed(new.student_id) then
    return new;
  end if;

  select role_id into v_role
  from public.profiles
  where id = new.student_id;

  if tg_op = 'INSERT' then
    v_event_name := 'game_started';
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'abandoned' then
      v_event_name := 'game_abandoned';
    elsif new.status = 'finished' then
      v_event_name := 'game_finished';
    end if;
  end if;

  if v_event_name is not null then
    insert into public.analytics_events (
      user_id, reporting_id, role, event_name, subject_id, classroom_id,
      topic_id, attempt_id, properties, occurred_at
    ) values (
      new.student_id,
      public.ensure_analytics_reporting_id(new.student_id),
      coalesce(v_role, 'student'),
      v_event_name,
      new.subject_id,
      new.classroom_id,
      new.topic_id,
      new.id,
      jsonb_build_object(
        'status', new.status,
        'total_score', coalesce(new.total_score, 0),
        'correct_answers', coalesce(new.correct_answers, 0)
      ),
      case
        when v_event_name in ('game_finished', 'game_abandoned') then coalesce(new.finished_at, now())
        else coalesce(new.started_at, now())
      end
    );
  end if;

  return new;
end;
$$;

create or replace function public.log_badge_unlock_analytics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.analytics_allowed(new.student_id) then
    return new;
  end if;

  insert into public.analytics_events (
    user_id, reporting_id, role, event_name, properties, occurred_at
  ) values (
    new.student_id,
    public.ensure_analytics_reporting_id(new.student_id),
    'student',
    'badge_unlocked',
    jsonb_build_object(
      'badge_id', new.badge_id,
      'reward_xp', coalesce(new.reward_xp, 0)
    ),
    coalesce(new.awarded_at, now())
  );

  return new;
end;
$$;

create or replace function public.log_course_join_analytics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.analytics_allowed(new.student_id) then
    insert into public.analytics_events (
      user_id, reporting_id, role, event_name, subject_id, classroom_id,
      properties, occurred_at
    ) values (
      new.student_id,
      public.ensure_analytics_reporting_id(new.student_id),
      'student',
      'course_joined',
      new.subject_id,
      new.classroom_id,
      jsonb_build_object('enrollment_id', new.id),
      coalesce(new.joined_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists log_course_join_analytics on public.enrollments;
create trigger log_course_join_analytics
after insert on public.enrollments
for each row execute function public.log_course_join_analytics();

create or replace function public.log_question_type_analytics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
begin
  if not public.analytics_allowed(new.student_id) then
    return new;
  end if;

  select * into v_question
  from public.questions
  where id = new.question_id;

  insert into public.analytics_events (
    user_id, reporting_id, role, event_name, subject_id, classroom_id,
    topic_id, properties, occurred_at
  ) values (
    new.student_id,
    public.ensure_analytics_reporting_id(new.student_id),
    'student',
    'question_answered',
    v_question.subject_id,
    v_question.classroom_id,
    v_question.topic_id,
    jsonb_build_object(
      'question_type', v_question.type,
      'correct', new.is_correct,
      'time_taken_seconds', new.time_taken_seconds,
      'skipped', coalesce(new.was_skipped, false)
    ),
    coalesce(new.attempted_at, now())
  );

  return new;
end;
$$;

drop trigger if exists log_question_type_analytics on public.attempt_history;
create trigger log_question_type_analytics
after insert on public.attempt_history
for each row execute function public.log_question_type_analytics();

create or replace function public.apply_analytics_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.analytics_retention_policy%rowtype;
  v_anonymized integer := 0;
  v_deleted integer := 0;
begin
  select * into v_policy
  from public.analytics_retention_policy
  where singleton = true;

  update public.analytics_events
  set user_id = null, session_id = null
  where purpose = 'product'
    and user_id is not null
    and occurred_at < now() - make_interval(days => v_policy.anonymize_after_days);
  get diagnostics v_anonymized = row_count;

  delete from public.analytics_events
  where occurred_at < now() - make_interval(days => v_policy.retention_days);
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'anonymized', v_anonymized,
    'deleted', v_deleted,
    'retention_days', v_policy.retention_days,
    'anonymize_after_days', v_policy.anonymize_after_days
  );
end;
$$;

revoke execute on function public.apply_analytics_retention() from public, anon, authenticated;
grant execute on function public.apply_analytics_retention() to service_role;

create or replace function public.get_admin_usage_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_since := now() - make_interval(days => v_days);

  with scoped as (
    select *
    from public.analytics_events
    where occurred_at >= v_since
  ),
  first_seen as (
    select reporting_id, min(occurred_at)::date as cohort_day
    from public.analytics_events
    where reporting_id is not null
    group by reporting_id
  ),
  retention as (
    select
      count(*) filter (where cohort_day <= current_date - 1) as d1_eligible,
      count(*) filter (
        where cohort_day <= current_date - 1
          and exists (
            select 1 from public.analytics_events ae
            where ae.reporting_id = fs.reporting_id
              and ae.occurred_at::date = fs.cohort_day + 1
          )
      ) as d1_retained,
      count(*) filter (where cohort_day <= current_date - 7) as d7_eligible,
      count(*) filter (
        where cohort_day <= current_date - 7
          and exists (
            select 1 from public.analytics_events ae
            where ae.reporting_id = fs.reporting_id
              and ae.occurred_at::date = fs.cohort_day + 7
          )
      ) as d7_retained,
      count(*) filter (where cohort_day <= current_date - 30) as d30_eligible,
      count(*) filter (
        where cohort_day <= current_date - 30
          and exists (
            select 1 from public.analytics_events ae
            where ae.reporting_id = fs.reporting_id
              and ae.occurred_at::date = fs.cohort_day + 30
          )
      ) as d30_retained
    from first_seen fs
  )
  select jsonb_build_object(
    'days', v_days,
    'screen_views', count(*) filter (where event_name = 'screen_view'),
    'form_abandoned', count(*) filter (where event_name = 'form_abandoned'),
    'course_joins', count(*) filter (where event_name = 'course_joined'),
    'game_started', count(*) filter (where event_name = 'game_started'),
    'game_finished', count(*) filter (where event_name = 'game_finished'),
    'game_abandoned', count(*) filter (where event_name = 'game_abandoned'),
    'game_errors', count(*) filter (where event_name = 'game_error'),
    'edge_function_errors', count(*) filter (where event_name = 'edge_function_error'),
    'badges_unlocked', count(*) filter (where event_name = 'badge_unlocked'),
    'active_users', count(distinct reporting_id),
    'completion_rate', case
      when count(*) filter (where event_name = 'game_started') = 0 then 0
      else round(
        100.0 * count(*) filter (where event_name = 'game_finished')
        / nullif(count(*) filter (where event_name = 'game_started'), 0),
        1
      )
    end,
    'funnel', jsonb_build_object(
      'screen_view', count(distinct reporting_id) filter (where event_name = 'screen_view'),
      'course_joined', count(distinct reporting_id) filter (where event_name = 'course_joined'),
      'game_started', count(distinct reporting_id) filter (where event_name = 'game_started'),
      'game_finished', count(distinct reporting_id) filter (where event_name = 'game_finished')
    ),
    'retention', (
      select jsonb_build_object(
        'd1', case when d1_eligible = 0 then 0 else round(100.0 * d1_retained / d1_eligible, 1) end,
        'd7', case when d7_eligible = 0 then 0 else round(100.0 * d7_retained / d7_eligible, 1) end,
        'd30', case when d30_eligible = 0 then 0 else round(100.0 * d30_retained / d30_eligible, 1) end
      )
      from retention
    ),
    'question_types', coalesce((
      select jsonb_object_agg(question_type, total)
      from (
        select properties->>'question_type' as question_type, count(*) as total
        from scoped
        where event_name = 'question_answered'
          and nullif(properties->>'question_type', '') is not null
        group by properties->>'question_type'
      ) question_type_rows
    ), '{}'::jsonb),
    'rpc_latency_ms', coalesce((
      select jsonb_build_object(
        'p50', round(percentile_cont(0.5) within group (order by (properties->>'duration_ms')::numeric), 1),
        'p95', round(percentile_cont(0.95) within group (order by (properties->>'duration_ms')::numeric), 1)
      )
      from scoped
      where event_name = 'rpc_latency'
        and (properties->>'duration_ms') ~ '^[0-9]+(\.[0-9]+)?$'
    ), jsonb_build_object('p50', 0, 'p95', 0)),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', day,
        'screen_views', screen_views,
        'game_started', game_started,
        'game_finished', game_finished,
        'game_abandoned', game_abandoned,
        'errors', errors
      ) order by day)
      from (
        select
          occurred_at::date as day,
          count(*) filter (where event_name = 'screen_view') as screen_views,
          count(*) filter (where event_name = 'game_started') as game_started,
          count(*) filter (where event_name = 'game_finished') as game_finished,
          count(*) filter (where event_name = 'game_abandoned') as game_abandoned,
          count(*) filter (where event_name in ('game_error', 'edge_function_error')) as errors
        from scoped
        group by occurred_at::date
      ) daily_rows
    ), '[]'::jsonb)
  ) into v_result
  from scoped;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke execute on function public.get_admin_usage_analytics(integer) from public, anon;
grant execute on function public.get_admin_usage_analytics(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Private question media, manifests and orphan lifecycle
-- ---------------------------------------------------------------------------

update storage.buckets
set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
where id = 'question-media';

-- Backfill the private object path while the previous constraint still allows
-- media_url. Signed/public Storage URLs may contain query strings or fragments,
-- which must never become part of the persisted object path.
update public.questions
set media_path = split_part(
  split_part(
    split_part(media_url, '/question-media/', 2),
    '?',
    1
  ),
  '#',
  1
)
where media_type is not null
  and nullif(trim(coalesce(media_path, '')), '') is null
  and media_url like '%/question-media/%';

-- The old constraint requires media_url whenever media_type is present. Drop it
-- before clearing legacy URLs; otherwise the backfill update violates the old
-- invariant before the new private-media invariant can be installed.
alter table public.questions
  drop constraint if exists questions_media_consistency_check;

update public.questions
set media_path = nullif(trim(media_path), '')
where media_path is not null;

-- Fail with an actionable message instead of a generic CHECK violation if a
-- legacy row points outside question-media and therefore has no private path.
do $$
declare
  v_unresolved_ids text;
begin
  select string_agg(id::text, ', ' order by id)
  into v_unresolved_ids
  from (
    select id
    from public.questions
    where media_type is not null
      and nullif(trim(coalesce(media_path, '')), '') is null
    order by id
    limit 20
  ) unresolved;

  if v_unresolved_ids is not null then
    raise exception using
      errcode = '23514',
      message = format(
        'No se puede privatizar el multimedia de las preguntas [%s]: no se pudo obtener media_path desde media_url.',
        v_unresolved_ids
      ),
      hint = 'Mueve esos archivos al bucket question-media y guarda su ruta en media_path, o elimina el multimedia de esas preguntas antes de repetir la migración.';
  end if;
end;
$$;

update public.questions
set media_url = null
where media_path is not null;

alter table public.questions
  add constraint questions_media_consistency_check
  check (
    (media_type is null and media_url is null and media_path is null)
    or (
      media_type is not null
      and media_url is null
      and nullif(trim(coalesce(media_path, '')), '') is not null
    )
  );

create table if not exists public.question_media_assets (
  path text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  attached_question_id bigint unique references public.questions(id) on delete set null,
  media_type text not null check (media_type in ('image', 'audio', 'video')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  duration_seconds numeric,
  scan_status text not null default 'pending'
    check (scan_status in ('pending', 'clean', 'rejected', 'legacy')),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'basic_complete', 'processing', 'ready', 'failed')),
  thumbnail_path text,
  processed_path text,
  transcript text,
  subtitles_vtt text,
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  orphaned_at timestamptz,
  check (
    duration_seconds is null
    or (
      duration_seconds >= 0
      and (
        (media_type = 'audio' and duration_seconds <= 600)
        or (media_type = 'video' and duration_seconds <= 300)
        or media_type = 'image'
      )
    )
  )
);

create index if not exists question_media_assets_orphaned_idx
  on public.question_media_assets(orphaned_at)
  where orphaned_at is not null;
create index if not exists question_media_assets_question_idx
  on public.question_media_assets(attached_question_id)
  where attached_question_id is not null;

alter table public.question_media_assets enable row level security;
revoke all on table public.question_media_assets from public, anon, authenticated;

insert into public.question_media_assets (
  path,
  owner_id,
  subject_id,
  attached_question_id,
  media_type,
  mime_type,
  size_bytes,
  scan_status,
  processing_status,
  processed_at
)
select
  q.media_path,
  p.id,
  q.subject_id,
  q.id,
  q.media_type,
  'application/octet-stream',
  0,
  'legacy',
  'ready',
  now()
from public.questions q
join public.profiles p on p.id::text = split_part(q.media_path, '/', 1)
where q.media_type is not null
  and q.media_path is not null
on conflict (path) do update
set attached_question_id = excluded.attached_question_id;

create or replace function public.can_access_question_media(
  p_subject_id bigint,
  p_classroom_id bigint default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.subjects s
      where s.id = p_subject_id
        and s.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.enrollments e
      where e.student_id = auth.uid()
        and e.subject_id = p_subject_id
        and (
          p_classroom_id is null
          or e.classroom_id = p_classroom_id
          or e.classroom_id is null
        )
    )
  );
$$;

revoke execute on function public.can_access_question_media(bigint, bigint) from public, anon;
grant execute on function public.can_access_question_media(bigint, bigint) to authenticated;

drop policy if exists "question_media_select_authorized" on storage.objects;
create policy "question_media_select_authorized"
on storage.objects for select to authenticated
using (
  bucket_id = 'question-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1
      from public.questions q
      where q.media_path = name
        and public.can_access_question_media(q.subject_id, q.classroom_id)
    )
    or exists (
      select 1
      from public.question_media_assets a
      join public.questions q on q.id = a.attached_question_id
      where (a.thumbnail_path = name or a.processed_path = name)
        and public.can_access_question_media(q.subject_id, q.classroom_id)
    )
  )
);

create or replace function public.get_question_media_manifest(p_question_ids bigint[])
returns table (
  question_id bigint,
  media_type text,
  media_path text,
  thumbnail_path text,
  transcript text,
  subtitles_vtt text,
  duration_seconds numeric,
  processing_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.media_type,
    coalesce(a.processed_path, q.media_path),
    a.thumbnail_path,
    a.transcript,
    a.subtitles_vtt,
    a.duration_seconds,
    a.processing_status
  from public.questions q
  left join public.question_media_assets a on a.path = q.media_path
  where q.id = any(coalesce(p_question_ids, '{}'::bigint[]))
    and q.media_type is not null
    and q.media_path is not null
    and coalesce(a.scan_status, 'legacy') in ('clean', 'legacy')
    and public.can_access_question_media(q.subject_id, q.classroom_id);
$$;

revoke execute on function public.get_question_media_manifest(bigint[]) from public, anon;
grant execute on function public.get_question_media_manifest(bigint[]) to authenticated;

create or replace function public.mark_question_media_orphaned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.media_path is not null then
      update public.question_media_assets
      set attached_question_id = null, orphaned_at = now()
      where path = old.media_path;
    end if;
    return old;
  end if;

  if old.media_path is distinct from new.media_path and old.media_path is not null then
    update public.question_media_assets
    set attached_question_id = null, orphaned_at = now()
    where path = old.media_path;
  end if;

  return new;
end;
$$;

drop trigger if exists mark_question_media_orphaned_update on public.questions;
create trigger mark_question_media_orphaned_update
after update of media_path on public.questions
for each row execute function public.mark_question_media_orphaned();

drop trigger if exists mark_question_media_orphaned_delete on public.questions;
create trigger mark_question_media_orphaned_delete
after delete on public.questions
for each row execute function public.mark_question_media_orphaned();

drop function if exists public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text
);

create or replace function public.save_teacher_question(
  p_subject_id bigint,
  p_question_id bigint default null,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_type text default 'multiple_choice',
  p_text text default '',
  p_points_base integer default 10,
  p_time_limit_seconds integer default 30,
  p_difficulty integer default 1,
  p_explanation text default null,
  p_answers jsonb default '[]'::jsonb,
  p_media_type text default null,
  p_media_url text default null,
  p_media_path text default null,
  p_media_alt_text text default null,
  p_media_caption text default null,
  p_media_duration_seconds numeric default null,
  p_media_transcript text default null,
  p_media_subtitles_vtt text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_question_id bigint;
  v_answer jsonb;
  v_classroom_id bigint;
  v_difficulty integer := coalesce(p_difficulty, 1);
  v_media_type text := nullif(trim(coalesce(p_media_type, '')), '');
  v_media_path text := nullif(trim(coalesce(p_media_path, '')), '');
begin
  if v_teacher_id is null then
    raise exception 'No hay sesión activa.';
  end if;

  if not exists (
    select 1 from public.subjects
    where id = p_subject_id
      and (teacher_id = v_teacher_id or public.is_admin())
  ) then
    raise exception 'No puedes modificar preguntas de este curso.';
  end if;

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1 from public.classrooms
    where id = v_classroom_id
      and subject_id = p_subject_id
      and coalesce(active, true)
  ) then
    raise exception 'La clase seleccionada no pertenece a este curso.';
  end if;

  if p_topic_id is not null and not exists (
    select 1 from public.subject_topics
    where id = p_topic_id
      and subject_id = p_subject_id
      and classroom_id = v_classroom_id
      and coalesce(active, true)
  ) then
    raise exception 'El tema seleccionado no pertenece a esta clase.';
  end if;

  if p_points_base < 1 or p_points_base > 100 then
    raise exception 'Los puntos deben estar entre 1 y 100.';
  end if;

  if p_time_limit_seconds < 5 or p_time_limit_seconds > 300 then
    raise exception 'El tiempo debe estar entre 5 y 300 segundos.';
  end if;

  if v_difficulty not in (1, 2, 3) then
    raise exception 'La dificultad debe ser fácil, medio o difícil.';
  end if;

  if nullif(trim(p_text), '') is null then
    raise exception 'El enunciado de la pregunta es obligatorio.';
  end if;

  if v_media_type is not null and v_media_type not in ('image', 'audio', 'video') then
    raise exception 'El tipo de contenido multimedia no es válido.';
  end if;

  if v_media_type is not null and v_media_path is null then
    raise exception 'El contenido multimedia necesita una ruta privada válida.';
  end if;

  if v_media_path is not null
     and split_part(v_media_path, '/', 1) <> v_teacher_id::text
     and not public.is_admin() then
    raise exception 'El archivo multimedia no pertenece al profesor actual.';
  end if;

  if v_media_path is not null and not exists (
    select 1
    from public.question_media_assets a
    where a.path = v_media_path
      and a.subject_id = p_subject_id
      and a.media_type = v_media_type
      and a.scan_status in ('clean', 'legacy')
      and (a.owner_id = v_teacher_id or public.is_admin())
      and (a.attached_question_id is null or a.attached_question_id = p_question_id)
  ) then
    raise exception 'El archivo multimedia no ha superado la validación de seguridad.';
  end if;

  if v_media_type = 'audio' and (
    p_media_duration_seconds is null
    or p_media_duration_seconds <= 0
    or p_media_duration_seconds > 600
  ) then
    raise exception 'El audio debe durar como máximo 10 minutos.';
  end if;

  if v_media_type = 'video' and (
    p_media_duration_seconds is null
    or p_media_duration_seconds <= 0
    or p_media_duration_seconds > 300
  ) then
    raise exception 'El vídeo debe durar como máximo 5 minutos.';
  end if;

  if v_media_type = 'video'
     and (
       nullif(trim(coalesce(p_media_subtitles_vtt, '')), '') is null
       or upper(left(ltrim(p_media_subtitles_vtt), 6)) <> 'WEBVTT'
       or position('-->' in p_media_subtitles_vtt) = 0
     ) then
    raise exception 'El vídeo necesita subtítulos WebVTT.';
  end if;

  if v_media_type = 'audio'
     and nullif(trim(coalesce(p_media_transcript, '')), '') is null then
    raise exception 'El audio necesita una transcripción.';
  end if;

  if p_question_id is null then
    insert into public.questions (
      subject_id, classroom_id, topic_id, type, text, points_base,
      time_limit_seconds, difficulty, explanation,
      media_type, media_url, media_path, media_alt_text, media_caption
    )
    values (
      p_subject_id, v_classroom_id, p_topic_id, p_type, trim(p_text), p_points_base,
      p_time_limit_seconds, v_difficulty, nullif(trim(coalesce(p_explanation, '')), ''),
      v_media_type, null, v_media_path,
      nullif(trim(coalesce(p_media_alt_text, '')), ''),
      nullif(trim(coalesce(p_media_caption, '')), '')
    )
    returning id into v_question_id;
  else
    update public.questions
    set
      subject_id = p_subject_id,
      classroom_id = v_classroom_id,
      topic_id = p_topic_id,
      type = p_type,
      text = trim(p_text),
      points_base = p_points_base,
      time_limit_seconds = p_time_limit_seconds,
      difficulty = v_difficulty,
      explanation = nullif(trim(coalesce(p_explanation, '')), ''),
      media_type = v_media_type,
      media_url = null,
      media_path = v_media_path,
      media_alt_text = nullif(trim(coalesce(p_media_alt_text, '')), ''),
      media_caption = nullif(trim(coalesce(p_media_caption, '')), '')
    where id = p_question_id
      and subject_id = p_subject_id
      and (
        public.is_admin()
        or exists (
          select 1 from public.subjects
          where subjects.id = questions.subject_id
            and subjects.teacher_id = v_teacher_id
        )
      )
    returning id into v_question_id;

    if v_question_id is null then
      raise exception 'No se encontró la pregunta a editar.';
    end if;

    delete from public.answers where question_id = v_question_id;
  end if;

  if v_media_path is not null then
    update public.question_media_assets
    set
      attached_question_id = v_question_id,
      duration_seconds = p_media_duration_seconds,
      transcript = nullif(trim(coalesce(p_media_transcript, '')), ''),
      subtitles_vtt = nullif(trim(coalesce(p_media_subtitles_vtt, '')), ''),
      orphaned_at = null
    where path = v_media_path;
  end if;

  if jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) = 0 then
    raise exception 'La pregunta necesita al menos una respuesta.';
  end if;

  for v_answer in select value from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) loop
    if nullif(trim(coalesce(v_answer->>'text', '')), '') is null then
      raise exception 'Hay una respuesta vacía.';
    end if;

    insert into public.answers (question_id, text, is_correct, sort_order)
    values (
      v_question_id,
      trim(v_answer->>'text'),
      coalesce((v_answer->>'is_correct')::boolean, false),
      coalesce((v_answer->>'sort_order')::integer, 1)
    );
  end loop;

  return v_question_id;
end;
$$;

revoke all on function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.save_teacher_question(
  bigint, bigint, bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  text, text, text, text, text, numeric, text, text
) to authenticated;
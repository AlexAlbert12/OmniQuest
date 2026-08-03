-- OmniQuest administration hardening: immutable audit, complete support workflow
-- and paged full-text global search.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Resolve pgcrypto independently from the schema where Supabase installed it.
-- Hosted projects normally use `extensions`, while existing/local databases may
-- have installed the extension in another schema.
create or replace function public.admin_sha256_hex(p_value text)
returns text
language plpgsql
stable
strict
set search_path = pg_catalog, public
as $$
declare
  v_extension_schema text;
  v_hash text;
begin
  select namespace.nspname
  into v_extension_schema
  from pg_catalog.pg_extension extension_definition
  join pg_catalog.pg_namespace namespace on namespace.oid = extension_definition.extnamespace
  where extension_definition.extname = 'pgcrypto';

  if v_extension_schema is null then
    raise exception 'The pgcrypto extension is required to calculate the admin audit hash chain';
  end if;

  execute format(
    'select pg_catalog.encode(%I.digest($1::text, ''sha256''::text), ''hex''::text)',
    v_extension_schema
  )
  into v_hash
  using p_value;

  return v_hash;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7.4 Admin audit: server severity, append-only storage, monthly partitions,
-- retention, before/after snapshots and a chained integrity hash.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_settings (
  singleton boolean primary key default true check (singleton),
  retention_months integer not null default 24 check (retention_months between 6 and 120),
  capture_request_context boolean not null default false,
  strong_integrity boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.admin_audit_settings(singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.admin_audit_settings enable row level security;
revoke all on public.admin_audit_settings from public, anon, authenticated;
grant select on public.admin_audit_settings to authenticated;

drop policy if exists "admin_audit_settings_read" on public.admin_audit_settings;
create policy "admin_audit_settings_read"
on public.admin_audit_settings for select to authenticated
using (public.admin_has_permission('audit.read'));

create or replace function public.admin_audit_severity(
  p_action text,
  p_target_table text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when lower(coalesce(p_action, '')) ~ '(delete|remove|purge|critical|breach|integrity|role\.assign|progress\.delete)'
      or lower(coalesce(p_metadata ->> 'severity_hint', '')) = 'critical'
      then 'critical'
    when lower(coalesce(p_action, '')) ~ '(deactivate|archive|restore|reset|transfer|security|bulk|export)'
      or lower(coalesce(p_metadata ->> 'severity_hint', '')) = 'warning'
      then 'warning'
    else 'info'
  end;
$$;

-- Rebuild the audit relation as a partitioned table only once. Existing rows
-- are copied in chronological order and receive their integrity chain.
do $$
declare
  v_exists boolean;
  v_partitioned boolean;
  v_start date;
  v_finish date;
  v_month date;
begin
  select exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'admin_audit_logs'
  ) into v_exists;

  select exists (
    select 1 from pg_partitioned_table pt
    join pg_class c on c.oid = pt.partrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'admin_audit_logs'
  ) into v_partitioned;

  if v_exists and not v_partitioned then
    create sequence if not exists public.admin_audit_partition_id_seq;

    alter table public.admin_audit_logs rename to admin_audit_logs_legacy;

    if to_regclass('public.admin_audit_chain_seq') is null then
      create sequence public.admin_audit_chain_seq;
    end if;

    create table public.admin_audit_logs (
      id bigint not null default nextval('public.admin_audit_partition_id_seq'::regclass),
      chain_seq bigint not null default nextval('public.admin_audit_chain_seq'::regclass),
      admin_id uuid not null references public.profiles(id),
      action text not null,
      target_table text,
      target_id text,
      severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
      metadata jsonb not null default '{}'::jsonb,
      before_state jsonb,
      after_state jsonb,
      previous_hash text,
      chain_hash text,
      request_id uuid,
      ip_hash text,
      user_agent_hash text,
      context_capture_reason text,
      retention_until timestamptz,
      created_at timestamptz not null default now(),
      constraint admin_audit_logs_partitioned_pkey primary key (id, created_at)
    ) partition by range (created_at);

    select least(
      date_trunc('month', coalesce((select min(created_at) from public.admin_audit_logs_legacy), now()))::date,
      (date_trunc('month', now()) - interval '24 months')::date
    ) into v_start;
    v_finish := (date_trunc('month', now()) + interval '7 months')::date;
    v_month := v_start;
    while v_month < v_finish loop
      execute format(
        'create table if not exists public.%I partition of public.admin_audit_logs for values from (%L) to (%L)',
        'admin_audit_logs_' || to_char(v_month, 'YYYY_MM'),
        v_month::timestamptz,
        (v_month + interval '1 month')::timestamptz
      );
      v_month := (v_month + interval '1 month')::date;
    end loop;
    create table if not exists public.admin_audit_logs_default partition of public.admin_audit_logs default;

    insert into public.admin_audit_logs(
      id, admin_id, action, target_table, target_id, severity, metadata,
      before_state, after_state, retention_until, created_at
    )
    select
      legacy.id,
      legacy.admin_id,
      legacy.action,
      legacy.target_table,
      legacy.target_id,
      public.admin_audit_severity(legacy.action, legacy.target_table, legacy.metadata),
      coalesce(legacy.metadata, '{}'::jsonb) - 'before' - 'after',
      case when jsonb_typeof(legacy.metadata -> 'before') = 'object' then legacy.metadata -> 'before' else null end,
      case when jsonb_typeof(legacy.metadata -> 'after') = 'object' then legacy.metadata -> 'after' else null end,
      legacy.created_at + interval '24 months',
      legacy.created_at
    from public.admin_audit_logs_legacy legacy
    order by legacy.created_at, legacy.id;

    perform setval('public.admin_audit_partition_id_seq', greatest(coalesce((select max(id) from public.admin_audit_logs), 0), 1), true);
    drop table public.admin_audit_logs_legacy;
    alter sequence public.admin_audit_partition_id_seq owned by public.admin_audit_logs.id;
  end if;
end;
$$;

-- Compatibility when the relation was already partitioned by a prior deploy.
create sequence if not exists public.admin_audit_chain_seq;
alter table public.admin_audit_logs add column if not exists chain_seq bigint default nextval('public.admin_audit_chain_seq'::regclass);
alter table public.admin_audit_logs add column if not exists severity text not null default 'info';
alter table public.admin_audit_logs add column if not exists before_state jsonb;
alter table public.admin_audit_logs add column if not exists after_state jsonb;
alter table public.admin_audit_logs add column if not exists previous_hash text;
alter table public.admin_audit_logs add column if not exists chain_hash text;
alter table public.admin_audit_logs add column if not exists request_id uuid;
alter table public.admin_audit_logs add column if not exists ip_hash text;
alter table public.admin_audit_logs add column if not exists user_agent_hash text;
alter table public.admin_audit_logs add column if not exists context_capture_reason text;
alter table public.admin_audit_logs add column if not exists retention_until timestamptz;

create index if not exists admin_audit_logs_chain_seq_idx on public.admin_audit_logs(chain_seq);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc, id desc);
create index if not exists admin_audit_logs_action_created_at_idx on public.admin_audit_logs(action, created_at desc);
create index if not exists admin_audit_logs_actor_created_idx on public.admin_audit_logs(admin_id, created_at desc);
create index if not exists admin_audit_logs_target_created_idx on public.admin_audit_logs(target_table, target_id, created_at desc);
create index if not exists admin_audit_logs_severity_created_idx on public.admin_audit_logs(severity, created_at desc);
create index if not exists admin_audit_logs_metadata_gin_idx on public.admin_audit_logs using gin(metadata jsonb_path_ops);

create or replace function public.prepare_admin_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_previous_hash text;
  v_retention_months integer := 24;
  v_capture_context boolean := false;
  v_raw_ip text;
  v_raw_user_agent text;
  v_payload jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('omniquest-admin-audit-chain'));

  select settings.retention_months, settings.capture_request_context
  into v_retention_months, v_capture_context
  from public.admin_audit_settings settings
  where settings.singleton;

  new.created_at := coalesce(new.created_at, now());
  new.chain_seq := coalesce(new.chain_seq, nextval('public.admin_audit_chain_seq'::regclass));
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  if new.before_state is null and jsonb_typeof(new.metadata -> 'before') = 'object' then new.before_state := new.metadata -> 'before'; end if;
  if new.after_state is null and jsonb_typeof(new.metadata -> 'after') = 'object' then new.after_state := new.metadata -> 'after'; end if;

  v_raw_ip := coalesce(new.metadata ->> 'ip', new.metadata ->> 'ip_address');
  v_raw_user_agent := new.metadata ->> 'user_agent';
  new.metadata := new.metadata - 'before' - 'after' - 'ip' - 'ip_address' - 'user_agent';
  new.severity := public.admin_audit_severity(new.action, new.target_table, new.metadata);
  new.retention_until := coalesce(new.retention_until, new.created_at + make_interval(months => v_retention_months));

  if v_capture_context and nullif(trim(new.context_capture_reason), '') is not null then
    new.ip_hash := case when nullif(trim(v_raw_ip), '') is null then null else public.admin_sha256_hex(trim(v_raw_ip)) end;
    new.user_agent_hash := case when nullif(trim(v_raw_user_agent), '') is null then null else public.admin_sha256_hex(trim(v_raw_user_agent)) end;
  else
    new.ip_hash := null;
    new.user_agent_hash := null;
    new.context_capture_reason := null;
  end if;

  select log.chain_hash into v_previous_hash
  from public.admin_audit_logs log
  order by log.chain_seq desc
  limit 1;
  new.previous_hash := v_previous_hash;

  v_payload := jsonb_build_object(
    'chain_seq', new.chain_seq,
    'id', new.id,
    'admin_id', new.admin_id,
    'action', new.action,
    'target_table', new.target_table,
    'target_id', new.target_id,
    'severity', new.severity,
    'metadata', new.metadata,
    'before_state', new.before_state,
    'after_state', new.after_state,
    'request_id', new.request_id,
    'ip_hash', new.ip_hash,
    'user_agent_hash', new.user_agent_hash,
    'context_capture_reason', new.context_capture_reason,
    'retention_until', new.retention_until,
    'created_at', new.created_at
  );
  new.chain_hash := public.admin_sha256_hex(coalesce(v_previous_hash, '') || v_payload::text);
  return new;
end;
$$;

create or replace function public.reject_admin_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_logs is append-only';
end;
$$;

drop trigger if exists prepare_admin_audit_log_trigger on public.admin_audit_logs;
create trigger prepare_admin_audit_log_trigger
before insert on public.admin_audit_logs
for each row execute function public.prepare_admin_audit_log();

drop trigger if exists reject_admin_audit_update_trigger on public.admin_audit_logs;
create trigger reject_admin_audit_update_trigger
before update or delete on public.admin_audit_logs
for each row execute function public.reject_admin_audit_mutation();

create table if not exists public.admin_audit_chain_checkpoints (
  id bigint generated by default as identity primary key,
  partition_name text not null unique,
  first_chain_seq bigint not null,
  last_chain_seq bigint not null,
  row_count bigint not null check (row_count >= 0),
  anchor_hash text,
  final_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_chain_checkpoints enable row level security;
revoke all on public.admin_audit_chain_checkpoints from public, anon, authenticated;
grant select on public.admin_audit_chain_checkpoints to authenticated;
drop policy if exists "admin_audit_checkpoints_read" on public.admin_audit_chain_checkpoints;
create policy "admin_audit_checkpoints_read" on public.admin_audit_chain_checkpoints for select to authenticated using (public.admin_has_permission('audit.read'));
drop trigger if exists reject_admin_audit_checkpoint_mutation_trigger on public.admin_audit_chain_checkpoints;
create trigger reject_admin_audit_checkpoint_mutation_trigger before update or delete on public.admin_audit_chain_checkpoints for each row execute function public.reject_admin_audit_mutation();

-- Backfill hashes when the table was created before this migration's trigger.
do $$
declare
  v_row record;
  v_prev text := null;
  v_hash text;
  v_payload jsonb;
begin
  if exists (select 1 from public.admin_audit_logs where chain_hash is null) then
    alter table public.admin_audit_logs disable trigger reject_admin_audit_update_trigger;
    for v_row in select * from public.admin_audit_logs order by chain_seq, created_at, id loop
      v_payload := jsonb_build_object(
        'chain_seq', v_row.chain_seq, 'id', v_row.id, 'admin_id', v_row.admin_id,
        'action', v_row.action, 'target_table', v_row.target_table, 'target_id', v_row.target_id,
        'severity', public.admin_audit_severity(v_row.action, v_row.target_table, v_row.metadata),
        'metadata', coalesce(v_row.metadata, '{}'::jsonb), 'before_state', v_row.before_state,
        'after_state', v_row.after_state, 'request_id', v_row.request_id,
        'ip_hash', v_row.ip_hash, 'user_agent_hash', v_row.user_agent_hash,
        'context_capture_reason', v_row.context_capture_reason,
        'retention_until', coalesce(v_row.retention_until, v_row.created_at + interval '24 months'),
        'created_at', v_row.created_at
      );
      v_hash := public.admin_sha256_hex(coalesce(v_prev, '') || v_payload::text);
      update public.admin_audit_logs
      set previous_hash = v_prev,
          chain_hash = v_hash,
          severity = public.admin_audit_severity(v_row.action, v_row.target_table, v_row.metadata),
          retention_until = coalesce(v_row.retention_until, v_row.created_at + interval '24 months')
      where id = v_row.id and created_at = v_row.created_at;
      v_prev := v_hash;
    end loop;
    alter table public.admin_audit_logs enable trigger reject_admin_audit_update_trigger;
  end if;
end;
$$;

alter table public.admin_audit_logs enable row level security;
revoke insert, update, delete on public.admin_audit_logs from authenticated;
grant select on public.admin_audit_logs to authenticated;
grant select, insert on public.admin_audit_logs to service_role;
grant usage, select on sequence public.admin_audit_chain_seq to service_role;
do $$ begin if to_regclass('public.admin_audit_partition_id_seq') is not null then execute 'grant usage, select on sequence public.admin_audit_partition_id_seq to service_role'; end if; end $$;

drop policy if exists "admin_select_admin_audit_logs" on public.admin_audit_logs;
create policy "admin_select_admin_audit_logs"
on public.admin_audit_logs for select to authenticated
using (public.admin_has_permission('audit.read'));

create or replace function public.get_admin_audit_policy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.admin_has_permission('audit.read') then raise exception 'Admin permission required'; end if;
  select jsonb_build_object(
    'retention_months', retention_months,
    'capture_request_context', capture_request_context,
    'strong_integrity', strong_integrity,
    'append_only', true,
    'partitioned', true,
    'context_storage', 'hashed_only',
    'retention_checkpoints', true
  ) into v_result from public.admin_audit_settings where singleton;
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.verify_admin_audit_chain(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_expected_previous text := null;
  v_expected_hash text;
  v_anchor_hash text;
  v_checkpoint_hash text;
  v_checkpoint_consistent boolean := true;
  v_first_chain_seq bigint;
  v_first_row_id bigint;
  v_payload jsonb;
  v_checked bigint := 0;
  v_first_invalid bigint := null;
begin
  if not public.admin_has_permission('audit.read') then raise exception 'Admin permission required'; end if;

  select log.previous_hash, log.chain_seq, log.id into v_expected_previous, v_first_chain_seq, v_first_row_id
  from public.admin_audit_logs log
  where (p_from is null or log.created_at >= p_from) and (p_to is null or log.created_at <= p_to)
  order by log.chain_seq
  limit 1;
  v_anchor_hash := v_expected_previous;

  if p_from is null and v_first_chain_seq is not null then
    select checkpoint.final_hash into v_checkpoint_hash
    from public.admin_audit_chain_checkpoints checkpoint
    where checkpoint.last_chain_seq < v_first_chain_seq
    order by checkpoint.last_chain_seq desc
    limit 1;
    if v_checkpoint_hash is not null and v_expected_previous is distinct from v_checkpoint_hash then
      v_checkpoint_consistent := false;
      v_first_invalid := v_first_row_id;
    end if;
  end if;

  for v_row in
    select * from public.admin_audit_logs log
    where (p_from is null or log.created_at >= p_from)
      and (p_to is null or log.created_at <= p_to)
    order by log.chain_seq
  loop
    v_payload := jsonb_build_object(
      'chain_seq', v_row.chain_seq, 'id', v_row.id, 'admin_id', v_row.admin_id,
      'action', v_row.action, 'target_table', v_row.target_table, 'target_id', v_row.target_id,
      'severity', v_row.severity, 'metadata', v_row.metadata,
      'before_state', v_row.before_state, 'after_state', v_row.after_state,
      'request_id', v_row.request_id, 'ip_hash', v_row.ip_hash,
      'user_agent_hash', v_row.user_agent_hash,
      'context_capture_reason', v_row.context_capture_reason,
      'retention_until', v_row.retention_until, 'created_at', v_row.created_at
    );
    v_expected_hash := public.admin_sha256_hex(coalesce(v_expected_previous, '') || v_payload::text);
    v_checked := v_checked + 1;
    if v_first_invalid is null and (v_row.previous_hash is distinct from v_expected_previous or v_row.chain_hash is distinct from v_expected_hash) then
      v_first_invalid := v_row.id;
    end if;
    v_expected_previous := v_row.chain_hash;
  end loop;

  return jsonb_build_object(
    'valid', v_first_invalid is null,
    'checked_rows', v_checked,
    'first_invalid_id', v_first_invalid,
    'verified_at', now(),
    'anchor_hash', v_anchor_hash,
    'checkpoint_consistent', v_checkpoint_consistent
  );
end;
$$;

create or replace function public.maintain_admin_audit_partitions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_retention integer := 24;
  v_partition record;
  v_partition_month date;
  v_created integer := 0;
  v_dropped integer := 0;
  v_first_chain_seq bigint;
  v_last_chain_seq bigint;
  v_partition_rows bigint;
  v_anchor_hash text;
  v_final_hash text;
begin
  select retention_months into v_retention from public.admin_audit_settings where singleton;
  for i in 0..6 loop
    execute format(
      'create table if not exists public.%I partition of public.admin_audit_logs for values from (%L) to (%L)',
      'admin_audit_logs_' || to_char(v_month + make_interval(months => i), 'YYYY_MM'),
      (v_month + make_interval(months => i))::timestamptz,
      (v_month + make_interval(months => i + 1))::timestamptz
    );
    v_created := v_created + 1;
  end loop;

  for v_partition in
    select child.relname
    from pg_inherits inheritance
    join pg_class parent on parent.oid = inheritance.inhparent
    join pg_class child on child.oid = inheritance.inhrelid
    join pg_namespace namespace on namespace.oid = child.relnamespace
    where parent.oid = 'public.admin_audit_logs'::regclass
      and namespace.nspname = 'public'
      and child.relname ~ '^admin_audit_logs_[0-9]{4}_[0-9]{2}$'
  loop
    v_partition_month := to_date(substring(v_partition.relname from '([0-9]{4}_[0-9]{2})$'), 'YYYY_MM');
    if v_partition_month < (date_trunc('month', now()) - make_interval(months => v_retention))::date then
      execute format('select count(*), min(chain_seq), max(chain_seq) from public.%I', v_partition.relname) into v_partition_rows, v_first_chain_seq, v_last_chain_seq;
      if v_partition_rows > 0 then
        execute format('select previous_hash from public.%I order by chain_seq asc limit 1', v_partition.relname) into v_anchor_hash;
        execute format('select chain_hash from public.%I order by chain_seq desc limit 1', v_partition.relname) into v_final_hash;
        insert into public.admin_audit_chain_checkpoints(partition_name, first_chain_seq, last_chain_seq, row_count, anchor_hash, final_hash)
        values (v_partition.relname, v_first_chain_seq, v_last_chain_seq, v_partition_rows, v_anchor_hash, v_final_hash)
        on conflict (partition_name) do nothing;
      end if;
      execute format('drop table if exists public.%I', v_partition.relname);
      v_dropped := v_dropped + 1;
    end if;
  end loop;
  return jsonb_build_object('created_or_checked', v_created, 'dropped', v_dropped, 'retention_months', v_retention);
end;
$$;

-- Schedule maintenance only when pg_cron is installed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'maintain-admin-audit-partitions';
    perform cron.schedule('maintain-admin-audit-partitions', '17 2 * * *', 'select public.maintain_admin_audit_partitions();');
  end if;
exception when undefined_table or undefined_function then null;
end;
$$;

drop function if exists public.get_admin_audit_logs_page(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer);
create function public.get_admin_audit_logs_page(
  p_search text default null,
  p_actor_id uuid default null,
  p_action text default null,
  p_target_table text default null,
  p_target_id text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_severity text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  chain_seq bigint,
  admin_id uuid,
  actor_alias text,
  actor_email text,
  action text,
  target_table text,
  target_id text,
  severity text,
  metadata jsonb,
  before_state jsonb,
  after_state jsonb,
  previous_hash text,
  chain_hash text,
  retention_until timestamptz,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_severity text := nullif(lower(trim(coalesce(p_severity, ''))), '');
begin
  if not public.admin_has_permission('audit.read') then raise exception 'Admin permission required'; end if;
  return query
  with filtered as (
    select log.*, profile.alias as actor_alias, profile.email as actor_email
    from public.admin_audit_logs log
    left join public.profiles profile on profile.id = log.admin_id
    where (p_actor_id is null or log.admin_id = p_actor_id)
      and (nullif(trim(coalesce(p_action, '')), '') is null or log.action = p_action)
      and (nullif(trim(coalesce(p_target_table, '')), '') is null or log.target_table = p_target_table)
      and (nullif(trim(coalesce(p_target_id, '')), '') is null or log.target_id = p_target_id)
      and (p_from is null or log.created_at >= p_from)
      and (p_to is null or log.created_at <= p_to)
      and (v_severity is null or log.severity = v_severity)
      and (v_search is null or concat_ws(' ', log.action, log.target_table, log.target_id, log.metadata::text, log.before_state::text, log.after_state::text, profile.alias, profile.email) ilike '%' || v_search || '%')
  )
  select filtered.id, filtered.chain_seq, filtered.admin_id, filtered.actor_alias, filtered.actor_email,
    filtered.action, filtered.target_table, filtered.target_id, filtered.severity, filtered.metadata,
    filtered.before_state, filtered.after_state, filtered.previous_hash, filtered.chain_hash,
    filtered.retention_until, filtered.created_at, count(*) over()::bigint
  from filtered
  order by filtered.created_at desc, filtered.id desc
  limit v_limit offset v_offset;
end;
$$;

drop function if exists public.get_admin_audit_logs_page_secured(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer);
create function public.get_admin_audit_logs_page_secured(
  p_search text default null,
  p_actor_id uuid default null,
  p_action text default null,
  p_target_table text default null,
  p_target_id text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_severity text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  chain_seq bigint,
  admin_id uuid,
  actor_alias text,
  actor_email text,
  action text,
  target_table text,
  target_id text,
  severity text,
  metadata jsonb,
  before_state jsonb,
  after_state jsonb,
  previous_hash text,
  chain_hash text,
  retention_until timestamptz,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission('audit.read') then raise exception 'Admin permission required'; end if;
  return query select * from public.get_admin_audit_logs_page(p_search, p_actor_id, p_action, p_target_table, p_target_id, p_from, p_to, p_severity, p_limit, p_offset);
end;
$$;

revoke all on function public.get_admin_audit_policy() from public, anon;
revoke all on function public.verify_admin_audit_chain(timestamptz, timestamptz) from public, anon;
revoke all on function public.maintain_admin_audit_partitions() from public, anon, authenticated;
revoke all on function public.get_admin_audit_logs_page(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_admin_audit_logs_page_secured(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.get_admin_audit_policy() to authenticated;
grant execute on function public.verify_admin_audit_chain(timestamptz, timestamptz) to authenticated;
grant execute on function public.maintain_admin_audit_partitions() to service_role;
grant execute on function public.get_admin_audit_logs_page_secured(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7.5 Support: assignment, internal comments, tags, templates, auto-priority,
-- SLA state, attachments for admins and a protected change history.
-- ---------------------------------------------------------------------------

alter table public.support_ticket_messages add column if not exists is_internal boolean not null default false;
alter table public.user_support_tickets add column if not exists priority_source text not null default 'user';
alter table public.user_support_tickets add column if not exists auto_priority_score integer not null default 0;
alter table public.user_support_tickets add column if not exists last_internal_note_at timestamptz;

alter table public.user_support_tickets drop constraint if exists user_support_tickets_priority_source_check;
alter table public.user_support_tickets add constraint user_support_tickets_priority_source_check check (priority_source in ('user', 'automatic', 'admin'));

-- Replace the broad legacy admin policy with the portal permission model.
drop policy if exists "admin_select_user_support_tickets" on public.user_support_tickets;
create policy "admin_select_user_support_tickets"
on public.user_support_tickets for select to authenticated
using (public.admin_has_permission('support.read'));

create table if not exists public.support_tags (
  id bigint generated by default as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9_-]{2,40}$'),
  label text not null,
  color text not null default '#64748B',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.support_ticket_tags (
  ticket_id bigint not null references public.user_support_tickets(id) on delete cascade,
  tag_id bigint not null references public.support_tags(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (ticket_id, tag_id)
);

create table if not exists public.support_response_templates (
  id bigint generated by default as identity primary key,
  title text not null,
  body text not null check (char_length(trim(body)) between 2 and 10000),
  category text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_history (
  id bigint generated by default as identity primary key,
  ticket_id bigint not null references public.user_support_tickets(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_tags_tag_idx on public.support_ticket_tags(tag_id, ticket_id);
create index if not exists support_ticket_history_ticket_idx on public.support_ticket_history(ticket_id, created_at desc, id desc);
create index if not exists support_tickets_assignee_status_idx on public.user_support_tickets(assigned_admin_id, status, updated_at desc);
create index if not exists support_messages_internal_idx on public.support_ticket_messages(ticket_id, is_internal, id);

insert into public.support_tags(slug, label, color)
values
  ('acceso', 'Acceso', '#EF4444'),
  ('contenido', 'Contenido', '#8B5CF6'),
  ('incidencia', 'Incidencia', '#F59E0B'),
  ('consulta', 'Consulta', '#3B82F6'),
  ('seguimiento', 'Seguimiento', '#10B981')
on conflict (slug) do nothing;

insert into public.support_response_templates(title, body, category)
select source.title, source.body, source.category
from (values
  ('Solicitud recibida', 'Hemos recibido tu solicitud y la estamos revisando. Te informaremos de los siguientes pasos en esta misma conversación.', null::text),
  ('Información adicional', 'Para poder continuar, necesitamos que nos facilites más información sobre el problema y, si es posible, una captura o documento de apoyo.', null::text),
  ('Incidencia resuelta', 'La incidencia ha sido corregida. Revisa de nuevo la operación y responde a este ticket si el problema continúa.', 'plataforma'::text)
) as source(title, body, category)
where not exists (select 1 from public.support_response_templates template where template.title = source.title);

alter table public.support_tags enable row level security;
alter table public.support_ticket_tags enable row level security;
alter table public.support_response_templates enable row level security;
alter table public.support_ticket_history enable row level security;

revoke all on public.support_tags, public.support_ticket_tags, public.support_response_templates, public.support_ticket_history from public, anon, authenticated;
grant select on public.support_tags, public.support_response_templates to authenticated;
grant select on public.support_ticket_tags, public.support_ticket_history to authenticated;

drop policy if exists "support_tags_admin_read" on public.support_tags;
create policy "support_tags_admin_read" on public.support_tags for select to authenticated using (public.admin_has_permission('support.read'));
drop policy if exists "support_ticket_tags_admin_read" on public.support_ticket_tags;
create policy "support_ticket_tags_admin_read" on public.support_ticket_tags for select to authenticated using (public.admin_has_permission('support.read'));
drop policy if exists "support_templates_admin_read" on public.support_response_templates;
create policy "support_templates_admin_read" on public.support_response_templates for select to authenticated using (public.admin_has_permission('support.read'));
drop policy if exists "support_history_admin_read" on public.support_ticket_history;
create policy "support_history_admin_read" on public.support_ticket_history for select to authenticated using (public.admin_has_permission('support.read'));

create or replace function public.reject_support_history_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'support_ticket_history entries cannot be updated';
end;
$$;

drop trigger if exists support_history_append_only_trigger on public.support_ticket_history;
drop trigger if exists support_history_no_update_trigger on public.support_ticket_history;
create trigger support_history_no_update_trigger
before update on public.support_ticket_history
for each row execute function public.reject_support_history_update();

create or replace function public.support_priority_score(p_subject text, p_message text, p_category text)
returns integer
language sql
immutable
as $$
  select least(100,
    case when lower(coalesce(p_subject, '') || ' ' || coalesce(p_message, '')) ~ '(no puedo acceder|bloquead|seguridad|datos personales|pérdida|eliminad|urgente|examen|evaluación)' then 55 else 0 end
    + case when lower(coalesce(p_subject, '') || ' ' || coalesce(p_message, '')) ~ '(error|fallo|no funciona|incidencia|imposible)' then 25 else 0 end
    + case when lower(coalesce(p_category, '')) = 'cuenta' then 15 when lower(coalesce(p_category, '')) = 'plataforma' then 10 else 0 end
  );
$$;

create or replace function public.prepare_support_ticket_priority_and_sla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer;
  v_auto_priority text;
begin
  v_score := public.support_priority_score(new.subject, new.message, new.category);
  v_auto_priority := case when v_score >= 70 then 'high' when v_score >= 35 then 'medium' else 'low' end;
  new.auto_priority_score := v_score;
  if tg_op = 'INSERT' and (
    (v_auto_priority = 'high' and coalesce(new.priority, 'low') <> 'high')
    or (v_auto_priority = 'medium' and coalesce(new.priority, 'low') = 'low')
  ) then
    new.priority := v_auto_priority;
    new.priority_source := 'automatic';
  else
    new.priority := coalesce(new.priority, 'medium');
    new.priority_source := coalesce(new.priority_source, 'user');
  end if;
  new.first_response_due_at := coalesce(new.first_response_due_at, coalesce(new.created_at, now()) + public.support_first_response_interval(new.priority));
  new.resolution_due_at := coalesce(new.resolution_due_at, coalesce(new.created_at, now()) + public.support_resolution_interval(new.priority));
  return new;
end;
$$;

drop trigger if exists prepare_support_ticket_sla_trigger on public.user_support_tickets;
drop trigger if exists prepare_support_ticket_priority_and_sla_trigger on public.user_support_tickets;
create trigger prepare_support_ticket_priority_and_sla_trigger
before insert on public.user_support_tickets
for each row execute function public.prepare_support_ticket_priority_and_sla();

update public.user_support_tickets
set auto_priority_score = public.support_priority_score(subject, message, category)
where auto_priority_score = 0;

-- Users must never see internal comments through table RLS.
drop policy if exists "support_messages_select_participants" on public.support_ticket_messages;
create policy "support_messages_select_participants"
on public.support_ticket_messages for select to authenticated
using (
  public.admin_has_permission('support.read')
  or (
    not is_internal
    and exists (select 1 from public.user_support_tickets ticket where ticket.id = support_ticket_messages.ticket_id and ticket.user_id = auth.uid())
  )
);

-- Internal notes are not user activity and must never reopen a ticket or update
-- the public last-response timestamp.
create or replace function public.on_support_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.user_support_tickets%rowtype;
  v_admin record;
begin
  if coalesce(new.is_internal, false) then return new; end if;

  update public.user_support_tickets
  set last_response_at = new.created_at,
      status = case when new.author_role in ('student', 'teacher') and status = 'resolved' then 'open' else status end,
      resolved_at = case when new.author_role in ('student', 'teacher') and status = 'resolved' then null else resolved_at end,
      updated_at = now()
  where id = new.ticket_id
  returning * into v_ticket;

  if new.author_role in ('student', 'teacher') then
    insert into public.support_ticket_history(ticket_id, changed_by, event_type, after_state)
    values (new.ticket_id, new.author_id, 'user_reply', jsonb_build_object('message_id', new.id, 'status', v_ticket.status));
    for v_admin in
      select profile.id
      from public.profiles profile
      left join public.admin_role_assignments assignment on assignment.user_id = profile.id
      left join public.admin_roles role on role.id = assignment.role_id
      where profile.role_id = 'admin'
        and coalesce(profile.active, true)
        and (assignment.user_id is null or 'support.read' = any(coalesce(role.permissions, '{}'::text[])))
    loop
      perform public.create_notification(
        v_admin.id, 'admin', 'announcement', 'Nueva respuesta de soporte',
        format('El ticket #%s, "%s", tiene actividad nueva.', v_ticket.id, v_ticket.subject),
        'chatbubble-ellipses-outline', '#8B5CF6', '/(admin)/support?ticket=' || v_ticket.id::text,
        'user_support_tickets', v_ticket.id::text,
        jsonb_build_object('ticket_id', v_ticket.id, 'preference_category', 'system'),
        'support-message:' || new.id::text || ':admin:' || v_admin.id::text
      );
    end loop;
  end if;
  return new;
end;
$$;

-- Admins can upload attachments to tickets assigned to the support queue.
-- Attachments linked to internal notes remain invisible to ticket owners.
drop policy if exists "support_attachments_select_participants" on public.support_ticket_attachments;
create policy "support_attachments_select_participants"
on public.support_ticket_attachments for select to authenticated
using (
  public.admin_has_permission('support.read')
  or (
    exists (select 1 from public.user_support_tickets ticket where ticket.id = support_ticket_attachments.ticket_id and ticket.user_id = auth.uid())
    and (
      support_ticket_attachments.message_id is null
      or exists (select 1 from public.support_ticket_messages message where message.id = support_ticket_attachments.message_id and not message.is_internal)
    )
  )
);

drop policy if exists "support_attachments_insert_owner" on public.support_ticket_attachments;
create policy "support_attachments_insert_owner"
on public.support_ticket_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    public.admin_has_permission('support.manage')
    or exists (select 1 from public.user_support_tickets ticket where ticket.id = support_ticket_attachments.ticket_id and ticket.user_id = auth.uid() and ticket.status <> 'closed')
  )
  and (support_ticket_attachments.message_id is null or exists (
    select 1 from public.support_ticket_messages message where message.id = support_ticket_attachments.message_id and message.ticket_id = support_ticket_attachments.ticket_id
  ))
);

drop policy if exists "support_attachments_storage_select_participants" on storage.objects;
create policy "support_attachments_storage_select_participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and exists (
    select 1
    from public.support_ticket_attachments attachment
    join public.user_support_tickets ticket on ticket.id = attachment.ticket_id
    left join public.support_ticket_messages message on message.id = attachment.message_id
    where attachment.storage_path = name
      and (public.admin_has_permission('support.read') or (ticket.user_id = auth.uid() and coalesce(message.is_internal, false) = false))
  )
);

drop policy if exists "support_attachments_storage_insert_owner" on storage.objects;
create policy "support_attachments_storage_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.admin_has_permission('support.manage')
    or exists (
      select 1 from public.user_support_tickets ticket
      where ticket.id = split_part(name, '/', 1)::bigint and ticket.user_id = auth.uid() and ticket.status <> 'closed'
    )
  )
);

create or replace function public.on_support_attachment_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_ticket_history(ticket_id, changed_by, event_type, after_state)
  values (new.ticket_id, new.uploaded_by, 'attachment_added', jsonb_build_object('attachment_id', new.id, 'message_id', new.message_id, 'file_name', new.file_name, 'mime_type', new.mime_type, 'size_bytes', new.size_bytes));
  return new;
end;
$$;

drop trigger if exists support_attachment_history_trigger on public.support_ticket_attachments;
create trigger support_attachment_history_trigger
after insert on public.support_ticket_attachments
for each row execute function public.on_support_attachment_history();

create or replace function public.get_admin_support_directory()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.admin_has_permission('support.read') then raise exception 'Admin permission required'; end if;
  select jsonb_build_object(
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile.id, 'alias', profile.alias, 'email', profile.email) order by profile.alias)
      from public.profiles profile
      left join public.admin_role_assignments assignment on assignment.user_id = profile.id
      left join public.admin_roles role on role.id = assignment.role_id
      where profile.role_id = 'admin'
        and coalesce(profile.active, true)
        and (assignment.user_id is null or 'support.manage' = any(coalesce(role.permissions, '{}'::text[])))
    ), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(to_jsonb(tag) order by tag.label) from public.support_tags tag where tag.active), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(template) order by template.title) from public.support_response_templates template where template.active), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_support_thread_page(
  p_ticket_id bigint,
  p_limit integer default 30,
  p_before_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.admin_has_permission('support.read');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_result jsonb;
begin
  if not exists (
    select 1 from public.user_support_tickets ticket
    where ticket.id = p_ticket_id and (ticket.user_id = v_user_id or v_is_admin)
  ) then raise exception 'Support ticket access denied'; end if;

  with candidates as (
    select message.* from public.support_ticket_messages message
    where message.ticket_id = p_ticket_id
      and (v_is_admin or not message.is_internal)
      and (p_before_id is null or message.id < p_before_id)
    order by message.id desc limit v_limit + 1
  ), page_desc as (
    select * from candidates order by id desc limit v_limit
  ), page as (
    select * from page_desc order by id asc
  )
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from page), '[]'::jsonb),
    'attachments', coalesce((select jsonb_agg(to_jsonb(attachment) order by attachment.created_at, attachment.id) from public.support_ticket_attachments attachment where attachment.ticket_id = p_ticket_id and (attachment.message_id is null or attachment.message_id in (select page.id from page))), '[]'::jsonb),
    'history', case when v_is_admin then coalesce((select jsonb_agg(to_jsonb(history) order by history.created_at desc, history.id desc) from (select * from public.support_ticket_history where ticket_id = p_ticket_id order by created_at desc, id desc limit 100) history), '[]'::jsonb) else '[]'::jsonb end,
    'tags', case when v_is_admin then coalesce((select jsonb_agg(jsonb_build_object('id', tag.id, 'slug', tag.slug, 'label', tag.label, 'color', tag.color) order by tag.label) from public.support_ticket_tags link join public.support_tags tag on tag.id = link.tag_id where link.ticket_id = p_ticket_id), '[]'::jsonb) else '[]'::jsonb end,
    'has_more', (select count(*) > v_limit from candidates),
    'next_before_id', (select min(id) from page)
  ) into v_result;
  return coalesce(v_result, jsonb_build_object('messages', '[]'::jsonb, 'attachments', '[]'::jsonb, 'history', '[]'::jsonb, 'tags', '[]'::jsonb, 'has_more', false, 'next_before_id', null));
end;
$$;

drop function if exists public.get_admin_support_tickets_page(text, text, text, text, integer, integer);
create function public.get_admin_support_tickets_page(
  p_search text default null,
  p_status text default null,
  p_priority text default null,
  p_role text default null,
  p_assigned_admin_id uuid default null,
  p_tag text default null,
  p_sla_state text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  user_id uuid,
  user_alias text,
  user_email text,
  role text,
  category text,
  subject text,
  message text,
  contact_email text,
  priority text,
  priority_source text,
  auto_priority_score integer,
  status text,
  admin_response text,
  assigned_admin_id uuid,
  assigned_admin_alias text,
  tags jsonb,
  sla_state text,
  resolved_at timestamptz,
  last_response_at timestamptz,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  message_count bigint,
  attachment_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
  v_priority text := nullif(lower(trim(coalesce(p_priority, ''))), '');
  v_role text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_tag text := nullif(lower(trim(coalesce(p_tag, ''))), '');
  v_sla text := nullif(lower(trim(coalesce(p_sla_state, ''))), '');
begin
  if not public.admin_has_permission('support.read') then raise exception 'Admin permission required'; end if;
  return query
  with enriched as (
    select ticket.*, profile.alias as user_alias, profile.email as user_email,
      assignee.alias as assigned_admin_alias,
      coalesce((select jsonb_agg(jsonb_build_object('id', tag.id, 'slug', tag.slug, 'label', tag.label, 'color', tag.color) order by tag.label) from public.support_ticket_tags link join public.support_tags tag on tag.id = link.tag_id where link.ticket_id = ticket.id), '[]'::jsonb) as ticket_tags,
      case
        when ticket.first_responded_at is not null and ticket.first_response_due_at is not null and ticket.first_responded_at > ticket.first_response_due_at then 'breached'
        when ticket.resolved_at is not null and ticket.resolution_due_at is not null and ticket.resolved_at > ticket.resolution_due_at then 'breached'
        when ticket.first_responded_at is null and ticket.first_response_due_at < now() then 'breached'
        when ticket.resolved_at is null and ticket.resolution_due_at < now() then 'breached'
        when ticket.status in ('resolved', 'closed') then 'completed'
        when (ticket.first_responded_at is null and ticket.first_response_due_at < now() + interval '2 hours') or (ticket.resolved_at is null and ticket.resolution_due_at < now() + interval '4 hours') then 'at_risk'
        else 'on_track'
      end as computed_sla_state
    from public.user_support_tickets ticket
    left join public.profiles profile on profile.id = ticket.user_id
    left join public.profiles assignee on assignee.id = ticket.assigned_admin_id
  ), filtered as (
    select enriched.* from enriched
    where (v_status is null or enriched.status = v_status)
      and (v_priority is null or enriched.priority = v_priority)
      and (v_role is null or enriched.role = v_role)
      and (p_assigned_admin_id is null or enriched.assigned_admin_id = p_assigned_admin_id)
      and (v_tag is null or exists (select 1 from jsonb_array_elements(enriched.ticket_tags) item where item ->> 'slug' = v_tag))
      and (v_sla is null or enriched.computed_sla_state = v_sla)
      and (v_search is null or concat_ws(' ', enriched.subject, enriched.message, enriched.category, enriched.contact_email, enriched.admin_response, enriched.user_alias, enriched.user_email, enriched.assigned_admin_alias, enriched.ticket_tags::text) ilike '%' || v_search || '%')
  )
  select filtered.id, filtered.user_id, filtered.user_alias, filtered.user_email, filtered.role, filtered.category,
    filtered.subject, filtered.message, filtered.contact_email, filtered.priority, filtered.priority_source,
    filtered.auto_priority_score, filtered.status, filtered.admin_response, filtered.assigned_admin_id,
    filtered.assigned_admin_alias, filtered.ticket_tags, filtered.computed_sla_state, filtered.resolved_at,
    filtered.last_response_at, filtered.first_response_due_at, filtered.resolution_due_at,
    filtered.first_responded_at,
    (select count(*) from public.support_ticket_messages support_message where support_message.ticket_id = filtered.id),
    (select count(*) from public.support_ticket_attachments attachment where attachment.ticket_id = filtered.id),
    filtered.created_at, filtered.updated_at, count(*) over()::bigint
  from filtered
  order by
    case filtered.computed_sla_state when 'breached' then 1 when 'at_risk' then 2 else 3 end,
    case filtered.priority when 'high' then 1 when 'medium' then 2 else 3 end,
    case filtered.status when 'open' then 1 when 'in_progress' then 2 when 'resolved' then 3 else 4 end,
    filtered.updated_at desc, filtered.id desc
  limit v_limit offset v_offset;
end;
$$;

drop function if exists public.get_admin_support_tickets_page_secured(text, text, text, text, integer, integer);
drop function if exists public.get_admin_support_tickets_page_secured(text, text, text, text, uuid, text, text, integer, integer);
create function public.get_admin_support_tickets_page_secured(
  p_search text default null,
  p_status text default null,
  p_priority text default null,
  p_role text default null,
  p_assigned_admin_id uuid default null,
  p_tag text default null,
  p_sla_state text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  user_id uuid,
  user_alias text,
  user_email text,
  role text,
  category text,
  subject text,
  message text,
  contact_email text,
  priority text,
  priority_source text,
  auto_priority_score integer,
  status text,
  admin_response text,
  assigned_admin_id uuid,
  assigned_admin_alias text,
  tags jsonb,
  sla_state text,
  resolved_at timestamptz,
  last_response_at timestamptz,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  message_count bigint,
  attachment_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission('support.read') then raise exception 'Admin permission required'; end if;
  return query select * from public.get_admin_support_tickets_page(p_search, p_status, p_priority, p_role, p_assigned_admin_id, p_tag, p_sla_state, p_limit, p_offset);
end;
$$;

drop function if exists public.admin_update_support_ticket_secured(bigint, text, text, text);
create function public.admin_update_support_ticket_secured(
  p_ticket_id bigint,
  p_status text,
  p_priority text default null,
  p_public_response text default null,
  p_internal_comment text default null,
  p_assigned_admin_id uuid default null,
  p_tag_slugs text[] default null,
  p_template_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_before public.user_support_tickets%rowtype;
  v_after public.user_support_tickets%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_priority text := nullif(lower(trim(coalesce(p_priority, ''))), '');
  v_response text := nullif(trim(coalesce(p_public_response, '')), '');
  v_internal text := nullif(trim(coalesce(p_internal_comment, '')), '');
  v_template_body text;
  v_public_message_id bigint;
  v_internal_message_id bigint;
  v_audience text;
  v_action_url text;
  v_before_tags text[] := '{}'::text[];
  v_after_tags text[] := '{}'::text[];
  v_ticket_changed boolean := false;
begin
  if not public.admin_has_permission('support.manage') then raise exception 'Admin permission required'; end if;
  if v_status not in ('open', 'in_progress', 'resolved', 'closed') then raise exception 'Invalid support status'; end if;
  if v_priority is not null and v_priority not in ('low', 'medium', 'high') then raise exception 'Invalid support priority'; end if;
  if p_assigned_admin_id is not null and not exists (
    select 1
    from public.profiles profile
    left join public.admin_role_assignments assignment on assignment.user_id = profile.id
    left join public.admin_roles role on role.id = assignment.role_id
    where profile.id = p_assigned_admin_id
      and profile.role_id = 'admin'
      and coalesce(profile.active, true)
      and (assignment.user_id is null or 'support.manage' = any(coalesce(role.permissions, '{}'::text[])))
  ) then raise exception 'Invalid admin assignee'; end if;

  select * into v_before from public.user_support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Support ticket not found'; end if;
  select coalesce(array_agg(tag.slug order by tag.slug), '{}'::text[]) into v_before_tags from public.support_ticket_tags link join public.support_tags tag on tag.id = link.tag_id where link.ticket_id = p_ticket_id;

  if v_response is null and p_template_id is not null then
    select body into v_template_body from public.support_response_templates where id = p_template_id and active;
    v_response := nullif(trim(v_template_body), '');
  end if;

  update public.user_support_tickets ticket
  set status = v_status,
      priority = coalesce(v_priority, ticket.priority),
      priority_source = case when v_priority is not null then 'admin' else ticket.priority_source end,
      admin_response = coalesce(v_response, ticket.admin_response),
      assigned_admin_id = coalesce(p_assigned_admin_id, ticket.assigned_admin_id, v_admin_id),
      first_responded_at = case when v_response is not null then coalesce(ticket.first_responded_at, now()) else ticket.first_responded_at end,
      last_response_at = case when v_response is not null then now() else ticket.last_response_at end,
      last_internal_note_at = case when v_internal is not null then now() else ticket.last_internal_note_at end,
      first_response_due_at = case when v_priority is not null and ticket.first_responded_at is null then ticket.created_at + public.support_first_response_interval(v_priority) else ticket.first_response_due_at end,
      resolution_due_at = case when v_priority is not null and ticket.resolved_at is null then ticket.created_at + public.support_resolution_interval(v_priority) else ticket.resolution_due_at end,
      resolved_at = case when v_status in ('resolved', 'closed') then coalesce(ticket.resolved_at, now()) else null end,
      updated_at = now()
  where ticket.id = p_ticket_id
  returning * into v_after;

  if v_response is not null then
    insert into public.support_ticket_messages(ticket_id, author_id, author_role, body, is_internal)
    values (p_ticket_id, v_admin_id, 'admin', v_response, false) returning id into v_public_message_id;
  end if;
  if v_internal is not null then
    insert into public.support_ticket_messages(ticket_id, author_id, author_role, body, is_internal)
    values (p_ticket_id, v_admin_id, 'admin', v_internal, true) returning id into v_internal_message_id;
  end if;

  if p_tag_slugs is not null then
    delete from public.support_ticket_tags where ticket_id = p_ticket_id;
    insert into public.support_ticket_tags(ticket_id, tag_id, added_by)
    select p_ticket_id, tag.id, v_admin_id from public.support_tags tag
    where tag.active and tag.slug = any(p_tag_slugs)
    on conflict do nothing;
  end if;

  select coalesce(array_agg(tag.slug order by tag.slug), '{}'::text[]) into v_after_tags from public.support_ticket_tags link join public.support_tags tag on tag.id = link.tag_id where link.ticket_id = p_ticket_id;
  v_ticket_changed := v_before.status is distinct from v_after.status or v_before.priority is distinct from v_after.priority or v_before.assigned_admin_id is distinct from v_after.assigned_admin_id or v_before_tags is distinct from v_after_tags;

  if v_ticket_changed then
    insert into public.support_ticket_history(ticket_id, changed_by, event_type, before_state, after_state)
    values (p_ticket_id, v_admin_id, 'ticket_updated', jsonb_build_object('status', v_before.status, 'priority', v_before.priority, 'assigned_admin_id', v_before.assigned_admin_id, 'tags', to_jsonb(v_before_tags)), jsonb_build_object('status', v_after.status, 'priority', v_after.priority, 'assigned_admin_id', v_after.assigned_admin_id, 'tags', to_jsonb(v_after_tags)));
  end if;
  if v_response is not null then
    insert into public.support_ticket_history(ticket_id, changed_by, event_type, after_state) values (p_ticket_id, v_admin_id, 'response_sent', jsonb_build_object('message_id', v_public_message_id, 'template_id', p_template_id));
  end if;
  if v_internal is not null then
    insert into public.support_ticket_history(ticket_id, changed_by, event_type, after_state, comment) values (p_ticket_id, v_admin_id, 'internal_comment', jsonb_build_object('message_id', v_internal_message_id), left(v_internal, 500));
  end if;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, metadata, before_state, after_state)
  values (
    v_admin_id, 'admin.support.update', 'user_support_tickets', p_ticket_id::text,
    jsonb_build_object('public_message_id', v_public_message_id, 'internal_message_id', v_internal_message_id, 'template_id', p_template_id),
    jsonb_build_object('status', v_before.status, 'priority', v_before.priority, 'assigned_admin_id', v_before.assigned_admin_id, 'tags', to_jsonb(v_before_tags)),
    jsonb_build_object('status', v_after.status, 'priority', v_after.priority, 'assigned_admin_id', v_after.assigned_admin_id, 'tags', to_jsonb(v_after_tags))
  );

  if v_response is not null or v_before.status is distinct from v_after.status then
    v_audience := case when v_after.role = 'teacher' then 'teacher' else 'student' end;
    v_action_url := case when v_audience = 'teacher' then '/(teacher)/help-center?ticket=' else '/(student)/help-center?ticket=' end || p_ticket_id::text;
    perform public.create_notification(
      v_after.user_id, v_audience, 'announcement',
      case when v_response is not null then 'Soporte ha respondido' else 'Tu ticket ha cambiado de estado' end,
      case when v_response is not null then concat('Tu ticket "', v_after.subject, '" tiene una nueva respuesta.') else format('Tu ticket "%s" ahora está: %s.', v_after.subject, v_after.status) end,
      'chatbubble-ellipses-outline', '#8B5CF6', v_action_url, 'user_support_tickets', p_ticket_id::text,
      jsonb_build_object('ticket_id', p_ticket_id, 'status', v_after.status, 'preference_category', 'system'),
      'support-ticket:' || p_ticket_id::text || ':' || coalesce(v_public_message_id::text, 'status-' || extract(epoch from now())::bigint::text)
    );
  end if;

  return jsonb_build_object('id', p_ticket_id, 'status', v_after.status, 'priority', v_after.priority, 'public_message_id', v_public_message_id, 'internal_message_id', v_internal_message_id, 'assigned_admin_id', v_after.assigned_admin_id, 'updated_at', v_after.updated_at);
end;
$$;

-- Internal notes must not generate activity notifications or outgoing email.
create or replace function public.enqueue_support_email_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.user_support_tickets%rowtype;
  v_channel text;
  v_recipient_email text;
begin
  if new.author_role <> 'admin' or coalesce(new.is_internal, false) then return new; end if;
  select * into v_ticket from public.user_support_tickets where id = new.ticket_id;
  if not found then return new; end if;
  select coalesce(v_ticket.preferred_channel, preference.support_preferred_channel, 'in_app'),
    coalesce(nullif(trim(preference.support_contact_email), ''), nullif(trim(v_ticket.contact_email), ''), nullif(trim(profile.email), ''), auth_user.email)
  into v_channel, v_recipient_email
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  left join public.user_notification_preferences preference on preference.user_id = profile.id
  where profile.id = v_ticket.user_id;
  if v_channel not in ('email', 'both') or v_recipient_email is null then return new; end if;
  insert into public.support_email_deliveries(ticket_id, message_id, recipient_id, recipient_email, subject)
  values (v_ticket.id, new.id, v_ticket.user_id, v_recipient_email, format('[OmniQuest #%s] %s', v_ticket.id, left(v_ticket.subject, 160)))
  on conflict (message_id, recipient_id) do nothing;
  return new;
end;
$$;

revoke all on function public.get_admin_support_directory() from public, anon;
revoke all on function public.get_support_thread_page(bigint, integer, bigint) from public, anon;
revoke all on function public.get_admin_support_tickets_page(text, text, text, text, uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_admin_support_tickets_page_secured(text, text, text, text, uuid, text, text, integer, integer) from public, anon;
revoke all on function public.admin_update_support_ticket_secured(bigint, text, text, text, text, uuid, text[], bigint) from public, anon;
grant execute on function public.get_admin_support_directory() to authenticated;
grant execute on function public.get_support_thread_page(bigint, integer, bigint) to authenticated;
grant execute on function public.get_admin_support_tickets_page_secured(text, text, text, text, uuid, text, text, integer, integer) to authenticated;
grant execute on function public.admin_update_support_ticket_secured(bigint, text, text, text, text, uuid, text[], bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 7.6 Global search: FTS indexes, stable relevance, pagination and total count.
-- ---------------------------------------------------------------------------

create index if not exists profiles_global_search_fts_idx on public.profiles using gin(to_tsvector('simple'::regconfig, coalesce(alias, '') || ' ' || coalesce(email, '') || ' ' || coalesce(role_id, '')));
create index if not exists profiles_global_search_trgm_idx on public.profiles using gin((coalesce(alias, '') || ' ' || coalesce(email, '')) gin_trgm_ops);
create index if not exists subjects_global_search_fts_idx on public.subjects using gin(to_tsvector('simple'::regconfig, coalesce(name, '') || ' ' || coalesce(code, '')));
create index if not exists subjects_global_search_trgm_idx on public.subjects using gin((coalesce(name, '') || ' ' || coalesce(code, '')) gin_trgm_ops);
create index if not exists classrooms_global_search_fts_idx on public.classrooms using gin(to_tsvector('simple'::regconfig, coalesce(name, '') || ' ' || coalesce(code, '')));
create index if not exists classrooms_global_search_trgm_idx on public.classrooms using gin((coalesce(name, '') || ' ' || coalesce(code, '')) gin_trgm_ops);

drop function if exists public.search_app_entities(text, integer);
drop function if exists public.search_app_entities(text, integer, integer);
create function public.search_app_entities(
  p_query text,
  p_limit integer default 18,
  p_offset integer default 0
)
returns table (
  entity_type text,
  entity_id text,
  title text,
  subtitle text,
  role_id text,
  subject_id bigint,
  classroom_id bigint,
  relevance real,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 18), 1), 30);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_tsquery tsquery;
  v_can_users boolean := false;
  v_can_courses boolean := false;
begin
  if v_user_id is null then raise exception 'No authenticated user'; end if;
  if length(v_query) < 2 then return; end if;
  select profile.role_id into v_role from public.profiles profile where profile.id = v_user_id and coalesce(profile.active, true);
  if v_role not in ('admin', 'teacher') then raise exception 'Global search is available only to teachers and admins'; end if;
  if v_role = 'admin' then
    v_can_users := public.admin_has_permission('users.read');
    v_can_courses := public.admin_has_permission('courses.read');
    if not v_can_users and not v_can_courses then raise exception 'Global search permission required'; end if;
  else
    v_can_users := true;
    v_can_courses := true;
  end if;
  v_tsquery := websearch_to_tsquery('simple'::regconfig, v_query);

  return query
  with allowed_subjects as (
    select subject.id, subject.name, subject.code, subject.teacher_id, subject.is_archived
    from public.subjects subject
    where (v_role = 'admin' and v_can_courses) or subject.teacher_id = v_user_id
  ), candidates as (
    select 'profile'::text entity_type, profile.id::text entity_id,
      coalesce(profile.alias, profile.email, 'Usuario')::text title,
      concat_ws(' · ', case when profile.role_id = 'teacher' then 'Profesor' else 'Alumno' end, profile.email)::text subtitle,
      profile.role_id::text role_id, null::bigint subject_id, null::bigint classroom_id,
      (100 - least(90, greatest(0, ts_rank_cd(to_tsvector('simple'::regconfig, coalesce(profile.alias, '') || ' ' || coalesce(profile.email, '') || ' ' || coalesce(profile.role_id, '')), v_tsquery) * 100)::integer))::real relevance
    from public.profiles profile
    where profile.role_id in ('teacher', 'student', 'guest')
      and (v_role <> 'admin' or v_can_users)
      and (v_role = 'admin' or exists (
        select 1 from public.enrollments enrollment join allowed_subjects subject on subject.id = enrollment.subject_id
        where enrollment.student_id = profile.id
      ))
      and (to_tsvector('simple'::regconfig, coalesce(profile.alias, '') || ' ' || coalesce(profile.email, '') || ' ' || coalesce(profile.role_id, '')) @@ v_tsquery
        or (coalesce(profile.alias, '') || ' ' || coalesce(profile.email, '')) ilike '%' || v_query || '%')

    union all
    select 'subject', subject.id::text, subject.name,
      concat_ws(' · ', 'Curso', teacher.alias, case when coalesce(subject.is_archived, false) then 'Archivado' end),
      null, subject.id, null,
      (100 - least(90, greatest(0, ts_rank_cd(to_tsvector('simple'::regconfig, coalesce(subject.name, '') || ' ' || coalesce(subject.code, '')), v_tsquery) * 100)::integer))::real
    from allowed_subjects subject
    left join public.profiles teacher on teacher.id = subject.teacher_id
    where to_tsvector('simple'::regconfig, coalesce(subject.name, '') || ' ' || coalesce(subject.code, '')) @@ v_tsquery
      or (coalesce(subject.name, '') || ' ' || coalesce(subject.code, '')) ilike '%' || v_query || '%'

    union all
    select 'classroom', classroom.id::text, classroom.name,
      concat_ws(' · ', 'Clase', subject.name, classroom.code), null, classroom.subject_id, classroom.id,
      (100 - least(90, greatest(0, ts_rank_cd(to_tsvector('simple'::regconfig, coalesce(classroom.name, '') || ' ' || coalesce(classroom.code, '')), v_tsquery) * 100)::integer))::real
    from public.classrooms classroom
    join allowed_subjects subject on subject.id = classroom.subject_id
    where to_tsvector('simple'::regconfig, coalesce(classroom.name, '') || ' ' || coalesce(classroom.code, '')) @@ v_tsquery
      or (coalesce(classroom.name, '') || ' ' || coalesce(classroom.code, '')) ilike '%' || v_query || '%'
  ), deduplicated as (
    select distinct on (candidate.entity_type, candidate.entity_id) candidate.*
    from candidates candidate
    order by candidate.entity_type, candidate.entity_id, candidate.relevance, candidate.title
  )
  select deduplicated.entity_type, deduplicated.entity_id, deduplicated.title, deduplicated.subtitle,
    deduplicated.role_id, deduplicated.subject_id, deduplicated.classroom_id,
    deduplicated.relevance, count(*) over()::bigint
  from deduplicated
  order by deduplicated.relevance, deduplicated.title
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.search_app_entities(text, integer, integer) from public, anon;
grant execute on function public.search_app_entities(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
alter table public.admin_audit_logs_default enable row level security;
revoke all privileges on table public.admin_audit_logs_default from public, anon, authenticated;
grant select, insert on table public.admin_audit_logs_default to service_role;

create or replace function public.harden_admin_audit_partition_privileges()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_partition record;
  v_hardened integer := 0;
begin
  for v_partition in
    select namespace.nspname as schema_name, child.relname as table_name
    from pg_catalog.pg_inherits inheritance
    join pg_catalog.pg_class parent on parent.oid = inheritance.inhparent
    join pg_catalog.pg_class child on child.oid = inheritance.inhrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = child.relnamespace
    where parent.oid = 'public.admin_audit_logs'::regclass
  loop
    execute format('alter table %I.%I enable row level security', v_partition.schema_name, v_partition.table_name);
    execute format('revoke all privileges on table %I.%I from public, anon, authenticated', v_partition.schema_name, v_partition.table_name);
    execute format('grant select, insert on table %I.%I to service_role', v_partition.schema_name, v_partition.table_name);
    v_hardened := v_hardened + 1;
  end loop;

  return v_hardened;
end;
$$;

revoke all on function public.harden_admin_audit_partition_privileges() from public, anon, authenticated;
grant execute on function public.harden_admin_audit_partition_privileges() to service_role;

select public.harden_admin_audit_partition_privileges();

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

  perform public.harden_admin_audit_partition_privileges();

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

revoke all on function public.maintain_admin_audit_partitions() from public, anon, authenticated;
grant execute on function public.maintain_admin_audit_partitions() to service_role;

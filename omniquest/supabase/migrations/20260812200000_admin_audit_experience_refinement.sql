-- Admin audit experience refinement.
-- Integrity verification is deliberately global: date parameters remain in the
-- signature for backward compatibility, but the full retained chain is always
-- verified so the boundary links cannot be skipped by a filtered request.

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

  -- p_from and p_to are intentionally ignored. Integrity is a property of the
  -- complete retained chain, not of the currently filtered table viewport.
  select log.previous_hash, log.chain_seq, log.id
  into v_expected_previous, v_first_chain_seq, v_first_row_id
  from public.admin_audit_logs log
  order by log.chain_seq
  limit 1;

  v_anchor_hash := v_expected_previous;

  if v_first_chain_seq is not null then
    select checkpoint.final_hash
    into v_checkpoint_hash
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
    select *
    from public.admin_audit_logs log
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
    'checkpoint_consistent', v_checkpoint_consistent,
    'scope', 'full_chain'
  );
end;
$$;

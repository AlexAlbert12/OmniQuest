-- Simplify the teacher audit experience while preserving stable technical action codes.
-- Saved filters are removed, teacher-facing RPCs are role-hardened, audit payloads are
-- further minimized and before/after snapshots are normalized for current and legacy writers.

drop function if exists public.save_teacher_audit_filter(uuid, text, jsonb);
drop table if exists public.teacher_audit_saved_filters;

create or replace function public.sanitize_teacher_audit_payload(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_value is null then return '{}'::jsonb; end if;

  if jsonb_typeof(p_value) = 'object' then
    select coalesce(jsonb_object_agg(entry.key, public.sanitize_teacher_audit_payload(entry.value)), '{}'::jsonb)
    into v_result
    from jsonb_each(p_value) entry
    where lower(entry.key) not in (
      'password','password_hash','current_password','new_password','token','access_token','refresh_token',
      'secret','service_role','authorization','email','phone','submitted_answer_text','submitted_answer_payload',
      'answer','body','message','content','ip_address','user_agent','description','note','notes','comment','comments',
      'feedback','free_text','question_text','question_prompt','prompt','response_text','code','previous_code','next_code',
      'invite_code','access_code'
    );
    return v_result;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(public.sanitize_teacher_audit_payload(item.value)), '[]'::jsonb)
    into v_result
    from jsonb_array_elements(p_value) item;
    return v_result;
  end if;

  return p_value;
end;
$$;

create or replace function public.prepare_teacher_audit_log()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.before_state := public.sanitize_teacher_audit_payload(
    coalesce(nullif(new.before_state, '{}'::jsonb), new.metadata -> 'before', new.metadata -> 'old', new.metadata -> 'previous', '{}'::jsonb)
  );
  new.after_state := public.sanitize_teacher_audit_payload(
    coalesce(nullif(new.after_state, '{}'::jsonb), new.metadata -> 'after', new.metadata -> 'new', new.metadata -> 'next', '{}'::jsonb)
  );
  new.metadata := public.sanitize_teacher_audit_payload(
    coalesce(new.metadata, '{}'::jsonb) - array['before','after','old','new','previous','next']
  );

  if coalesce(new.severity, 'info') = 'info'
     and (new.action ilike '%delete%' or new.action ilike '%archive%' or new.action ilike '%deactivate%' or new.action ilike '%reset%') then
    new.severity := 'warning';
  end if;
  return new;
end;
$$;

create or replace function public.get_teacher_audit_logs_page_v2(
  p_category text default 'all', p_search text default null, p_action text default null, p_target_table text default null,
  p_severity text default null, p_from timestamptz default null, p_to timestamptz default null, p_limit integer default 25, p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_category text := lower(coalesce(nullif(trim(p_category), ''), 'all'));
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role_id = 'teacher' and coalesce(p.active, true)) then
    raise exception 'Teacher access required';
  end if;

  with base as (
    select
      l.*,
      public.sanitize_teacher_audit_payload(coalesce(nullif(l.before_state, '{}'::jsonb), l.metadata -> 'before', l.metadata -> 'old', l.metadata -> 'previous', '{}'::jsonb)) as effective_before_state,
      public.sanitize_teacher_audit_payload(coalesce(nullif(l.after_state, '{}'::jsonb), l.metadata -> 'after', l.metadata -> 'new', l.metadata -> 'next', '{}'::jsonb)) as effective_after_state,
      public.sanitize_teacher_audit_payload(coalesce(l.metadata, '{}'::jsonb) - array['before','after','old','new','previous','next']) as safe_metadata
    from public.teacher_audit_logs l
    where l.teacher_id = v_user_id
      and (
        v_category = 'all'
        or (v_category = 'student' and (l.target_table in ('enrollments','subject_scores','topic_scores') or l.action ilike 'teacher.student.%'))
        or (v_category = 'question' and (l.target_table in ('questions','answers') or l.action ilike '%question%'))
        or (v_category = 'subject' and (l.target_table in ('subjects','subject_topics') or l.action ilike any(array['%subject%','%course%','%topic%'])))
        or (v_category = 'code' and (l.action ilike '%code%' or l.target_table = 'classrooms'))
        or (v_category = 'profile' and l.action ilike 'teacher.profile.%')
      )
      and (v_search is null or concat_ws(' ', l.action, l.target_table, l.target_id, public.sanitize_teacher_audit_payload(l.metadata)::text, public.sanitize_teacher_audit_payload(l.before_state)::text, public.sanitize_teacher_audit_payload(l.after_state)::text) ilike '%' || v_search || '%')
      and (nullif(trim(coalesce(p_severity, '')), '') is null or l.severity = p_severity)
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at < p_to)
  ), filtered as (
    select * from base
    where (nullif(trim(coalesce(p_action, '')), '') is null or action = p_action)
      and (nullif(trim(coalesce(p_target_table, '')), '') is null or target_table = p_target_table)
  ), page as (
    select * from filtered order by created_at desc, id desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'teacher_id', p.teacher_id,
      'action', p.action,
      'target_table', p.target_table,
      'target_id', p.target_id,
      'metadata', p.safe_metadata,
      'before_state', p.effective_before_state,
      'after_state', p.effective_after_state,
      'severity', p.severity,
      'request_id', p.request_id,
      'created_at', p.created_at
    ) order by p.created_at desc, p.id desc) from page p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'stats', jsonb_build_object(
      'last7Days', (select count(*) from filtered where created_at >= now() - interval '7 days'),
      'critical', (select count(*) from filtered where severity = 'critical'),
      'warning', (select count(*) from filtered where severity = 'warning')
    ),
    'actions', coalesce((select jsonb_agg(action order by action) from (select distinct action from base) available_actions), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_teacher_audit_configuration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role_id = 'teacher' and coalesce(p.active, true)) then
    raise exception 'Teacher access required';
  end if;

  select jsonb_build_object(
    'retentionDays', coalesce((select retention_days from public.teacher_audit_retention_policy where singleton = true), 730),
    'subjectsCount', (select count(*) from public.subjects s where s.teacher_id = v_user_id and coalesce(s.is_archived, false) = false),
    'alerts', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.teacher_audit_alerts where teacher_id = v_user_id and acknowledged_at is null order by created_at desc limit 20) a), '[]'::jsonb),
    'exports', coalesce((select jsonb_agg(to_jsonb(e) order by e.requested_at desc) from (select * from public.teacher_audit_export_requests where teacher_id = v_user_id order by requested_at desc limit 10) e), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.acknowledge_teacher_audit_alert(p_alert_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role_id = 'teacher' and coalesce(p.active, true)) then
    raise exception 'Teacher access required';
  end if;
  update public.teacher_audit_alerts set acknowledged_at = now() where id = p_alert_id and teacher_id = v_user_id and acknowledged_at is null;
  return found;
end;
$$;

create or replace function public.request_teacher_audit_export(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.teacher_audit_export_requests%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role_id = 'teacher' and coalesce(p.active, true)) then
    raise exception 'Teacher access required';
  end if;
  if jsonb_typeof(coalesce(p_filters, '{}'::jsonb)) <> 'object' then raise exception 'Invalid export filters'; end if;

  update public.teacher_audit_export_requests set status = 'expired', updated_at = now() where teacher_id = v_user_id and status = 'ready' and expires_at <= now();

  select * into v_request from public.teacher_audit_export_requests where teacher_id = v_user_id and status in ('queued','processing') order by requested_at desc limit 1;

  if not found then
    insert into public.teacher_audit_export_requests(teacher_id, filters)
    values(v_user_id, coalesce(p_filters, '{}'::jsonb))
    on conflict (teacher_id) where status in ('queued','processing') do nothing
    returning * into v_request;

    if v_request.id is null then
      select * into v_request from public.teacher_audit_export_requests where teacher_id = v_user_id and status in ('queued','processing') order by requested_at desc limit 1;
    end if;
  end if;

  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'requestedAt', v_request.requested_at);
end;
$$;

-- The legacy page RPC is no longer used by the teacher client. Keep the database
-- function for migration compatibility, but remove direct authenticated access.
revoke execute on function public.get_teacher_audit_logs_page(text, text, integer, integer) from authenticated;

revoke all on function public.get_teacher_audit_logs_page_v2(text,text,text,text,text,timestamptz,timestamptz,integer,integer) from public, anon;
revoke all on function public.get_teacher_audit_configuration() from public, anon;
revoke all on function public.acknowledge_teacher_audit_alert(bigint) from public, anon;
revoke all on function public.request_teacher_audit_export(jsonb) from public, anon;
grant execute on function public.get_teacher_audit_logs_page_v2(text,text,text,text,text,timestamptz,timestamptz,integer,integer) to authenticated;
grant execute on function public.get_teacher_audit_configuration() to authenticated;
grant execute on function public.acknowledge_teacher_audit_alert(bigint) to authenticated;
grant execute on function public.request_teacher_audit_export(jsonb) to authenticated;

notify pgrst, 'reload schema';

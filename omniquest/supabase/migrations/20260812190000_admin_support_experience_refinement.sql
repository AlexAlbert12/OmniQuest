-- Admin support experience refinement:
-- - keep support assignees fail-closed under the explicit admin RBAC model
-- - stop implicitly assigning an unassigned ticket to the current admin on any save

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
      join public.admin_role_assignments assignment on assignment.user_id = profile.id
      join public.admin_roles role on role.id = assignment.role_id
      where profile.role_id = 'admin'
        and coalesce(profile.active, true)
        and 'support.manage' = any(coalesce(role.permissions, '{}'::text[]))
    ), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(to_jsonb(tag) order by tag.label) from public.support_tags tag where tag.active), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(template) order by template.title) from public.support_response_templates template where template.active), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_update_support_ticket_secured(
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
    join public.admin_role_assignments assignment on assignment.user_id = profile.id
    join public.admin_roles role on role.id = assignment.role_id
    where profile.id = p_assigned_admin_id
      and profile.role_id = 'admin'
      and coalesce(profile.active, true)
      and 'support.manage' = any(coalesce(role.permissions, '{}'::text[]))
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
      assigned_admin_id = coalesce(p_assigned_admin_id, ticket.assigned_admin_id),
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

revoke all on function public.get_admin_support_directory() from public, anon;
revoke all on function public.admin_update_support_ticket_secured(bigint, text, text, text, text, uuid, text[], bigint) from public, anon;
grant execute on function public.get_admin_support_directory() to authenticated;
grant execute on function public.admin_update_support_ticket_secured(bigint, text, text, text, text, uuid, text[], bigint) to authenticated;

-- Settings, account requests and conversational support.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed', 'expired')),
  object_path text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_export_requests_user_requested_idx
  on public.data_export_requests(user_id, requested_at desc);
create unique index if not exists data_export_requests_one_active_idx
  on public.data_export_requests(user_id)
  where status in ('queued', 'processing');

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '7 days'),
  cancelled_at timestamptz,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_deletion_requests_user_requested_idx
  on public.account_deletion_requests(user_id, requested_at desc);
create unique index if not exists account_deletion_requests_one_active_idx
  on public.account_deletion_requests(user_id)
  where status in ('pending', 'processing');

alter table public.data_export_requests enable row level security;
alter table public.account_deletion_requests enable row level security;

revoke all on public.data_export_requests from public, anon, authenticated;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.data_export_requests to authenticated;
grant select on public.account_deletion_requests to authenticated;

drop policy if exists "data_export_requests_select_own" on public.data_export_requests;
create policy "data_export_requests_select_own"
on public.data_export_requests for select to authenticated
using (user_id = auth.uid());

drop policy if exists "account_deletion_requests_select_own" on public.account_deletion_requests;
create policy "account_deletion_requests_select_own"
on public.account_deletion_requests for select to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-exports',
  'account-exports',
  false,
  52428800,
  array['application/json']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "account_exports_select_own" on storage.objects;
create policy "account_exports_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'account-exports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.data_export_requests request
    where request.user_id = auth.uid()
      and request.object_path = name
      and request.status = 'ready'
      and request.expires_at > now()
  )
);

create or replace function public.request_account_data_export()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.data_export_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.data_export_requests
  set status = 'expired', updated_at = now()
  where user_id = v_user_id
    and status = 'ready'
    and expires_at <= now();

  select * into v_request
  from public.data_export_requests
  where user_id = v_user_id
    and (
      status in ('queued', 'processing')
      or (status = 'ready' and expires_at > now())
    )
  order by requested_at desc
  limit 1;

  if not found then
    insert into public.data_export_requests (user_id)
    values (v_user_id)
    returning * into v_request;
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'requested_at', v_request.requested_at,
    'expires_at', v_request.expires_at
  );
end;
$$;

create or replace function public.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_request
  from public.account_deletion_requests
  where user_id = v_user_id
    and status in ('pending', 'processing')
  order by requested_at desc
  limit 1;

  if not found then
    insert into public.account_deletion_requests (user_id)
    values (v_user_id)
    returning * into v_request;

    perform public.create_notification(
      v_user_id,
      case when exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher') then 'teacher' else 'student' end,
      'announcement',
      'Solicitud de borrado registrada',
      format('Tu cuenta está programada para borrarse el %s. Puedes cancelar la solicitud antes de esa fecha.', to_char(v_request.scheduled_for, 'DD/MM/YYYY HH24:MI')),
      'trash-outline',
      '#F87171',
      case when exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher') then '/(teacher)/settings?section=data' else '/(student)/settings?section=data' end,
      'account_deletion_requests',
      v_request.id::text,
      jsonb_build_object('preference_category', 'system', 'scheduled_for', v_request.scheduled_for),
      'account-deletion-requested:' || v_request.id::text
    );
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'requested_at', v_request.requested_at,
    'scheduled_for', v_request.scheduled_for
  );
end;
$$;

create or replace function public.cancel_account_deletion(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_request_id
    and user_id = v_user_id
    and status = 'pending'
  returning * into v_request;

  if not found then
    raise exception 'Pending deletion request not found';
  end if;

  perform public.create_notification(
    v_user_id,
    case when exists (select 1 from public.profiles where id = v_user_id and role_id = 'teacher') then 'teacher' else 'student' end,
    'announcement',
    'Borrado de cuenta cancelado',
    'La solicitud se ha cancelado y tu cuenta seguirá activa.',
    'checkmark-circle-outline',
    '#34D399',
    null,
    'account_deletion_requests',
    v_request.id::text,
    jsonb_build_object('preference_category', 'system'),
    'account-deletion-cancelled:' || v_request.id::text
  );

  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'cancelled_at', v_request.cancelled_at);
end;
$$;

revoke all on function public.request_account_data_export() from public, anon;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.cancel_account_deletion(uuid) from public, anon;
grant execute on function public.request_account_data_export() to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion(uuid) to authenticated;

-- Conversational support, attachments and SLA.

alter table public.user_support_tickets
  add column if not exists first_response_due_at timestamptz,
  add column if not exists resolution_due_at timestamptz,
  add column if not exists first_responded_at timestamptz;

create table if not exists public.support_ticket_messages (
  id bigint generated by default as identity primary key,
  ticket_id bigint not null references public.user_support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_role text not null check (author_role in ('student', 'teacher', 'admin', 'system')),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages(ticket_id, created_at, id);

create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id bigint not null references public.user_support_tickets(id) on delete cascade,
  message_id bigint references public.support_ticket_messages(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_attachments_ticket_idx
  on public.support_ticket_attachments(ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;

revoke all on public.support_ticket_messages from public, anon, authenticated;
revoke all on public.support_ticket_attachments from public, anon, authenticated;
grant select on public.support_ticket_messages to authenticated;
grant select, insert on public.support_ticket_attachments to authenticated;

drop policy if exists "support_messages_select_participants" on public.support_ticket_messages;
create policy "support_messages_select_participants"
on public.support_ticket_messages for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.user_support_tickets ticket
    where ticket.id = support_ticket_messages.ticket_id and ticket.user_id = auth.uid()
  )
);

drop policy if exists "support_messages_insert_owner" on public.support_ticket_messages;

drop policy if exists "support_attachments_select_participants" on public.support_ticket_attachments;
create policy "support_attachments_select_participants"
on public.support_ticket_attachments for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.user_support_tickets ticket
    where ticket.id = support_ticket_attachments.ticket_id and ticket.user_id = auth.uid()
  )
);

drop policy if exists "support_attachments_insert_owner" on public.support_ticket_attachments;
create policy "support_attachments_insert_owner"
on public.support_ticket_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.user_support_tickets ticket
    where ticket.id = support_ticket_attachments.ticket_id and ticket.user_id = auth.uid() and ticket.status <> 'closed'
  )
  and (support_ticket_attachments.message_id is null or exists (
    select 1 from public.support_ticket_messages message
    where message.id = support_ticket_attachments.message_id
      and message.ticket_id = support_ticket_attachments.ticket_id
  ))
);

create or replace function public.add_support_ticket_message(
  p_ticket_id bigint,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_body text := trim(coalesce(p_body, ''));
  v_message public.support_ticket_messages%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_body) not between 2 and 10000 then raise exception 'Message length must be between 2 and 10000 characters'; end if;

  select ticket.role into v_role
  from public.user_support_tickets ticket
  where ticket.id = p_ticket_id
    and ticket.user_id = v_user_id
    and ticket.status <> 'closed'
  for update;

  if not found then raise exception 'Support ticket not found or closed'; end if;

  insert into public.support_ticket_messages (ticket_id, author_id, author_role, body)
  values (p_ticket_id, v_user_id, v_role, v_body)
  returning * into v_message;

  return to_jsonb(v_message);
end;
$$;

revoke all on function public.add_support_ticket_message(bigint, text) from public, anon;
grant execute on function public.add_support_ticket_message(bigint, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support_attachments_storage_insert_owner" on storage.objects;
create policy "support_attachments_storage_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.user_support_tickets ticket
    where ticket.id = case
      when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint
    end
      and ticket.user_id = auth.uid()
      and ticket.status <> 'closed'
  )
);

drop policy if exists "support_attachments_storage_select_participants" on storage.objects;
create policy "support_attachments_storage_select_participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and (
    public.is_admin()
    or exists (
      select 1 from public.user_support_tickets ticket
      where ticket.id = case
        when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint
      end
        and ticket.user_id = auth.uid()
    )
  )
);

create or replace function public.support_first_response_interval(p_priority text)
returns interval
language sql
immutable
as $$
  select case lower(coalesce(p_priority, 'medium'))
    when 'high' then interval '2 hours'
    when 'low' then interval '24 hours'
    else interval '8 hours'
  end;
$$;

create or replace function public.support_resolution_interval(p_priority text)
returns interval
language sql
immutable
as $$
  select case lower(coalesce(p_priority, 'medium'))
    when 'high' then interval '8 hours'
    when 'low' then interval '5 days'
    else interval '2 days'
  end;
$$;

create or replace function public.prepare_support_ticket_sla()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.first_response_due_at := coalesce(new.first_response_due_at, new.created_at + public.support_first_response_interval(new.priority));
  new.resolution_due_at := coalesce(new.resolution_due_at, new.created_at + public.support_resolution_interval(new.priority));
  return new;
end;
$$;

drop trigger if exists prepare_support_ticket_sla_trigger on public.user_support_tickets;
create trigger prepare_support_ticket_sla_trigger
before insert on public.user_support_tickets
for each row execute function public.prepare_support_ticket_sla();

update public.user_support_tickets
set
  first_response_due_at = coalesce(first_response_due_at, created_at + public.support_first_response_interval(priority)),
  resolution_due_at = coalesce(resolution_due_at, created_at + public.support_resolution_interval(priority)),
  first_responded_at = coalesce(first_responded_at, case when admin_response is not null then last_response_at end);

insert into public.support_ticket_messages (ticket_id, author_id, author_role, body, created_at)
select ticket.id, ticket.user_id, ticket.role, ticket.message, ticket.created_at
from public.user_support_tickets ticket
where not exists (
  select 1 from public.support_ticket_messages message
  where message.ticket_id = ticket.id
);

insert into public.support_ticket_messages (ticket_id, author_id, author_role, body, created_at)
select ticket.id, ticket.assigned_admin_id, 'admin', ticket.admin_response, coalesce(ticket.last_response_at, ticket.updated_at)
from public.user_support_tickets ticket
where ticket.admin_response is not null
  and not exists (
    select 1 from public.support_ticket_messages message
    where message.ticket_id = ticket.id and message.author_role = 'admin'
  );

create or replace function public.seed_support_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_ticket_messages (ticket_id, author_id, author_role, body, created_at)
  values (new.id, new.user_id, new.role, new.message, new.created_at);
  return new;
end;
$$;

drop trigger if exists seed_support_ticket_message_trigger on public.user_support_tickets;
create trigger seed_support_ticket_message_trigger
after insert on public.user_support_tickets
for each row execute function public.seed_support_ticket_message();

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
  update public.user_support_tickets
  set
    last_response_at = new.created_at,
    status = case when new.author_role in ('student', 'teacher') and status = 'resolved' then 'open' else status end,
    resolved_at = case when new.author_role in ('student', 'teacher') and status = 'resolved' then null else resolved_at end,
    updated_at = now()
  where id = new.ticket_id
  returning * into v_ticket;

  if new.author_role in ('student', 'teacher') then
    for v_admin in select id from public.profiles where role_id = 'admin' and coalesce(active, true) loop
      perform public.create_notification(
        v_admin.id,
        'admin',
        'announcement',
        'Nueva respuesta de soporte',
        format('El ticket #%s, "%s", tiene actividad nueva.', v_ticket.id, v_ticket.subject),
        'chatbubble-ellipses-outline',
        '#8B5CF6',
        '/(admin)/support?ticket=' || v_ticket.id::text,
        'user_support_tickets',
        v_ticket.id::text,
        jsonb_build_object('ticket_id', v_ticket.id, 'preference_category', 'system'),
        'support-message:' || new.id::text || ':admin:' || v_admin.id::text
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists support_ticket_message_activity_trigger on public.support_ticket_messages;
create trigger support_ticket_message_activity_trigger
after insert on public.support_ticket_messages
for each row execute function public.on_support_ticket_message();

drop function if exists public.get_admin_support_tickets_page(text, text, text, text, integer, integer);
create function public.get_admin_support_tickets_page(
  p_search text default null,
  p_status text default null,
  p_priority text default null,
  p_role text default null,
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
  status text,
  admin_response text,
  assigned_admin_id uuid,
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
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  return query
  with filtered as (
    select ticket.*, profile.alias as user_alias, profile.email as user_email
    from public.user_support_tickets ticket
    left join public.profiles profile on profile.id = ticket.user_id
    where (v_status is null or ticket.status = v_status)
      and (v_priority is null or ticket.priority = v_priority)
      and (v_role is null or ticket.role = v_role)
      and (v_search is null or concat_ws(' ', ticket.subject, ticket.message, ticket.category, ticket.contact_email, ticket.admin_response, profile.alias, profile.email) ilike '%' || v_search || '%')
  )
  select
    filtered.id, filtered.user_id, filtered.user_alias, filtered.user_email,
    filtered.role, filtered.category, filtered.subject, filtered.message, filtered.contact_email,
    filtered.priority, filtered.status, filtered.admin_response, filtered.assigned_admin_id,
    filtered.resolved_at, filtered.last_response_at, filtered.first_response_due_at,
    filtered.resolution_due_at, filtered.first_responded_at,
    (select count(*) from public.support_ticket_messages message where message.ticket_id = filtered.id),
    (select count(*) from public.support_ticket_attachments attachment where attachment.ticket_id = filtered.id),
    filtered.created_at, filtered.updated_at, count(*) over()
  from filtered
  order by
    case filtered.priority when 'high' then 1 when 'medium' then 2 else 3 end,
    case filtered.status when 'open' then 1 when 'in_progress' then 2 when 'resolved' then 3 else 4 end,
    filtered.created_at desc,
    filtered.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_update_support_ticket(
  p_ticket_id bigint,
  p_status text,
  p_priority text default null,
  p_admin_response text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_ticket public.user_support_tickets%rowtype;
  v_previous_status text;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_priority text := nullif(lower(trim(coalesce(p_priority, ''))), '');
  v_response text := nullif(trim(coalesce(p_admin_response, '')), '');
  v_message_id bigint;
  v_audience text;
  v_action_url text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if v_status not in ('open', 'in_progress', 'resolved', 'closed') then raise exception 'Invalid support status'; end if;
  if v_priority is not null and v_priority not in ('low', 'medium', 'high') then raise exception 'Invalid support priority'; end if;

  select status into v_previous_status from public.user_support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Support ticket not found'; end if;

  update public.user_support_tickets
  set
    status = v_status,
    priority = coalesce(v_priority, priority),
    admin_response = coalesce(v_response, admin_response),
    assigned_admin_id = v_admin_id,
    first_responded_at = case when v_response is not null then coalesce(first_responded_at, now()) else first_responded_at end,
    last_response_at = case when v_response is not null then now() else last_response_at end,
    first_response_due_at = case when v_priority is not null and first_responded_at is null then created_at + public.support_first_response_interval(v_priority) else first_response_due_at end,
    resolution_due_at = case when v_priority is not null and resolved_at is null then created_at + public.support_resolution_interval(v_priority) else resolution_due_at end,
    resolved_at = case when v_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
    updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  if v_response is not null then
    insert into public.support_ticket_messages (ticket_id, author_id, author_role, body)
    values (v_ticket.id, v_admin_id, 'admin', v_response)
    returning id into v_message_id;
  end if;

  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, metadata)
  values (v_admin_id, 'admin.support.update', 'user_support_tickets', v_ticket.id::text,
    jsonb_build_object('status', v_ticket.status, 'priority', v_ticket.priority, 'user_id', v_ticket.user_id, 'message_id', v_message_id));

  if v_response is not null or v_previous_status is distinct from v_status then
    v_audience := case when v_ticket.role = 'teacher' then 'teacher' else 'student' end;
    v_action_url := case when v_audience = 'teacher' then '/(teacher)/help-center?ticket=' else '/(student)/help-center?ticket=' end || v_ticket.id::text;

    perform public.create_notification(
      v_ticket.user_id,
      v_audience,
      'announcement',
      case when v_response is not null then 'Soporte ha respondido' else 'Tu ticket ha cambiado de estado' end,
      case when v_response is not null
        then concat('Tu ticket "', v_ticket.subject, '" tiene una nueva respuesta.')
        else format('Tu ticket "%s" ahora está: %s.', v_ticket.subject, v_ticket.status)
      end,
      'chatbubble-ellipses-outline', '#8B5CF6', v_action_url,
      'user_support_tickets', v_ticket.id::text,
      jsonb_build_object('ticket_id', v_ticket.id, 'status', v_ticket.status, 'preference_category', 'system'),
      'support-ticket:' || v_ticket.id::text || ':' || coalesce(v_message_id::text, 'status-' || extract(epoch from now())::bigint::text)
    );
  end if;

  return jsonb_build_object('id', v_ticket.id, 'status', v_ticket.status, 'priority', v_ticket.priority, 'message_id', v_message_id, 'updated_at', v_ticket.updated_at);
end;
$$;

revoke all on function public.get_admin_support_tickets_page(text, text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_update_support_ticket(bigint, text, text, text) from public, anon;
grant execute on function public.get_admin_support_tickets_page(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_update_support_ticket(bigint, text, text, text) to authenticated;

revoke all on function public.support_first_response_interval(text) from public, anon, authenticated;
revoke all on function public.support_resolution_interval(text) from public, anon, authenticated;

-- Invoke the account-request worker through pg_net. The job is a no-op until
-- Vault contains project_url and account_requests_secret. The same secret must
-- be configured as ACCOUNT_REQUESTS_CRON_SECRET in the Edge Function.
create or replace function public.invoke_account_requests_processor()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_project_url text;
  v_secret text;
  v_request_id bigint;
begin
  if to_regclass('vault.decrypted_secrets') is null then return null; end if;

  execute $query$
    select decrypted_secret from vault.decrypted_secrets
    where name = 'project_url' order by created_at desc limit 1
  $query$ into v_project_url;
  execute $query$
    select decrypted_secret from vault.decrypted_secrets
    where name = 'account_requests_secret' order by created_at desc limit 1
  $query$ into v_secret;

  if nullif(trim(coalesce(v_project_url, '')), '') is null
     or nullif(trim(coalesce(v_secret, '')), '') is null then return null; end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/process-account-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-account-requests-secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 30000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.invoke_account_requests_processor() from public, anon, authenticated;
grant execute on function public.invoke_account_requests_processor() to service_role;

do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is null then return; end if;
  select jobid into v_job_id from cron.job
  where jobname = 'omniquest-account-requests' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'omniquest-account-requests',
    '*/5 * * * *',
    'select public.invoke_account_requests_processor();'
  );
end
$$;

notify pgrst, 'reload schema';

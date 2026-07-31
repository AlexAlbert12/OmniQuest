-- Admin portal decomposition support: least-privilege roles, governed bulk actions,
-- immutable user history, lifecycle metadata and asynchronous export jobs.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Lifecycle metadata
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists deactivation_reason text,
  add column if not exists deactivated_at timestamptz,
  add column if not exists reactivate_at timestamptz;

alter table public.subjects
  add column if not exists archive_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists retention_until timestamptz;

alter table public.classrooms
  add column if not exists deactivation_reason text,
  add column if not exists deactivated_at timestamptz,
  add column if not exists code_expires_at timestamptz;

create index if not exists profiles_reactivate_at_idx on public.profiles(reactivate_at) where active = false and reactivate_at is not null;
create index if not exists subjects_retention_until_idx on public.subjects(retention_until) where is_archived = true;
create index if not exists classrooms_code_expires_at_idx on public.classrooms(code_expires_at) where code_expires_at is not null;

-- ---------------------------------------------------------------------------
-- Least-privilege administrative roles
-- ---------------------------------------------------------------------------
create table if not exists public.admin_roles (
  id text primary key,
  name text not null unique,
  description text,
  permissions text[] not null default '{}'::text[],
  system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_role_assignments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_id text not null references public.admin_roles(id),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_roles (id, name, description, permissions)
values
  ('super_admin', 'Administrador global', 'Acceso completo al portal y a todas las acciones sensibles.', array['dashboard.read','users.read','users.manage','users.security','users.export','courses.read','courses.manage','courses.transfer','courses.delete','audit.read','audit.export','support.read','support.manage','admin.roles.manage']),
  ('user_manager', 'Gestor de usuarios', 'Gestiona profesores, alumnos, seguridad y exportaciones de usuarios.', array['dashboard.read','users.read','users.manage','users.security','users.export','audit.read']),
  ('content_manager', 'Gestor académico', 'Supervisa cursos, clases, transferencias, archivo y restauración.', array['dashboard.read','courses.read','courses.manage','courses.transfer','courses.delete','audit.read']),
  ('auditor', 'Auditor', 'Consulta y exporta trazabilidad sin modificar usuarios ni contenido.', array['dashboard.read','users.read','courses.read','audit.read','audit.export']),
  ('support_manager', 'Gestor de soporte', 'Gestiona tickets y consulta el contexto mínimo necesario.', array['dashboard.read','support.read','support.manage','users.read','audit.read'])
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    permissions = excluded.permissions,
    updated_at = now();

alter table public.admin_roles enable row level security;
alter table public.admin_role_assignments enable row level security;
revoke all on public.admin_roles from public, anon, authenticated;
revoke all on public.admin_role_assignments from public, anon, authenticated;

create or replace function public.admin_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    and coalesce(
      (
        select p_permission = any(role.permissions)
        from public.admin_role_assignments assignment
        join public.admin_roles role on role.id = assignment.role_id
        where assignment.user_id = auth.uid()
      ),
      true
    );
$$;

create or replace function public.get_admin_portal_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role_id text;
  v_role_name text;
  v_permissions text[];
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select role.id, role.name, role.permissions
  into v_role_id, v_role_name, v_permissions
  from public.admin_role_assignments assignment
  join public.admin_roles role on role.id = assignment.role_id
  where assignment.user_id = v_user_id;

  if not found then
    select id, name, permissions into v_role_id, v_role_name, v_permissions
    from public.admin_roles where id = 'super_admin';
  end if;

  return jsonb_build_object(
    'user_id', v_user_id,
    'role_id', v_role_id,
    'role_name', v_role_name,
    'permissions', coalesce(to_jsonb(v_permissions), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_admin_roles()
returns table (
  id text,
  name text,
  description text,
  permissions text[],
  system boolean,
  assigned_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select role.id, role.name, role.description, role.permissions, role.system,
    count(assignment.user_id)::bigint as assigned_count
  from public.admin_roles role
  left join public.admin_role_assignments assignment on assignment.role_id = role.id
  where public.is_admin()
  group by role.id, role.name, role.description, role.permissions, role.system
  order by case role.id when 'super_admin' then 0 else 1 end, role.name;
$$;

create or replace function public.get_admin_role_assignments_page(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  alias text,
  email text,
  role_id text,
  role_name text,
  permissions text[],
  assigned_at timestamptz,
  assigned_by uuid,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  return query
  select profile.id, profile.alias, profile.email,
    coalesce(role.id, 'super_admin') as role_id,
    coalesce(role.name, 'Administrador global') as role_name,
    coalesce(role.permissions, default_role.permissions) as permissions,
    assignment.assigned_at, assignment.assigned_by,
    count(*) over()::bigint
  from public.profiles profile
  left join public.admin_role_assignments assignment on assignment.user_id = profile.id
  left join public.admin_roles role on role.id = assignment.role_id
  left join public.admin_roles default_role on default_role.id = 'super_admin'
  where profile.role_id = 'admin'
  order by profile.alias, profile.id
  limit v_limit offset v_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Immutable user change history
-- ---------------------------------------------------------------------------
create table if not exists public.admin_user_change_history (
  id bigint generated by default as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  changed_by uuid references public.profiles(id) on delete restrict,
  change_source text not null default 'admin' check (change_source in ('admin','system')),
  action text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_user_change_history_profile_created_idx on public.admin_user_change_history(profile_id, created_at desc, id desc);
create index if not exists admin_user_change_history_actor_created_idx on public.admin_user_change_history(changed_by, created_at desc);

alter table public.admin_user_change_history enable row level security;
revoke all on public.admin_user_change_history from public, anon, authenticated;
grant select on public.admin_user_change_history to authenticated;

drop policy if exists "admin_user_change_history_select" on public.admin_user_change_history;
create policy "admin_user_change_history_select"
on public.admin_user_change_history for select to authenticated
using (public.admin_has_permission('users.read'));

create or replace function public.prevent_admin_user_change_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Admin user history is immutable';
end;
$$;

drop trigger if exists prevent_admin_user_change_history_update on public.admin_user_change_history;
create trigger prevent_admin_user_change_history_update
before update or delete on public.admin_user_change_history
for each row execute function public.prevent_admin_user_change_history_mutation();

create or replace function public.get_admin_user_change_history_page(
  p_profile_id uuid,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  profile_id uuid,
  changed_by uuid,
  change_source text,
  action text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz,
  actor_alias text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.admin_has_permission('users.read') then raise exception 'Permission denied'; end if;
  return query
  select history.id, history.profile_id, history.changed_by, history.change_source, history.action,
    history.before_state, history.after_state, history.reason, history.created_at,
    actor.alias, count(*) over()::bigint
  from public.admin_user_change_history history
  left join public.profiles actor on actor.id = history.changed_by
  where history.profile_id = p_profile_id
  order by history.created_at desc, history.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.assign_admin_role(p_user_id uuid, p_role_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_before jsonb;
  v_role public.admin_roles%rowtype;
begin
  if not public.admin_has_permission('admin.roles.manage') then raise exception 'Permission denied'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'A change reason is required'; end if;

  select * into v_profile from public.profiles where id = p_user_id and role_id = 'admin' for update;
  if not found then raise exception 'Admin profile not found'; end if;
  select * into v_role from public.admin_roles where id = p_role_id;
  if not found then raise exception 'Admin role not found'; end if;

  if p_user_id = v_actor and p_role_id <> 'super_admin' then
    raise exception 'You cannot reduce your own administrative permissions';
  end if;

  select jsonb_build_object('role_id', coalesce(assignment.role_id, 'super_admin'))
  into v_before
  from (select 1) seed
  left join public.admin_role_assignments assignment on assignment.user_id = p_user_id;

  insert into public.admin_role_assignments (user_id, role_id, assigned_by, assigned_at, updated_at)
  values (p_user_id, p_role_id, v_actor, now(), now())
  on conflict (user_id) do update
  set role_id = excluded.role_id, assigned_by = excluded.assigned_by, assigned_at = now(), updated_at = now();

  insert into public.admin_user_change_history (profile_id, changed_by, action, before_state, after_state, reason)
  values (p_user_id, v_actor, 'admin.role.assign', v_before, jsonb_build_object('role_id', p_role_id, 'permissions', v_role.permissions), trim(p_reason));

  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, metadata)
  values (v_actor, 'admin.role.assign', 'profiles', p_user_id::text, jsonb_build_object('role_id', p_role_id, 'reason', trim(p_reason)));

  return jsonb_build_object('user_id', p_user_id, 'role_id', p_role_id, 'role_name', v_role.name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Asynchronous export jobs
-- ---------------------------------------------------------------------------
create table if not exists public.admin_export_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  export_type text not null check (export_type in ('profiles','subjects','classrooms','audit','support')),
  status text not null default 'queued' check (status in ('queued','processing','ready','failed','expired')),
  filters jsonb not null default '{}'::jsonb,
  row_count bigint,
  processed_rows bigint not null default 0,
  storage_path text,
  error_message text,
  worker_id text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_export_jobs_requester_created_idx on public.admin_export_jobs(requested_by, created_at desc);
create index if not exists admin_export_jobs_queue_idx on public.admin_export_jobs(status, created_at) where status in ('queued','processing');
create unique index if not exists admin_export_jobs_one_active_idx on public.admin_export_jobs(requested_by, export_type) where status in ('queued','processing');

alter table public.admin_export_jobs enable row level security;
revoke all on public.admin_export_jobs from public, anon, authenticated;
grant select on public.admin_export_jobs to authenticated;

drop policy if exists "admin_export_jobs_select_own" on public.admin_export_jobs;
create policy "admin_export_jobs_select_own"
on public.admin_export_jobs for select to authenticated
using (requested_by = auth.uid() and public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('admin-exports', 'admin-exports', false, 104857600, array['text/csv','application/zip']::text[])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_exports_select_own" on storage.objects;
create policy "admin_exports_select_own"
on storage.objects for select to authenticated
using (bucket_id = 'admin-exports' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.request_admin_export_job(p_export_type text, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.admin_export_jobs%rowtype;
  v_permission text;
begin
  v_permission := case p_export_type
    when 'profiles' then 'users.export'
    when 'subjects' then 'courses.read'
    when 'classrooms' then 'courses.read'
    when 'audit' then 'audit.export'
    when 'support' then 'support.read'
    else null
  end;
  if v_permission is null or not public.admin_has_permission(v_permission) then raise exception 'Permission denied'; end if;

  select * into v_job from public.admin_export_jobs
  where requested_by = v_user_id and export_type = p_export_type and status in ('queued','processing')
  order by created_at desc limit 1;

  if not found then
    insert into public.admin_export_jobs (requested_by, export_type, filters)
    values (v_user_id, p_export_type, coalesce(p_filters, '{}'::jsonb))
    returning * into v_job;
  end if;

  return to_jsonb(v_job);
end;
$$;

create or replace function public.get_admin_export_jobs_page(p_limit integer default 10, p_offset integer default 0)
returns setof public.admin_export_jobs
language sql
stable
security definer
set search_path = public
as $$
  select job.* from public.admin_export_jobs job
  where job.requested_by = auth.uid() and public.is_admin()
  order by job.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_admin_export_download_path(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_job public.admin_export_jobs%rowtype;
begin
  select * into v_job from public.admin_export_jobs where id = p_job_id and requested_by = auth.uid();
  if not found or v_job.status <> 'ready' or v_job.expires_at <= now() then raise exception 'Export not available'; end if;
  return jsonb_build_object('storage_path', v_job.storage_path, 'expires_at', v_job.expires_at);
end;
$$;

create or replace function public.claim_admin_export_jobs(p_worker_id text, p_limit integer default 2)
returns setof public.admin_export_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  with claimed as (
    select job.id from public.admin_export_jobs job
    where job.status = 'queued'
    order by job.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 2), 1), 10)
  )
  update public.admin_export_jobs job
  set status = 'processing', worker_id = p_worker_id, started_at = now(), updated_at = now()
  from claimed where job.id = claimed.id
  returning job.*;
end;
$$;

create or replace function public.complete_admin_export_job(p_job_id uuid, p_storage_path text, p_row_count bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.admin_export_jobs
  set status = 'ready', storage_path = p_storage_path, row_count = p_row_count,
      processed_rows = p_row_count, completed_at = now(), expires_at = now() + interval '7 days',
      error_message = null, updated_at = now()
  where id = p_job_id and status = 'processing';
end;
$$;

create or replace function public.fail_admin_export_job(p_job_id uuid, p_error_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.admin_export_jobs
  set status = 'failed', error_message = left(coalesce(p_error_message, 'Unknown error'), 500), completed_at = now(), updated_at = now()
  where id = p_job_id and status = 'processing';
end;
$$;

create or replace function public.expire_admin_export_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.admin_export_jobs set status = 'expired', updated_at = now()
  where status = 'ready' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.invoke_admin_export_processor()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'admin_export_queue_secret' order by created_at desc limit 1;
  if nullif(trim(coalesce(v_url, '')), '') is null or nullif(trim(coalesce(v_secret, '')), '') is null then return; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/process-admin-export-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-queue-secret', v_secret),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 20000
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Enhanced server-paginated profiles
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer);

create function public.get_admin_profiles_page(
  p_role text default null,
  p_search text default null,
  p_subject_id bigint default null,
  p_classroom_id bigint default null,
  p_profile_id uuid default null,
  p_active boolean default null,
  p_activity_state text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  alias text,
  email text,
  role_id text,
  active boolean,
  created_at timestamptz,
  subject_count integer,
  enrollment_count integer,
  last_activity_at timestamptz,
  activity_state text,
  last_sign_in_at timestamptz,
  security_status text,
  mfa_factor_count integer,
  deactivation_reason text,
  deactivated_at timestamptz,
  reactivate_at timestamptz,
  admin_role_name text,
  admin_permissions text[],
  change_count integer,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
  v_activity_state text := lower(trim(coalesce(p_activity_state, 'all')));
begin
  if not public.admin_has_permission('users.read') then raise exception 'Permission denied'; end if;

  return query
  with profile_activity as (
    select profile.*,
      case
        when profile.role_id in ('student','guest') then (select max(attempt.attempted_at) from public.attempt_history attempt where attempt.student_id = profile.id)
        when profile.role_id = 'teacher' then greatest(
          (select max(log.created_at) from public.teacher_audit_logs log where log.teacher_id = profile.id),
          (select max(subject.created_at) from public.subjects subject where subject.teacher_id = profile.id)
        )
        else (select max(log.created_at) from public.admin_audit_logs log where log.admin_id = profile.id)
      end as computed_last_activity_at
    from public.profiles profile
  ), filtered as (
    select activity.*,
      case when activity.computed_last_activity_at is null then 'never'
           when activity.computed_last_activity_at >= now() - interval '30 days' then 'recent'
           else 'inactive' end as computed_activity_state
    from profile_activity activity
    where (p_profile_id is null or activity.id = p_profile_id)
      and (p_role is null or (p_role = 'student' and activity.role_id in ('student','guest')) or activity.role_id = p_role)
      and (p_active is null or coalesce(activity.active, true) = p_active)
      and (p_created_from is null or activity.created_at >= p_created_from)
      and (p_created_to is null or activity.created_at <= p_created_to)
      and (v_search = '' or lower(concat_ws(' ', activity.alias, activity.email, activity.role_id)) like '%' || v_search || '%')
      and (p_subject_id is null or (activity.role_id = 'teacher' and exists (select 1 from public.subjects subject where subject.id = p_subject_id and subject.teacher_id = activity.id)) or (activity.role_id in ('student','guest') and exists (select 1 from public.enrollments enrollment where enrollment.student_id = activity.id and enrollment.subject_id = p_subject_id)))
      and (p_classroom_id is null or (activity.role_id = 'teacher' and exists (select 1 from public.classrooms classroom join public.subjects subject on subject.id = classroom.subject_id where classroom.id = p_classroom_id and subject.teacher_id = activity.id)) or (activity.role_id in ('student','guest') and exists (select 1 from public.enrollments enrollment where enrollment.student_id = activity.id and enrollment.classroom_id = p_classroom_id)))
  )
  select filtered.id, filtered.alias, coalesce(filtered.email, auth_user.email), filtered.role_id, filtered.active, filtered.created_at,
    (select count(*)::integer from public.subjects subject where subject.teacher_id = filtered.id),
    (select count(*)::integer from public.enrollments enrollment where enrollment.student_id = filtered.id),
    filtered.computed_last_activity_at, filtered.computed_activity_state,
    auth_user.last_sign_in_at,
    case when filtered.active = false then 'inactive'
         when auth_user.banned_until is not null and auth_user.banned_until > now() then 'locked'
         when auth_user.email_confirmed_at is null then 'unverified'
         when auth_user.last_sign_in_at is null then 'never_signed_in'
         when auth_user.last_sign_in_at < now() - interval '180 days' then 'attention'
         else 'secure' end,
    (select count(*)::integer from auth.mfa_factors factor where factor.user_id = filtered.id and factor.status::text = 'verified'),
    filtered.deactivation_reason, filtered.deactivated_at, filtered.reactivate_at,
    case when filtered.role_id = 'admin' then coalesce(admin_role.name, 'Administrador global') else null end,
    case when filtered.role_id = 'admin' then coalesce(admin_role.permissions, default_role.permissions) else null end,
    (select count(*)::integer from public.admin_user_change_history history where history.profile_id = filtered.id),
    count(*) over()::bigint
  from filtered
  left join auth.users auth_user on auth_user.id = filtered.id
  left join public.admin_role_assignments assignment on assignment.user_id = filtered.id
  left join public.admin_roles admin_role on admin_role.id = assignment.role_id
  left join public.admin_roles default_role on default_role.id = 'super_admin'
  where v_activity_state in ('','all') or filtered.computed_activity_state = v_activity_state
  order by case when coalesce(filtered.active, true) then 0 else 1 end,
    auth_user.last_sign_in_at desc nulls last, filtered.computed_last_activity_at desc nulls last,
    filtered.created_at desc, filtered.alias
  limit v_limit offset v_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enhanced server-paginated courses
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_subjects_page(text, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer);

create function public.get_admin_subjects_page(
  p_search text default null,
  p_teacher_id uuid default null,
  p_archived boolean default null,
  p_active boolean default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint,
  name text,
  teacher_id uuid,
  active boolean,
  is_archived boolean,
  created_at timestamptz,
  teacher_alias text,
  teacher_email text,
  classes_count integer,
  enrollments_count integer,
  last_activity_at timestamptz,
  incidents_count integer,
  pending_reviews_count integer,
  inactive_classrooms_count integer,
  missing_code_count integer,
  duplicate_code_count integer,
  expired_code_count integer,
  orphaned boolean,
  archive_reason text,
  archived_at timestamptz,
  retention_until timestamptz,
  deletion_eligible_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('courses.read') then raise exception 'Permission denied'; end if;

  return query
  with filtered as (
    select subject.*, teacher.alias as owner_alias, teacher.email as owner_email
    from public.subjects subject
    left join public.profiles teacher on teacher.id = subject.teacher_id
    where (p_teacher_id is null or subject.teacher_id = p_teacher_id)
      and (p_archived is null or coalesce(subject.is_archived, false) = p_archived)
      and (p_active is null or coalesce(subject.active, true) = p_active)
      and (p_created_from is null or subject.created_at >= p_created_from)
      and (p_created_to is null or subject.created_at <= p_created_to)
      and (v_search = '' or lower(concat_ws(' ', subject.name, teacher.alias, teacher.email, subject.code)) like '%' || v_search || '%')
  ), enriched as (
    select filtered.*,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id) as classes_count,
      (select count(*)::integer from public.enrollments enrollment where enrollment.subject_id = filtered.id) as enrollments_count,
      (select max(attempt.attempted_at) from public.attempt_history attempt join public.questions question on question.id = attempt.question_id where question.subject_id = filtered.id) as last_activity_at,
      (select count(*)::integer from public.attempt_history attempt join public.questions question on question.id = attempt.question_id where question.subject_id = filtered.id and attempt.manual_review_status in ('pending','in_review','needs_changes')) as pending_reviews_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and coalesce(classroom.active, true) = false) as inactive_classrooms_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and nullif(trim(coalesce(classroom.code, '')), '') is null) as missing_code_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and classroom.code_expires_at is not null and classroom.code_expires_at <= now()) as expired_code_count,
      (select count(*)::integer from public.classrooms classroom where classroom.subject_id = filtered.id and nullif(trim(coalesce(classroom.code, '')), '') is not null and exists (select 1 from public.classrooms duplicate where duplicate.id <> classroom.id and lower(trim(coalesce(duplicate.code, ''))) = lower(trim(classroom.code)))) as duplicate_code_count
    from filtered
  )
  select enriched.id, enriched.name, enriched.teacher_id, enriched.active, enriched.is_archived, enriched.created_at,
    enriched.owner_alias, enriched.owner_email, enriched.classes_count, enriched.enrollments_count,
    enriched.last_activity_at,
    (enriched.pending_reviews_count + enriched.inactive_classrooms_count + enriched.missing_code_count + enriched.expired_code_count + enriched.duplicate_code_count + case when enriched.teacher_id is null then 1 else 0 end)::integer,
    enriched.pending_reviews_count, enriched.inactive_classrooms_count, enriched.missing_code_count,
    enriched.duplicate_code_count, enriched.expired_code_count, enriched.teacher_id is null,
    enriched.archive_reason, enriched.archived_at, enriched.retention_until,
    case when enriched.is_archived then enriched.retention_until else null end,
    count(*) over()::bigint
  from enriched
  order by case when enriched.teacher_id is null then 0 else 1 end,
    case when coalesce(enriched.is_archived, false) then 1 else 0 end,
    enriched.last_activity_at desc nulls last, enriched.created_at desc nulls last, enriched.name
  limit v_limit offset v_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enhanced server-paginated classrooms
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_classrooms_page(text, bigint, uuid, uuid, boolean, timestamptz, timestamptz, integer, integer);

create function public.get_admin_classrooms_page(
  p_search text default null,
  p_subject_id bigint default null,
  p_student_id uuid default null,
  p_teacher_id uuid default null,
  p_active boolean default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint,
  subject_id bigint,
  name text,
  code text,
  active boolean,
  created_at timestamptz,
  subject_name text,
  teacher_id uuid,
  teacher_alias text,
  teacher_email text,
  enrollments_count integer,
  last_activity_at timestamptz,
  incidents_count integer,
  pending_reviews_count integer,
  duplicate_code_count integer,
  code_expires_at timestamptz,
  code_status text,
  deactivation_reason text,
  deactivated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('courses.read') then raise exception 'Permission denied'; end if;

  return query
  with filtered as (
    select classroom.*, subject.name as course_name, subject.teacher_id,
      teacher.alias as owner_alias, teacher.email as owner_email
    from public.classrooms classroom
    left join public.subjects subject on subject.id = classroom.subject_id
    left join public.profiles teacher on teacher.id = subject.teacher_id
    where (p_subject_id is null or classroom.subject_id = p_subject_id)
      and (p_teacher_id is null or subject.teacher_id = p_teacher_id)
      and (p_active is null or coalesce(classroom.active, true) = p_active)
      and (p_created_from is null or classroom.created_at >= p_created_from)
      and (p_created_to is null or classroom.created_at <= p_created_to)
      and (p_student_id is null or exists (select 1 from public.enrollments enrollment where enrollment.classroom_id = classroom.id and enrollment.student_id = p_student_id))
      and (v_search = '' or lower(concat_ws(' ', classroom.name, classroom.code, subject.name, teacher.alias, teacher.email)) like '%' || v_search || '%')
  ), enriched as (
    select filtered.*,
      (select count(*)::integer from public.enrollments enrollment where enrollment.classroom_id = filtered.id) as enrollments_count,
      (select max(attempt.attempted_at) from public.attempt_history attempt join public.questions question on question.id = attempt.question_id where question.classroom_id = filtered.id) as last_activity_at,
      (select count(*)::integer from public.attempt_history attempt join public.questions question on question.id = attempt.question_id where question.classroom_id = filtered.id and attempt.manual_review_status in ('pending','in_review','needs_changes')) as pending_reviews_count,
      (select count(*)::integer from public.classrooms duplicate where duplicate.id <> filtered.id and nullif(trim(coalesce(filtered.code, '')), '') is not null and lower(trim(coalesce(duplicate.code, ''))) = lower(trim(filtered.code))) as duplicate_code_count
    from filtered
  )
  select enriched.id, enriched.subject_id, enriched.name, enriched.code, enriched.active, enriched.created_at,
    enriched.course_name, enriched.teacher_id, enriched.owner_alias, enriched.owner_email,
    enriched.enrollments_count, enriched.last_activity_at,
    (enriched.pending_reviews_count + case when nullif(trim(coalesce(enriched.code, '')), '') is null then 1 else 0 end + case when enriched.code_expires_at is not null and enriched.code_expires_at <= now() then 1 else 0 end + enriched.duplicate_code_count + case when coalesce(enriched.active, true) = false then 1 else 0 end)::integer,
    enriched.pending_reviews_count, enriched.duplicate_code_count, enriched.code_expires_at,
    case when nullif(trim(coalesce(enriched.code, '')), '') is null then 'missing'
         when enriched.duplicate_code_count > 0 then 'duplicate'
         when enriched.code_expires_at is not null and enriched.code_expires_at <= now() then 'expired'
         else 'valid' end,
    enriched.deactivation_reason, enriched.deactivated_at,
    count(*) over()::bigint
  from enriched
  order by case when coalesce(enriched.active, true) then 0 else 1 end,
    enriched.last_activity_at desc nulls last, enriched.created_at desc, enriched.name
  limit v_limit offset v_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permission-gated wrappers for legacy admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_audit_logs_page_secured(
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
  admin_id uuid,
  actor_alias text,
  actor_email text,
  action text,
  target_table text,
  target_id text,
  severity text,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission('audit.read') then raise exception 'Permission denied'; end if;
  return query select * from public.get_admin_audit_logs_page(
    p_search, p_actor_id, p_action, p_target_table, p_target_id,
    p_from, p_to, p_severity, p_limit, p_offset
  );
end;
$$;

create or replace function public.get_admin_support_tickets_page_secured(
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
stable
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission('support.read') then raise exception 'Permission denied'; end if;
  return query select * from public.get_admin_support_tickets_page(p_search, p_status, p_priority, p_role, p_limit, p_offset);
end;
$$;

create or replace function public.admin_update_support_ticket_secured(
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
begin
  if not public.admin_has_permission('support.manage') then raise exception 'Permission denied'; end if;
  return public.admin_update_support_ticket(p_ticket_id, p_status, p_priority, p_admin_response);
end;
$$;

revoke all on function public.get_admin_audit_logs_page_secured(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) from public, anon;
revoke all on function public.get_admin_support_tickets_page_secured(text, text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_update_support_ticket_secured(bigint, text, text, text) from public, anon;

revoke execute on function public.get_admin_audit_logs_page(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) from authenticated;
revoke execute on function public.get_admin_support_tickets_page(text, text, text, text, integer, integer) from authenticated;
revoke execute on function public.admin_update_support_ticket(bigint, text, text, text) from authenticated;

grant execute on function public.get_admin_audit_logs_page_secured(text, uuid, text, text, text, timestamptz, timestamptz, text, integer, integer) to authenticated;
grant execute on function public.get_admin_support_tickets_page_secured(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_update_support_ticket_secured(bigint, text, text, text) to authenticated;

-- Automatic reactivation only applies when a date was explicitly scheduled.
create or replace function public.reactivate_due_admin_users()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with due as (
    select profile.id, profile.active, profile.deactivation_reason, profile.deactivated_at, profile.reactivate_at
    from public.profiles profile
    where profile.active = false and profile.reactivate_at is not null and profile.reactivate_at <= now()
    for update
  ), updated as (
    update public.profiles profile
    set active = true, deactivation_reason = null, deactivated_at = null, reactivate_at = null
    from due where profile.id = due.id
    returning due.id, due.active, due.deactivation_reason, due.deactivated_at, due.reactivate_at
  )
  insert into public.admin_user_change_history (profile_id, changed_by, change_source, action, before_state, after_state, reason)
  select updated.id, null, 'system', 'system.user.auto_reactivate',
    jsonb_build_object('active', updated.active, 'deactivation_reason', updated.deactivation_reason, 'deactivated_at', updated.deactivated_at, 'reactivate_at', updated.reactivate_at),
    jsonb_build_object('active', true, 'deactivation_reason', null, 'deactivated_at', null, 'reactivate_at', null),
    'Reactivación automática en la fecha programada'
  from updated;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Grants
revoke all on function public.admin_has_permission(text) from public, anon;
revoke all on function public.get_admin_portal_context() from public, anon;
revoke all on function public.get_admin_roles() from public, anon;
revoke all on function public.get_admin_role_assignments_page(integer, integer) from public, anon;
revoke all on function public.assign_admin_role(uuid, text, text) from public, anon;
revoke all on function public.get_admin_user_change_history_page(uuid, integer, integer) from public, anon;
revoke all on function public.request_admin_export_job(text, jsonb) from public, anon;
revoke all on function public.get_admin_export_jobs_page(integer, integer) from public, anon;
revoke all on function public.get_admin_export_download_path(uuid) from public, anon;
revoke all on function public.claim_admin_export_jobs(text, integer) from public, anon, authenticated;
revoke all on function public.complete_admin_export_job(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.fail_admin_export_job(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_admin_export_jobs() from public, anon, authenticated;
revoke all on function public.reactivate_due_admin_users() from public, anon, authenticated;
revoke all on function public.invoke_admin_export_processor() from public, anon, authenticated;

grant execute on function public.admin_has_permission(text) to authenticated;
grant execute on function public.get_admin_portal_context() to authenticated;
grant execute on function public.get_admin_roles() to authenticated;
grant execute on function public.get_admin_role_assignments_page(integer, integer) to authenticated;
grant execute on function public.assign_admin_role(uuid, text, text) to authenticated;
grant execute on function public.get_admin_user_change_history_page(uuid, integer, integer) to authenticated;
grant execute on function public.request_admin_export_job(text, jsonb) to authenticated;
grant execute on function public.get_admin_export_jobs_page(integer, integer) to authenticated;
grant execute on function public.get_admin_export_download_path(uuid) to authenticated;
grant execute on function public.claim_admin_export_jobs(text, integer) to service_role;
grant execute on function public.complete_admin_export_job(uuid, text, bigint) to service_role;
grant execute on function public.fail_admin_export_job(uuid, text) to service_role;
grant execute on function public.expire_admin_export_jobs() to service_role;
grant execute on function public.reactivate_due_admin_users() to service_role;
grant execute on function public.invoke_admin_export_processor() to service_role;

revoke all on function public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_admin_subjects_page(text, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_admin_classrooms_page(text, bigint, uuid, uuid, boolean, timestamptz, timestamptz, integer, integer) from public, anon;

grant execute on function public.get_admin_profiles_page(text, text, bigint, bigint, uuid, boolean, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_admin_subjects_page(text, uuid, boolean, boolean, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_admin_classrooms_page(text, bigint, uuid, uuid, boolean, timestamptz, timestamptz, integer, integer) to authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('omniquest-admin-export-jobs','omniquest-admin-reactivation','omniquest-admin-export-expiry');
exception when undefined_table then null;
end;
$$;

select cron.schedule('omniquest-admin-export-jobs', '*/5 * * * *', $$select public.invoke_admin_export_processor();$$);
select cron.schedule('omniquest-admin-reactivation', '15 2 * * *', $$select public.reactivate_due_admin_users();$$);
select cron.schedule('omniquest-admin-export-expiry', '35 2 * * *', $$select public.expire_admin_export_jobs();$$);

notify pgrst, 'reload schema';

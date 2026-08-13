-- Refine the Admin export center with server-side pagination totals and current-permission
-- revalidation for listing and downloading background exports.

drop function if exists public.get_admin_export_jobs_page(integer, integer);

create function public.get_admin_export_jobs_page(p_limit integer default 10, p_offset integer default 0)
returns table (
  id uuid,
  requested_by uuid,
  export_type text,
  status text,
  filters jsonb,
  row_count bigint,
  processed_rows bigint,
  storage_path text,
  worker_id text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
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
  if not (
    public.admin_has_permission('users.export')
    or public.admin_has_permission('courses.read')
    or public.admin_has_permission('audit.export')
    or public.admin_has_permission('support.read')
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    job.id,
    job.requested_by,
    job.export_type,
    job.status,
    job.filters,
    job.row_count,
    job.processed_rows,
    job.storage_path,
    job.worker_id,
    job.error_message,
    job.started_at,
    job.completed_at,
    job.expires_at,
    job.created_at,
    job.updated_at,
    count(*) over() as total_count
  from public.admin_export_jobs job
  where job.requested_by = auth.uid()
    and (
      (job.export_type = 'profiles' and public.admin_has_permission('users.export'))
      or (job.export_type in ('subjects', 'classrooms') and public.admin_has_permission('courses.read'))
      or (job.export_type = 'audit' and public.admin_has_permission('audit.export'))
      or (job.export_type = 'support' and public.admin_has_permission('support.read'))
    )
  order by job.created_at desc, job.id desc
  limit least(greatest(coalesce(p_limit, 10), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_admin_export_download_path(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_job public.admin_export_jobs%rowtype;
  v_permission text;
begin
  select * into v_job from public.admin_export_jobs where id = p_job_id and requested_by = auth.uid();
  if not found then raise exception 'Export not available'; end if;

  v_permission := case v_job.export_type
    when 'profiles' then 'users.export'
    when 'subjects' then 'courses.read'
    when 'classrooms' then 'courses.read'
    when 'audit' then 'audit.export'
    when 'support' then 'support.read'
    else null
  end;

  if v_permission is null or not public.admin_has_permission(v_permission) then raise exception 'Permission denied'; end if;
  if v_job.status <> 'ready' or v_job.expires_at is null or v_job.expires_at <= now() then raise exception 'Export not available'; end if;

  return jsonb_build_object('storage_path', v_job.storage_path, 'expires_at', v_job.expires_at);
end;
$$;

revoke all on function public.get_admin_export_jobs_page(integer, integer) from public, anon;
revoke all on function public.get_admin_export_download_path(uuid) from public, anon;
grant execute on function public.get_admin_export_jobs_page(integer, integer) to authenticated;
grant execute on function public.get_admin_export_download_path(uuid) to authenticated;

drop policy if exists "admin_export_jobs_select_own" on public.admin_export_jobs;
create policy "admin_export_jobs_select_own"
on public.admin_export_jobs for select to authenticated
using (
  requested_by = auth.uid()
  and (
    (export_type = 'profiles' and public.admin_has_permission('users.export'))
    or (export_type in ('subjects', 'classrooms') and public.admin_has_permission('courses.read'))
    or (export_type = 'audit' and public.admin_has_permission('audit.export'))
    or (export_type = 'support' and public.admin_has_permission('support.read'))
  )
);

drop policy if exists "admin_exports_select_own" on storage.objects;
create policy "admin_exports_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'admin-exports'
  and exists (
    select 1
    from public.admin_export_jobs job
    where job.requested_by = auth.uid()
      and job.storage_path = storage.objects.name
      and (
        (job.export_type = 'profiles' and public.admin_has_permission('users.export'))
        or (job.export_type in ('subjects', 'classrooms') and public.admin_has_permission('courses.read'))
        or (job.export_type = 'audit' and public.admin_has_permission('audit.export'))
        or (job.export_type = 'support' and public.admin_has_permission('support.read'))
      )
  )
);

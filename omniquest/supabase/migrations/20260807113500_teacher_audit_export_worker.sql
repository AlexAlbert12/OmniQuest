create or replace function public.invoke_teacher_audit_export_processor()
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

  select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'teacher_audit_export_secret' order by created_at desc limit 1;

  if nullif(trim(coalesce(v_project_url, '')), '') is null or nullif(trim(coalesce(v_secret, '')), '') is null then return null; end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/process-teacher-audit-exports',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('limit', 3),
    timeout_milliseconds := 20000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.invoke_teacher_audit_export_processor() from public, anon, authenticated;
grant execute on function public.invoke_teacher_audit_export_processor() to service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'omniquest-teacher-audit-export-worker';
exception when undefined_table then
  null;
end;
$$;

select cron.schedule('omniquest-teacher-audit-export-worker', '*/5 * * * *', $$select public.invoke_teacher_audit_export_processor();$$);

notify pgrst, 'reload schema';
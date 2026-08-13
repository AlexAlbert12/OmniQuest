create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

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
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  execute $query$
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'project_url'
    order by created_at desc
    limit 1
  $query$ into v_project_url;

  execute $query$
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'account_requests_secret'
    order by created_at desc
    limit 1
  $query$ into v_secret;

  if nullif(trim(coalesce(v_project_url, '')), '') is null
     or nullif(trim(coalesce(v_secret, '')), '') is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/process-account-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-account-requests-secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 30000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.invoke_account_requests_processor()
from public, anon, authenticated;

grant execute on function public.invoke_account_requests_processor()
to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'omniquest-account-requests'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'omniquest-account-requests',
    '*/5 * * * *',
    'select public.invoke_account_requests_processor();'
  );
end
$$;

notify pgrst, 'reload schema';
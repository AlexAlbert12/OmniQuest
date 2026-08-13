begin;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'omniquest-teacher-audit-export-worker';
  end if;
exception
  when undefined_table or undefined_function then
    null;
end;
$$;

drop function if exists public.invoke_teacher_audit_export_processor();

commit;

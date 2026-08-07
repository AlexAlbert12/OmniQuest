-- PLAN DE ROLLBACK. NO colocar este archivo en supabase/migrations tal cual.
-- Compensacion de 20260807113500_teacher_audit_export_worker.sql.
-- Solo usar si la release debe retirar el worker de exportacion de auditoria docente.
-- No borra solicitudes ni exportaciones ya creadas.

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

-- Validacion posterior:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'omniquest-teacher-audit-export-worker';
-- Debe devolver 0 filas.
-- Las filas de public.teacher_audit_export_requests se conservan para no perder trazabilidad.

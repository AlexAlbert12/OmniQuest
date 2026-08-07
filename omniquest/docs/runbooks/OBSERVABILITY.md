# Runbook de observabilidad

## Objetivo

La comprobación posterior a un despliegue no termina cuando `db push` o el despliegue de Edge Functions devuelve éxito. Hay que confirmar que API, cron y workers siguen procesando trabajo y que no se acumulan estados `retry`, `failed` o `processing` bloqueados.

## 1. Edge Functions

En Supabase Dashboard abre `Edge Functions` y revisa tanto `Invocations` como `Logs`, especialmente para:

- `process-notification-delivery`;
- `process-support-email-delivery`;
- `process-account-requests`;
- `process-teacher-digests`;
- `process-admin-export-jobs`;
- `process-teacher-audit-exports`;
- cualquier función sensible desplegada en la release.

Investiga respuestas 4xx/5xx, excepciones no controladas y aumentos anormales de duración. No registres tokens, secretos, cabeceras `Authorization` ni payloads sensibles en `console.log`.

## 2. PostgREST/API

Usa `Logs Explorer` / logs de API para revisar errores REST/RPC, especialmente 401, 403, 404 de esquema y 5xx. Tras una migración que cambie funciones o columnas, confirma que no aparecen errores de caché de esquema o permisos en las rutas usadas por alumno, profesor y administrador.

## 3. Cron y pg_net

Ejecuta `supabase/snippets/operational_health.sql` desde SQL Editor. Deben existir y estar activos los jobs de OmniQuest. `cron.job_run_details` permite comprobar la ejecución real; `net._http_response` permite detectar invocaciones HTTP de workers con 401/404/5xx.

Un job presente en `cron.job` pero sin ejecuciones recientes no se considera validado.

## 4. Colas y trabajos

La consulta de salud clasifica como incidentes, entre otros:

- `notification_delivery_queue` en `failed`, o trabajo debido que no avanza;
- `teacher_digest_deliveries` y `support_email_deliveries` en `failed` o `retry` ya vencido;
- `data_export_requests`, `admin_export_jobs` o `teacher_audit_export_requests` en `processing` demasiado tiempo;
- solicitudes de exportación en `failed`;
- `notification_push_deliveries` en `ticketed` durante más de 20 minutos sin receipt;
- alertas de auditoría docente `warning`/`critical` sin reconocer.

Los umbrales del snippet son deliberadamente conservadores para una demo: 15 minutos para workers cortos, 30 minutos para exportaciones y 20 minutos para receipts push. Si el volumen real aumenta, documenta y ajusta los umbrales en lugar de ignorar alertas.

## 5. Ventana de observación

Después de un despliegue remoto:

1. Ejecuta los smoke tests de autenticación y roles.
2. Genera al menos un evento real de push, soporte/correo y exportación cuando esas funciones hayan cambiado.
3. Comprueba dos ejecuciones consecutivas de los cron afectados.
4. Repite `operational_health.sql` al principio y al final de la ventana.
5. Cierra la ventana solo si no hay errores nuevos, trabajos bloqueados ni anomalías sin explicar.

Para una demo de TFM, una ventana de 15-30 minutos es suficiente para workers de 1-10 minutos; los jobs diarios de mantenimiento se validan por historial previo o mediante una ejecución controlada en un entorno de demo, no alterando su horario en producción.

## 6. Escalado

- Error de frontend compatible con esquema: revierte frontend y deja el esquema intacto.
- Error de Edge Function: vuelve a desplegar la copia conservada en `remote-edge-functions/` si es compatible con el esquema activo.
- Error de esquema: prioriza fix-forward con una migración nueva.
- Pérdida/corrupción real de datos: detén escritores y usa el procedimiento de restauración del backup/PITR.

Consulta también `ROLLBACK.md` y `BACKUP.md`.

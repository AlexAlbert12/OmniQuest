# Runbook de rollback

## Principio

Supabase/PostgreSQL no revierte automáticamente una migración remota. En OmniQuest el rollback de esquema se implementa como una migración compensatoria nueva; la restauración de backup queda reservada para pérdida o corrupción real de datos.

Nunca borres manualmente filas de `supabase_migrations.schema_migrations` ni uses el historial de migraciones para fingir que un cambio de esquema se ha deshecho. El historial debe seguir representando lo que se ejecutó realmente.

## Orden de decisión

1. **Fix-forward**: si el esquema ya está en uso o existen datos escritos con la nueva versión, corrige el problema con una migración nueva compatible.
2. **Reversión de aplicación**: si el esquema sigue siendo compatible, vuelve a desplegar el frontend o las Edge Functions anteriores registradas en el baseline.
3. **Migración compensatoria**: si hay que retirar un objeto de base de datos, crea un nuevo fichero en `supabase/migrations` a partir del plan probado; no edites ni elimines la migración original.
4. **Restauración**: solo ante pérdida/corrupción real o cuando un fix-forward no pueda preservar los datos. Detén escritores antes de restaurar y valida el resultado en un entorno aislado cuando sea posible.

## Procedimiento

1. Detén despliegues y procesadores que escriban en las tablas afectadas.
2. Clasifica el fallo: frontend, Edge Function, permisos/PostgREST, cron/worker, esquema o datos.
3. Conserva evidencia: hora, proyecto, `release-manifest.json`, logs, filas afectadas y mensajes de error.
4. Verifica qué versión del frontend y de las Edge Functions es compatible con el esquema activo.
5. Si procede un fix-forward, crea una migración nueva, pruébala localmente y despliega solo después de `db push --dry-run`.
6. Si procede una compensación, copia el SQL del plan a una **nueva migración con timestamp nuevo**, revisa su impacto y ejecútala por el flujo normal.
7. Si se revierte una Edge Function, usa la copia guardada en `release-artifacts/<timestamp>/remote-edge-functions/` y respeta el `verify_jwt` definido para esa función.
8. Si se revierte frontend, despliega el `frontendRollbackRef` registrado en el baseline.
9. Repite smoke tests y el runbook de observabilidad antes de cerrar el incidente.
10. Documenta impacto, datos afectados, tiempos y acción preventiva.

## Plan compensatorio de la release actual

La migración `20260807113500_teacher_audit_export_worker.sql` solo crea el invocador y programa `omniquest-teacher-audit-export-worker`. Su plan de compensación está en:

`docs/runbooks/rollback/20260807113500_teacher_audit_export_worker.compensating.sql`

El plan desprograma el cron y elimina `public.invoke_teacher_audit_export_processor()` **sin borrar** `teacher_audit_export_requests` ni los ficheros ya generados. Si alguna vez se necesita aplicar, crea primero una migración nueva con timestamp posterior y copia/revisa ese SQL; el archivo del runbook no se aplica automáticamente.

## Restauración de backup

Consulta `BACKUP.md`. Una restauración gestionada puede implicar indisponibilidad del proyecto y debe tratarse como operación de recuperación, no como mecanismo habitual de rollback. Recuerda además que los backups de base de datos no restauran los binarios eliminados de Supabase Storage.

## Validación posterior

Ejecuta `supabase/snippets/operational_health.sql`, revisa Edge Functions/API logs y confirma que cron, colas, exportaciones, correo y push vuelven a progresar. No cierres el rollback mientras queden trabajos `failed`, reintentos vencidos, `processing` bloqueados o anomalías de auditoría sin explicar.

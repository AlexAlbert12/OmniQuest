# Runbook de rollback

## Principio

Supabase/PostgreSQL no revierte automáticamente una migración remota. El rollback se implementa como una migración compensatoria o mediante restauración controlada de backup.

## Procedimiento

1. Detener despliegues y procesadores que escriban en las tablas afectadas.
2. Clasificar el fallo: aplicación, permisos, función, datos o cambio destructivo.
3. Preferir un fix-forward compatible cuando los datos ya se han escrito con el nuevo esquema.
4. Para cambios reversibles, crear una migración compensatoria nueva y probarla desde un backup/local.
5. Para pérdida o corrupción, restaurar el backup en un entorno aislado, validar y seguir el procedimiento de recuperación del proveedor.
6. Revertir Edge Functions o frontend a la versión compatible con el esquema activo.
7. Documentar impacto, datos afectados, tiempos y acciones preventivas.

Nunca elimines manualmente una fila del historial de migraciones para simular una reversión.

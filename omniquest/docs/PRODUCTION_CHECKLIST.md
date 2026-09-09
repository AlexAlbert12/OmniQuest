# Checklist de producción

## Calidad

- [ ] `npm ci` y `npm run quality:install` completados.
- [ ] Lint y ambos typechecks sin errores.
- [ ] Tests source, unitarios, SQL y Edge Functions superados.
- [ ] Build web y E2E mínimo superados.
- [ ] Revisión móvil Maestro realizada para la release.
- [ ] Build Android `production` generada como AAB y build `tfm-apk`/`preview` reservada para instalación directa.

## Datos y seguridad

- [ ] Backup/PITR anterior a la release identificado o backup lógico generado.
- [ ] `npm run release:baseline` completado y `release-manifest.json` conservado fuera de Git.
- [ ] Lista remota de migraciones y `db push --dry-run` revisados antes del push.
- [ ] Referencia de frontend anterior y copia de Edge Functions desplegadas conservadas.
- [ ] Migración compensatoria/fix-forward definida para los cambios reversibles de la release.
- [ ] Rollback preparado sin borrar ni manipular filas del historial de migraciones.
- [ ] Migraciones probadas desde una base vacía.
- [ ] RLS activa en tablas expuestas y grants revisados.
- [ ] RPC críticas verifican identidad, propiedad y rol.
- [ ] Secrets configurados y no presentes en repositorio/logs.
- [ ] Cuentas demo/E2E ausentes del entorno productivo o con contraseñas rotadas y acceso restringido.
- [ ] Contraseña del administrador de producción rotada, única y no reutilizada en documentación, demos o pruebas.
- [ ] Buckets privados, políticas y expiración de URLs revisados.

## Operaciones

- [ ] Todas las Edge Functions del catálogo desplegadas.
- [ ] Cron/secrets internos validados para procesadores sin JWT de gateway.
- [ ] Correo, push, exportaciones y soporte probados end-to-end.
- [ ] Logs de Edge Functions y PostgREST/API revisados durante la ventana de observación.
- [ ] `cron.job_run_details` y respuestas `pg_net` sin fallos nuevos.
- [ ] Colas sin `retry` vencidos, `failed` inexplicados ni `processing` bloqueados.
- [ ] Exportaciones, correo y push receipts progresan correctamente.
- [ ] Anomalías de auditoría revisadas y justificadas/reconocidas.
- [ ] `supabase/snippets/operational_health.sql` ejecutado al inicio y cierre de la ventana.
- [ ] Logs, alertas y retención configurados.
- [ ] Política de auditoría y captura de contexto revisada legalmente.

## Producto

- [ ] Login, registro, recuperación y cierre de sesión probados.
- [ ] Flujo de juego seguro completo probado.
- [ ] Recorridos de alumno, profesor y administrador verificados.
- [ ] Responsive, teclado, lectores de pantalla y escalado de texto revisados.
- [ ] Documentación, matriz de permisos y catálogo generados.

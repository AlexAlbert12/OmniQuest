# Checklist de producción

## Calidad

- [ ] `npm ci` y `npm run quality:install` completados.
- [ ] Lint y ambos typechecks sin errores.
- [ ] Tests source, unitarios, SQL y Edge Functions superados.
- [ ] Build web y E2E mínimo superados.
- [ ] Revisión móvil Maestro realizada para la release.

## Datos y seguridad

- [ ] Backup y rollback preparados.
- [ ] Migraciones probadas desde una base vacía.
- [ ] RLS activa en tablas expuestas y grants revisados.
- [ ] RPC críticas verifican identidad, propiedad y rol.
- [ ] Secrets configurados y no presentes en repositorio/logs.
- [ ] Buckets privados, políticas y expiración de URLs revisados.

## Operaciones

- [ ] Todas las Edge Functions del catálogo desplegadas.
- [ ] Cron/secrets internos validados para procesadores sin JWT de gateway.
- [ ] Correo, push, exportaciones y soporte probados end-to-end.
- [ ] Logs, alertas y retención configurados.
- [ ] Política de auditoría y captura de contexto revisada legalmente.

## Producto

- [ ] Login, registro, recuperación y cierre de sesión probados.
- [ ] Flujo de juego seguro completo probado.
- [ ] Recorridos de alumno, profesor y administrador verificados.
- [ ] Responsive, teclado, lectores de pantalla y escalado de texto revisados.
- [ ] Documentación, matriz de permisos y catálogo generados.

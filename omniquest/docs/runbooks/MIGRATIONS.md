# Runbook de migraciones

## Antes del despliegue

1. Crear una migración nueva; no editar una migración ya aplicada en entornos compartidos.
2. Ejecutar `npm run test:migrations`.
3. Ejecutar `npx supabase db reset` y `npm run test:db`.
4. Revisar locks, duración, backfills, tamaño de tablas e índices concurrentes cuando aplique.
5. Regenerar tipos y catálogo: `npm run types:supabase` y `npm run docs:generate`.
6. Preparar rollback y backup antes de cualquier cambio destructivo.
7. Ejecutar `npm run release:baseline` antes del push remoto para conservar evidencia, dry run, historial remoto y Edge Functions desplegadas.

## Aplicación

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Registrar la versión, hora, responsable y resultado. El baseline de `docs/runbooks/BACKUP.md` debe existir antes del `db push`. No cerrar la ventana de observación hasta comprobar API, logs, jobs, colas y recorridos críticos mediante `docs/runbooks/OBSERVABILITY.md`.

## Después

- Confirmar `migration list` sin pendientes.
- Ejecutar smoke tests y consultas de integridad.
- Revisar errores de PostgREST, Edge Functions y cron.
- Verificar que los tipos TypeScript reflejan las nuevas firmas.

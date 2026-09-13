# Despliegue de OmniQuest

## 1. Requisitos

- Node.js compatible con Expo SDK 54.
- Supabase CLI y Docker para validación local.
- Proyecto Supabase vinculado para despliegue remoto.
- Variables públicas de Expo y secrets de backend configurados fuera del repositorio.

## 2. Preparación reproducible

```bash
npm ci
npm run quality:install
npm run lint
npm run typecheck
npm run typecheck:tests
npm test
npm run test:migrations
npm run docs:check
```

`quality:install` instala versiones controladas y compatibles de Jest, React Native Testing Library y Playwright sin modificar el lockfile de la aplicación. En CI se ejecuta después de `npm ci`.

## 3. Base de datos local

```bash
npx supabase start
npx supabase db reset
npm run test:db
```

`db reset` reconstruye el esquema desde cero, aplica todas las migraciones y permite detectar dependencias accidentales entre entornos.

## 4. Migraciones remotas

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
```

Antes de ejecutar el push real, revisa el runbook de [migraciones](runbooks/MIGRATIONS.md), prepara el [backup](runbooks/BACKUP.md) y registra la versión anterior con:

```bash
npm run release:baseline -- --backup-ref "Supabase backup/PITR <fecha-hora UTC>" --frontend-ref "<git-tag-commit-EAS-build-o-release-web>"
```

En un proyecto sin un backup gestionado adecuado puedes sustituir `--backup-ref` por `--logical-backup`. El baseline guarda la lista remota de migraciones, el dry run, el inventario de funciones y descarga las Edge Functions actualmente desplegadas antes de sustituirlas. `release-artifacts/` no se versiona porque un dump lógico puede contener datos personales.

Solo después de revisar esas evidencias:

```bash
npx supabase db push
```

El procedimiento de reversión está en [rollback](runbooks/ROLLBACK.md). No se eliminan filas del historial de migraciones para hacer rollback.

## 5. Secrets

Como mínimo, configura los secretos que utilicen las funciones habilitadas:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
npx supabase secrets set RESEND_API_KEY="..."
npx supabase secrets set MAIL_FROM="OmniQuest <no-reply@dominio.example>"
npx supabase secrets set SITE_URL="https://tu-dominio.example"
npx supabase secrets set ADMIN_INVITE_REDIRECT_TO="https://tu-dominio.example/update-password"
```


Para probar correos con cuentas demo sin enviar mensajes al destinatario real, usa `EMAIL_DELIVERY_MODE=redirect` y configura `RESEND_TEST_TO`. La invitación de nuevos administradores se genera en servidor con Supabase Auth y utiliza `ADMIN_INVITE_REDIRECT_TO` (o `SITE_URL/update-password` como fallback).

Los procesadores programados requieren además su secreto compartido correspondiente en Edge Functions y Vault:

| Procesador | Secreto interno |
|---|---|
| `process-account-requests` | `ACCOUNT_REQUESTS_CRON_SECRET` |
| `process-notification-delivery` | `PUSH_QUEUE_SECRET` |
| `process-teacher-digests` | `DIGEST_QUEUE_SECRET` |
| `cleanup-question-media` | `QUESTION_MEDIA_CLEANUP_SECRET` |
| `process-support-email-delivery` | `SUPPORT_EMAIL_QUEUE_SECRET` |
| `process-admin-export-jobs` | `ADMIN_EXPORT_QUEUE_SECRET` |
| `process-teacher-audit-exports` | `TEACHER_AUDIT_EXPORT_SECRET` |

No incluyas claves reales en `.env.example`, documentación, logs o commits. `auth-attempt-guard` no usa un secreto de cola, pero aplica su propio control de abuso y no debe interpretarse como una operación privilegiada anónima.

## 6. Edge Functions

El listado se descubre automáticamente desde `supabase/functions/`; no se mantiene una lista manual.

```bash
npm run deploy:functions
```

También se conservan wrappers multiplataforma:

```bash
./scripts/deploy-functions.sh
```

```powershell
./scripts/deploy-functions.ps1
```

Para desplegar una selección:

```bash
node scripts/deploy-edge-functions.mjs send-push-notification process-notification-delivery
```

El script consulta `supabase/config.toml` y añade `--no-verify-jwt` únicamente a las funciones que lo declaran. Después verifica el inventario con:

```bash
npx supabase functions list
npm run docs:generate
```

El catálogo actual está en [generated/BACKEND_CATALOG.md](generated/BACKEND_CATALOG.md).

## 7. Tipos Supabase

Después de cambiar el esquema remoto:

```bash
npm run types:supabase
npm run typecheck
```

Revisa los cambios del archivo generado para detectar firmas RPC eliminadas o parámetros incompatibles.

## 8. Build web y E2E

```bash
npm run build:web
npx playwright install chromium
npm run test:e2e
```

Playwright inicia Expo Web mediante `webServer`, ejecuta los smoke tests en viewport móvil y escritorio y conserva trazas, vídeos y capturas cuando corresponde.

## 9. Publicación

El perfil `production` genera un Android App Bundle (`.aab`) para Google Play. Los perfiles `preview` y `tfm-apk` generan APK instalables para validación y defensa; no deben confundirse con el artefacto de tienda.

Antes de publicar, completa [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md). El pipeline de `../.github/workflows/quality.yml` (en la raíz del repositorio) constituye el mínimo automatizado; no sustituye las comprobaciones de secrets, cron, correo, push, backup y observabilidad del entorno real.

Tras el despliegue abre una ventana de observación y sigue [OBSERVABILITY.md](runbooks/OBSERVABILITY.md). El snippet `supabase/snippets/operational_health.sql` comprueba ejecuciones de cron, respuestas de `pg_net`, colas, exportaciones, correo, push tickets sin receipt y anomalías de auditoría.

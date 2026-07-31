# Despliegue de Supabase

Esta guía documenta el despliegue mínimo de Supabase para OmniQuest: migraciones, tipos, Edge Functions y secrets. Está pensada para que el proyecto sea reproducible en una demo, en un entorno local o en un proyecto remoto de Supabase.

## Requisitos

- Supabase CLI instalada y autenticada.
- Proyecto Supabase creado.
- Variables públicas de Expo configuradas en `omniquest/.env`.
- Permisos para configurar secrets y desplegar Edge Functions.

## 1. Vincular proyecto remoto

Desde la carpeta `omniquest/`:

```bash
supabase link --project-ref TU_PROJECT_REF
```

## 2. Aplicar migraciones

```bash
supabase db push
```

Si estás trabajando en local:

```bash
supabase start
supabase db reset
```

## 3. Configurar secrets de Edge Functions

Secrets obligatorios para funciones que usan service role:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
```

Secrets recomendados para envío de emails transaccionales:

```bash
supabase secrets set RESEND_API_KEY="TU_RESEND_API_KEY"
supabase secrets set MAIL_FROM="OmniQuest <no-reply@tu-dominio.com>"
```

Las exportaciones y solicitudes de borrado asíncronas requieren un secreto
compartido entre Vault y la Edge Function:

```bash
supabase secrets set ACCOUNT_REQUESTS_CRON_SECRET="UN_SECRETO_LARGO_Y_ALEATORIO"
supabase functions deploy process-account-requests --no-verify-jwt
```

En Supabase Vault crea también `project_url` con la URL del proyecto y
`account_requests_secret` con exactamente el mismo valor. La migración programa
el procesador cada cinco minutos; sin estos secretos el cron es un no-op seguro.

Notas:

- `SUPABASE_URL` y `SUPABASE_ANON_KEY` suelen estar disponibles automáticamente en Edge Functions de Supabase.
- `RESEND_API_KEY` y `MAIL_FROM` no bloquean la importación de alumnos: si faltan, la app importa y marca los emails como no enviados.
- Nunca subas `SUPABASE_SERVICE_ROLE_KEY` ni claves reales al repositorio.
- Nunca subas `ACCOUNT_REQUESTS_CRON_SECRET`; el header secreto protege la función que ejecuta el cron.

## 4. Desplegar Edge Functions

Funciones actuales:

```text
admin-archive-course
admin-create-teacher
admin-deactivate-classroom
admin-delete-student-progress
admin-reset-password
admin-toggle-user
delete-account
import-students
profile-update-avatar
student-reset-own-progress
teacher-archive-subject
teacher-create-topic
teacher-delete-question
teacher-regenerate-class-code
teacher-remove-student-from-class
teacher-reset-own-data
teacher-reset-student-progress
teacher-student-reminder
teacher-update-subject
teacher-update-topic
process-account-requests
```

Despliegue directo:

```bash
supabase functions deploy admin-archive-course admin-create-teacher admin-deactivate-classroom admin-delete-student-progress admin-reset-password admin-toggle-user delete-account import-students profile-update-avatar student-reset-own-progress teacher-archive-subject teacher-create-topic teacher-delete-question teacher-regenerate-class-code teacher-remove-student-from-class teacher-reset-own-data teacher-reset-student-progress teacher-student-reminder teacher-update-subject teacher-update-topic
```

También puedes usar los scripts versionados:

```bash
# macOS/Linux/WSL/Git Bash
./scripts/deploy-functions.sh

# Windows PowerShell
./scripts/deploy-functions.ps1
```

Si quieres desplegar solo algunas funciones, usa el comando `supabase functions deploy` con sus nombres concretos.

## 5. Regenerar tipos

Después de aplicar migraciones, regenera `types/database.types.ts`.

Proyecto local:

```bash
npx supabase gen types typescript --local > types/database.types.ts
```

Proyecto remoto:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_REF > types/database.types.ts
```

## 6. Checklist de verificación

- `supabase db push` termina sin errores.
- Todas las Edge Functions se despliegan correctamente.
- `SUPABASE_SERVICE_ROLE_KEY` está configurada.
- `RESEND_API_KEY` y `MAIL_FROM` están configuradas si quieres emails reales.
- `types/database.types.ts` está regenerado.
- La importación de alumnos funciona incluso si Resend no está configurado.
- El portal admin puede ejecutar acciones sensibles.
- El profesor puede crear/editar cursos, temas y alumnos mediante Edge Functions.
- El alumno puede jugar, sincronizar puntos y consultar progreso.
- Las solicitudes de exportación pasan de `queued` a `ready` y generan una notificación.
- Las solicitudes de borrado pueden cancelarse durante el plazo de 7 días.

## 7. Comandos habituales

```bash
# Ver funciones desplegadas
supabase functions list

# Ver secrets configurados
supabase secrets list

# Ver logs de una función
supabase functions logs import-students

# Reaplicar migraciones pendientes
supabase db push
```

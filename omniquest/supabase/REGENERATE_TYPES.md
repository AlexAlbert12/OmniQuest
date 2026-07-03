# Regenerar tipos de Supabase

Después de aplicar todas las migraciones en Supabase, regenera el archivo de tipos con:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > types/database.types.ts
```

Si trabajas contra una base local:

```bash
npx supabase gen types typescript --local > types/database.types.ts
```

Este ZIP ya incluye `types/database.types.ts` actualizado manualmente según las migraciones actuales del proyecto, incluyendo `public.notifications`, `public.admin_audit_logs` y la RPC `create_notification`.

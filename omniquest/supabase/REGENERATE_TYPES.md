# Regenerar tipos de Supabase

El proyecto incluye `supabase/config.toml`, así que puedes levantar una base local reproducible desde la raíz del proyecto:

```bash
supabase start
supabase db reset
```

Después de aplicar todas las migraciones en local, regenera los tipos con:

```bash
npx supabase gen types typescript --local > types/database.types.ts
```

Si trabajas contra una base remota:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > types/database.types.ts
```

Este ZIP ya incluye `types/database.types.ts` actualizado manualmente según las migraciones actuales del proyecto, incluyendo `public.notifications`, `public.admin_audit_logs` y la RPC `create_notification`.

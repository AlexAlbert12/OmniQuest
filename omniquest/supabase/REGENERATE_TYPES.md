# Regenerar tipos de Supabase

El proyecto incluye `supabase/config.toml`, por lo que puedes levantar una base local reproducible desde la raíz:

```bash
npx supabase start
npx supabase db reset
```

Después de aplicar todas las migraciones, regenera siempre los tipos desde el esquema real:

```bash
npm run types:supabase
```

El script enlazado ejecuta:

```bash
supabase gen types typescript --linked --schema public > types/database.types.ts
```

Para una base local también puedes usar:

```bash
npx supabase gen types typescript --local --schema public > types/database.types.ts
```

El archivo incluido en este ZIP se ha actualizado con las tablas y RPC recientes, entre ellas:

- `analytics_events`
- `avatar_frames`
- `game_answer_submission_receipts`
- `profile_cosmetics`
- `push_tokens`
- `submit_answer_resumable`
- `get_ranking_profiles_page`
- `register_push_token`
- `get_teacher_audit_logs_page`
- `search_app_entities`
- `get_admin_usage_analytics`
- `get_profile_cosmetics`
- `create_teacher_notification`

`create_notification` es una función interna. Aunque aparezca en el tipo generado por pertenecer al esquema `public`, los roles `anon` y `authenticated` no tienen permiso para ejecutarla. El cliente debe usar RPC específicas y validadas, como `create_teacher_notification`.

Después de regenerar, ejecuta:

```bash
npm run typecheck
npm run test:source
```

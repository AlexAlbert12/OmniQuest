# Pruebas de OmniQuest

El proyecto incluye dos capas de pruebas que no dependen de datos de producción.

## Contratos de código

```bash
npm test
```

Ejecuta pruebas con el runner integrado de Node para comprobar que:

- el cliente del alumno no consulta directamente `questions` ni `answers`;
- el juego usa `get_safe_game_questions`, `submit_answer` y `get_attempt_feedback`;
- el historial usa resúmenes seguros y carga el detalle después del intento;
- login, formulario de preguntas e importación mantienen sus contratos críticos.

## RLS y RPC de Supabase

Requiere Docker y Supabase CLI:

```bash
supabase start
supabase db reset
npm run test:db
```

La suite `supabase/tests/001_secure_student_game_data.sql` valida:

- permisos de alumno, profesor y administrador;
- bloqueo del acceso directo de alumnos a `questions` y `answers`;
- ausencia de `explanation` e `is_correct` en preguntas previas al intento;
- corrección en servidor mediante `submit_answer`;
- generación y persistencia de XP;
- feedback posterior al intento;
- aislamiento entre alumnos;
- desbloqueo del primer logro.

## Validación completa

```bash
npm run lint
npm run typecheck
npm run test:security
```

Antes de probar contra un proyecto remoto, aplica la migración:

```bash
supabase db push
```

Después de regenerar el esquema, actualiza los tipos cuando sea necesario:

```bash
supabase gen types typescript --linked --schema public > types/database.types.ts
```

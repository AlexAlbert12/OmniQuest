# Cambios de preparación de los recorridos autenticados

## Estado

- Auditoría estática: PASS.
- Ejecución contra Supabase local: pendiente en el equipo de validación.
- Migraciones acumuladas: 80.
- Suites pgTAP: 11, con 277 aserciones previstas.
- Pruebas de código fuente ejecutadas: 166.
- Pruebas de código fuente aprobadas: 166.
- Llamadas cliente inventariadas: 221.
- Recursos inventariados: 17 tablas directas, 113 RPC y 17 Edge Functions.

## Correcciones principales

1. Se añadió una matriz final de permisos de mínimo privilegio para los recursos utilizados por los recorridos.
2. La edición directa de perfiles se limita a `alias` y `visibility`.
3. La creación y mutación de clases, temas, preguntas y recursos sensibles permanece en RPC o Edge Functions protegidas.
4. Se eliminó el fallback cliente que escribía directamente en `notifications`.
5. Las exportaciones CSV neutralizan `=`, `+`, `-`, `@`, tabulador y retorno de carro.
6. Las activaciones y desactivaciones masivas generan auditoría individual.
7. La verificación posterior comprueba multimedia privada, conservación de intentos, idempotencia, soporte, auditoría, exportación CSV y el 403 del auditor.
8. Se añadieron scripts para preparar secretos locales sin mostrarlos y procesar exportaciones pendientes.
9. Se añadió una suite pgTAP que valida el estado efectivo de tablas, secuencias, RPC, RLS y `service_role`.
10. Se añadió un inventario reproducible de las llamadas Supabase utilizadas por la aplicación.

## Archivos añadidos

- `docs/generated/AUTHENTICATED_WALKTHROUGH_AUDIT.md`
- `docs/generated/AUTHENTICATED_WALKTHROUGH_CALLS.json`
- `docs/generated/AUTHENTICATED_WALKTHROUGH_CHANGELOG.md`
- `docs/generated/AUTHENTICATED_WALKTHROUGH_READINESS.md`
- `scripts/audit-authenticated-walkthrough.mjs`
- `scripts/prepare-local-function-env.mjs`
- `scripts/process-demo-workers.mjs`
- `supabase/functions/.env.example`
- `supabase/migrations/20260805200000_authenticated_walkthrough_authorization_matrix.sql`
- `supabase/tests/011_authenticated_walkthrough_authorization.sql`
- `tests/source/authenticated-walkthrough-readiness.test.mjs`

## Archivos modificados

- `.gitignore`
- `docs/generated/BACKEND_CATALOG.md`
- `lib/notifications/persistent.ts`
- `lib/reportExports.ts`
- `package.json`
- `scripts/verify-authenticated-demo.mjs`
- `supabase/functions/_shared/csv.ts`
- `supabase/functions/_shared/csv_test.ts`
- `supabase/functions/admin-bulk-operations/index.ts`
- `supabase/tests/010_release_authorization_hardening.sql`
- `tests/source/release-security-hardening.test.mjs`

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `node --check scripts/audit-authenticated-walkthrough.mjs` | PASS |
| `node --check scripts/prepare-local-function-env.mjs` | PASS |
| `node --check scripts/process-demo-workers.mjs` | PASS |
| `node --check scripts/verify-authenticated-demo.mjs` | PASS |
| `npm run test:migrations` | PASS: 80 migraciones y 11 archivos SQL validados |
| `npm run test:source` | PASS: 166/166 |
| `npm run docs:check` | PASS: 32 Edge Functions, 68 tablas y 234 funciones SQL |
| `npm run audit:walkthrough` | PASS: 221 llamadas y 0 incidencias estructurales |

## Validaciones no ejecutadas en este entorno

No estaban disponibles Docker, Supabase CLI, PostgreSQL ni Deno. Por ello no se ejecutaron realmente:

- `npx supabase migration up --local`
- `npx supabase test db --debug`
- `npm run demo:prepare`
- `npm run demo:verify`
- `npm run demo:verify:after`
- pruebas E2E contra la aplicación local
- pruebas de Edge Functions con Deno

La instalación limpia de dependencias con `npm ci` tampoco pudo completarse dentro del límite del entorno, por lo que no se declaran como ejecutados `typecheck`, `lint`, pruebas unitarias dependientes de paquetes ni `build:web`.

## Aplicación local

No requiere `db reset`. Desde la raíz del proyecto:

```powershell
npx supabase migration up --local
npm run test:migrations
npm run test:source
npm run docs:check
npm run audit:walkthrough
npx supabase test db --debug
npm run demo:prepare-functions-env
$env:OMNIQUEST_DEMO_PASSWORD = 'TU_PASSWORD_DEMO'
npm run demo:prepare
npm run demo:diagnose-auth
npm run demo:verify
npx supabase functions serve --env-file .\supabase\functions\.env --debug
```

Después del recorrido y de solicitar las exportaciones:

```powershell
npm run demo:process-workers
npm run demo:verify:after
```

El cierre funcional exige que pgTAP, la verificación previa, el recorrido manual y la verificación posterior terminen correctamente contra el mismo Supabase local utilizado por Expo.

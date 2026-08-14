# 7. E2E web autenticados mínimos

## Objetivo

La validación E2E autenticada cubre los recorridos mínimos de alumno, profesor y administrador en las dos configuraciones Chromium definidas por el proyecto: escritorio y móvil. Cada prueba inicia sesión mediante la interfaz, captura una respuesta real de Supabase, valida su contenido y ejecuta una acción propia del rol.

## Casos implementados

- `student-authenticated.spec.ts`: valida la matrícula obtenida desde `enrollments`, abre el curso, comprueba el tema cargado desde `subject_topics` e inicia una partida mediante `get_safe_game_questions` y `start_game_attempt`.
- `teacher-authenticated.spec.ts`: valida el curso devuelto por `get_teacher_courses_page`, abre su detalle mediante `get_teacher_subject_overview` y accede al editor de preguntas.
- `admin-authenticated.spec.ts`: valida el profesor devuelto por `get_admin_profiles_page`, abre auditoría, comprueba `get_admin_audit_policy` y ejecuta `verify_admin_audit_chain`.

## Credenciales

Las credenciales no están almacenadas en el repositorio. Deben proporcionarse mediante:

```text
E2E_STUDENT_EMAIL
E2E_STUDENT_PASSWORD
E2E_TEACHER_EMAIL
E2E_TEACHER_PASSWORD
E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
```

Cuando las seis variables están definidas, el `globalSetup` ejecuta `scripts/prepare-authenticated-e2e.mjs`. Este script usa exclusivamente Supabase local y prepara de forma idempotente las tres cuentas, el rol `super_admin`, un curso, una clase, un tema, una pregunta y la matrícula del alumno.

La ejecución completa mediante `npm run test:e2e` exige las seis variables en la misma terminal. Si falta alguna, el `globalSetup` termina inmediatamente para impedir que los recorridos autenticados aparezcan como omitidos. Para ejecutar deliberadamente solo las pruebas públicas puede definirse `E2E_ALLOW_AUTH_SKIP=1`.

## Servidor web aislado

Playwright usa el puerto `8082` por defecto para no competir con el servidor de desarrollo habitual de Expo en `8081`. `scripts/start-playwright-web.mjs` comprueba que el puerto esté libre antes de iniciar Expo y falla con un mensaje explícito en vez de aceptar el cambio interactivo a otro puerto.

Puede elegirse otro puerto antes de ejecutar las pruebas:

```powershell
$env:PLAYWRIGHT_PORT = '8090'
npm run test:e2e
```

Si se reutiliza un servidor existente, debe responder en la misma URL configurada por `PLAYWRIGHT_PORT` o `PLAYWRIGHT_BASE_URL`.

## Ejecución local

Con Docker Desktop y Supabase local activos:

```powershell
cd omniquest

$env:E2E_STUDENT_EMAIL = 'e2e.student@omniquest.test'
$env:E2E_STUDENT_PASSWORD = '<contraseña segura>'
$env:E2E_TEACHER_EMAIL = 'e2e.teacher@omniquest.test'
$env:E2E_TEACHER_PASSWORD = '<contraseña segura>'
$env:E2E_ADMIN_EMAIL = 'e2e.admin@omniquest.test'
$env:E2E_ADMIN_PASSWORD = '<contraseña segura>'
$env:PLAYWRIGHT_PORT = '8082'

npx supabase migration up --local
npm run e2e:prepare
npx playwright install chromium
npm run test:e2e
```

`npm run e2e:prepare` es opcional porque Playwright lo ejecuta automáticamente mediante `globalSetup`; resulta útil para diagnosticar la preparación de datos antes de abrir el navegador. Las variables `$env:E2E_*` solo existen en la ventana actual de PowerShell, por lo que deben definirse de nuevo al abrir otra terminal.

El frontend debe apuntar al entorno local:

```text
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clave pública local>
PLAYWRIGHT_SUPABASE_URL=http://127.0.0.1:54321
```

## Conflictos de puerto en Windows

Comprueba qué proceso utiliza el puerto E2E:

```powershell
Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State, OwningProcess
```

Consulta el proceso:

```powershell
Get-Process -Id <PID>
```

Si es una instancia antigua de Expo o Node, ciérrala:

```powershell
Stop-Process -Id <PID> -Force
```

No es necesario cerrar Expo en `8081`, porque los E2E utilizan `8082`.

## GitHub Actions

El workflow `../.github/workflows/quality.yml` (en la raíz del repositorio) ejecuta tres trabajos independientes:

1. `application`: lint, tipos, pruebas de código y build web.
2. `backend`: migraciones, pgTAP y pruebas Deno.
3. `web-e2e`: Supabase local limpio, credenciales E2E temporales, Edge Functions, Chromium y los dos proyectos Playwright.

El trabajo `web-e2e` usa `PLAYWRIGHT_PORT=8082`, genera una contraseña temporal en memoria y la oculta en los logs. No necesita guardar las seis credenciales como secretos del repositorio.

Para comprobarlo en GitHub, el archivo debe estar versionado en la raíz real del repositorio y presente en la rama por defecto. En la pestaña `Actions`, abre `Quality`, pulsa `Run workflow` y ejecuta la rama que contiene los cambios. El punto se considera validado en CI cuando los trabajos `application`, `backend` y `web-e2e` aparecen en verde.

El artefacto `playwright-report` se publica incluso cuando las pruebas fallan. Contiene el informe HTML, trazas, capturas, vídeos y `edge-functions.log` cuando esos archivos existen.

## Criterio de aceptación

La ejecución debe terminar correctamente en:

```text
chromium-desktop
chromium-mobile
```

Las pruebas no se consideran válidas por una simple carga de URL. Cada especificación debe conservar la comprobación de una respuesta real de Supabase y la interacción relevante del rol.

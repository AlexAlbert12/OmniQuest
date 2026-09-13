# Validación autenticada de los tres roles

## Alcance

Esta validación se realiza únicamente contra Supabase local o contra un proyecto de demostración desechable. Las cuentas y contenidos empleados no contienen datos personales reales.

El orden recomendado es profesor, alumno y administrador. El curso, la clase y las preguntas deben existir antes de comprobar la experiencia del alumno.

## Preparación

1. Iniciar Docker y Supabase local.
2. Aplicar todas las migraciones mediante `npx supabase db reset --local`.
3. Definir una contraseña temporal en la sesión de PowerShell:

```powershell
$env:OMNIQUEST_DEMO_PASSWORD = 'SustituirPorUnaClaveSegura!2026'
npm run demo:prepare
npm run demo:verify
```

El preparador crea:

| Cuenta | Rol |
|---|---|
| `demo.student@omniquest.test` | Alumno principal |
| `demo.teacher@omniquest.test` | Profesor |
| `demo.admin@omniquest.test` | Administrador global |
| `demo.auditor@omniquest.test` | Administrador sin permisos de gestión |
| `demo.imported@omniquest.test` | Alumno para importación y prueba CSV |

Casos negativos disponibles:

- código inexistente: `NOEXISTE`;
- código de clase caducado: `EXPCL001`;
- curso archivado: `ARCHCL01`.

## Ejecutar la aplicación web contra local

```powershell
$status = npx supabase status -o env
$env:EXPO_PUBLIC_SUPABASE_URL = (($status | Select-String '^API_URL=').Line -split '=', 2)[1].Trim('"')
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = (($status | Select-String '^ANON_KEY=').Line -split '=', 2)[1].Trim('"')
npx expo start --web --port 8081 -c
```

No reutilizar una pestaña con una sesión anterior. Cerrar sesión entre roles y comprobar que cada cuenta aterriza en su portal correspondiente.

## Profesor

1. Iniciar sesión como `demo.teacher@omniquest.test`.
2. Crear un curso desde `/create-subject`.
3. Abrir el curso y comprobar que existen una clase principal y un tema inicial.
4. Crear una pregunta de cada tipo:
   - opción múltiple;
   - verdadero/falso;
   - respuesta abierta;
   - rellenar huecos;
   - ordenar;
   - unir parejas;
   - asignar destinos.
5. Añadir una imagen pequeña a una de las preguntas, incluyendo texto alternativo.
6. Importar `demo.imported@omniquest.test` en la clase principal.
7. Abrir el directorio de alumnos, cambiar de página o tamaño de página y confirmar que la consulta sigue siendo paginada.
8. Enviar un recordatorio al alumno importado. En entornos con correo configurado, usar `EMAIL_DELIVERY_MODE=redirect`.
9. Anotar el código de la clase principal para la prueba del alumno.
10. Tras la partida del alumno, abrir el panel de alumnos, progreso y alumnos en riesgo.
11. Revisar la respuesta abierta y confirmar que el estado cambia para el alumno.
12. Abrir el informe de una pregunta.
13. Exportar la lista o informe disponible en web.
14. Archivar una pregunta que ya tenga intentos. Confirmar posteriormente que los intentos históricos permanecen.
15. Abrir auditoría y localizar las acciones realizadas.

## Alumno

1. Iniciar sesión como `demo.student@omniquest.test`.
2. Probar `NOEXISTE`; debe rechazarse.
3. Probar `EXPCL001`; debe indicar que el código ha caducado.
4. Probar `ARCHCL01`; debe indicar que el curso no está disponible.
5. Introducir el código de la clase creada por el profesor.
6. Confirmar que solo aparece el curso matriculado.
7. Repetir el mismo código; debe indicarse que ya está matriculado.
8. Empezar una partida y responder al menos tres tipos de pregunta, incluida la respuesta abierta.
9. Interrumpir la partida cerrando la pestaña o navegando fuera después de guardar una respuesta.
10. Volver a entrar y reanudar. La respuesta ya enviada no debe repetirse ni duplicar XP.
11. En las herramientas de desarrollo del navegador, activar modo offline antes de enviar otra respuesta. Restaurar la red y comprobar la sincronización.
12. Finalizar la partida.
13. Comprobar XP, progreso, ranking e historial.
14. Abrir logros y ejecutar la sincronización si está disponible.
15. Crear un ticket de soporte con un asunto identificable, por ejemplo `Validación funcional alumno`.
16. Cerrar sesión, volver a iniciar sesión y confirmar persistencia de progreso e historial.

## Administrador global

1. Iniciar sesión como `demo.admin@omniquest.test`.
2. Abrir dashboard, usuarios, profesores, alumnos, cursos y clases.
3. Buscar las cuentas demo, el curso creado y su clase.
4. Desactivar `demo.imported@omniquest.test` con un motivo de al menos cinco caracteres y reactivarlo.
5. Abrir la gestión de roles y confirmar que la cuenta principal tiene `super_admin` y la cuenta restringida tiene `auditor`.
6. Archivar el curso creado y restaurarlo.
7. Desactivar la clase principal. Reactivarla al terminar para no bloquear otras comprobaciones.
8. Abrir soporte, atender el ticket creado por el alumno y añadir una nota interna.
9. Abrir auditoría y comparar los estados anterior y posterior de usuario, curso, clase y ticket.
10. Solicitar una exportación de perfiles. El perfil `demo.imported@omniquest.test` tiene un alias que comienza por `=` para verificar la neutralización de fórmulas.
11. Procesar la cola de exportaciones y descargar el CSV. El alias debe aparecer como `'=Demo CSV`, nunca como fórmula ejecutable.

## Administrador restringido

1. Iniciar sesión como `demo.auditor@omniquest.test`.
2. Confirmar que puede consultar auditoría y contenido permitido.
3. Confirmar que no aparecen acciones de gestión de usuarios o cursos.
4. Ejecutar `npm run demo:verify:after`; el verificador invoca `admin-toggle-user` con esta sesión y exige una respuesta HTTP 403.

## Correo redirigido

Crear `supabase/functions/.env.local`, que está ignorado por Git:

```text
EMAIL_DELIVERY_MODE=redirect
RESEND_TEST_TO=correo-de-pruebas@example.com
RESEND_API_KEY=clave-de-pruebas
MAIL_FROM=OmniQuest Demo <demo@dominio-verificado.example>
ADMIN_EXPORT_QUEUE_SECRET=omniquest-demo-export
SITE_URL=http://127.0.0.1:8081
PASSWORD_RESET_REDIRECT_TO=http://127.0.0.1:8081/update-password
ADMIN_INVITE_REDIRECT_TO=http://127.0.0.1:8081/update-password
```

Servir las funciones con esas variables en una terminal independiente:

```powershell
npx supabase functions serve --env-file supabase/functions/.env.local
```

No activar `EMAIL_DELIVERY_MODE=real` durante la validación.

## Procesar una exportación administrativa local

Después de solicitarla en el portal:

```powershell
$status = npx supabase status -o env
$apiUrl = (($status | Select-String '^API_URL=').Line -split '=', 2)[1].Trim('"')
Invoke-RestMethod -Method Post -Uri "$apiUrl/functions/v1/process-admin-export-jobs" -Headers @{ 'x-queue-secret' = 'omniquest-demo-export'; 'Content-Type' = 'application/json' } -Body '{}'
```

Actualizar el panel de exportaciones y descargar el trabajo con estado `ready`.

## Evidencia final

```powershell
$env:OMNIQUEST_DEMO_PASSWORD = 'LaMismaClaveUsadaEnLaPreparacion'
npm run demo:verify:after
```

El verificador exige cuentas, roles administrativos, curso y clase, los siete tipos de pregunta, matrículas, intentos, partida finalizada, XP, logro, ticket, revisión manual, auditoría docente, acciones administrativas, exportación lista y respuesta 403 del administrador restringido.

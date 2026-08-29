# OmniQuest · evidencia visual profunda

Estos flujos complementan la matriz principal y cubren estados que no aparecen en la navegación de primer nivel.

## Web desktop + web móvil

Ejecuta la matriz principal y la profunda sobre la URL publicada:

```powershell
$env:PLAYWRIGHT_BASE_URL="https://TU-PREVIEW.expo.app/"
npm run test:e2e:final-visual
```

El script ejecuta únicamente `chromium-desktop` y `chromium-mobile`. Las capturas quedan en `test-results/playwright` y `playwright-report`.

Cobertura profunda:

- Alumno: curso, tema/dificultad, pregunta, respuesta correcta, resultado, respuesta incorrecta y resultado.
- Profesor: crear curso, detalle de curso, crear clase, crear tema, crear pregunta, importar alumnos y editar contenido. Los formularios no se guardan.
- Admin: abrir ticket, modal de permisos, ficha filtrada de alumno y actividad del usuario.

> El recorrido de partida sí registra intentos reales en la cuenta demo de alumno, porque esa evidencia no puede generarse sin jugar. Usa siempre la cuenta de demo/E2E.

## Android con Maestro

Asegúrate de tener cargadas las variables `MAESTRO_*` y un único dispositivo Android operativo.

```powershell
maestro test --test-output-dir=.artifacts/maestro/student-deep .maestro/student-deep-ui-capture.yaml
maestro test --test-output-dir=.artifacts/maestro/teacher-deep .maestro/teacher-deep-ui-capture.yaml
maestro test --test-output-dir=.artifacts/maestro/admin-deep .maestro/admin-deep-ui-capture.yaml
```

Los flujos docentes y administrativos solo abren formularios/modales y no confirman operaciones destructivas. El flujo del alumno sí genera intentos de partida sobre el dataset demo.

## Evidencia final para revisión

```powershell
Compress-Archive -Path test-results,playwright-report -DestinationPath omniquest-web-final-complete.zip -Force
Compress-Archive -Path .artifacts\maestro -DestinationPath omniquest-android-final-complete.zip -Force
```

## Ejecución completa con un solo comando (Windows)

Para repetir toda la evidencia final sobre web desktop, web móvil y Android:

```powershell
.\scripts\run-final-visual-evidence.ps1 -Scope all
```

Si hay más de un dispositivo ADB conectado, indica el dispositivo explícitamente:

```powershell
.\scripts\run-final-visual-evidence.ps1 -Scope android -Device emulator-5554
```

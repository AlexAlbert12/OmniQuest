# 8. Expo Doctor y build Android instalable

## Objetivo

Este punto congela OmniQuest sobre Expo SDK 54, valida dependencias sin actualizaciones mayores, genera un APK `preview` mediante EAS Build y documenta la validación sobre un dispositivo Android real.

## Preflight local

Desde `omniquest`:

```powershell
npm run test:native-readiness
npx expo-doctor@latest
npx expo install --check
```

Durante el freeze no se utiliza `npm audit fix --force`. Si `expo install --check` propone cambios, revísalos individualmente antes de modificar el lockfile.

La comprobación estática `test:native-readiness` no sustituye a Expo Doctor: verifica además el perfil APK, esquema de deep links, módulos nativos que usa OmniQuest, flujos Maestro y la recuperación nativa de contraseña.

## EAS CLI y proyecto

El proyecto está enlazado mediante `expo.extra.eas.projectId` y el perfil `preview` usa distribución interna con `android.buildType=apk`.

Ejecuta:

```powershell
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest env:list --environment preview
```

El entorno `preview` debe contener al menos:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Estas variables son configuración pública del cliente. No uses `127.0.0.1`, `localhost` ni la URL de Supabase local en un APK que se instalará en un teléfono: el dispositivo necesita una URL HTTPS accesible desde Internet o desde su red.

Si todavía no existen en EAS, créalas en el entorno `preview` con los valores del backend de validación que vayas a usar.

## Push Android

`expo-notifications` y `extra.eas.projectId` están configurados en el cliente. Para recibir push remoto en Android también deben estar configuradas las credenciales FCM v1 del proyecto EAS y la aplicación Android debe estar registrada en Firebase. Esta parte no puede verificarse únicamente desde el repositorio.

Antes de declarar push como validado, revisa las credenciales Android con:

```powershell
npx eas-cli@latest credentials --platform android
```

No versionar claves privadas de cuentas de servicio.

## Generar el APK

```powershell
npx eas-cli@latest build --platform android --profile preview
```

El perfil `preview` produce un APK instalable. Guarda como evidencia el identificador/URL de la build y la fecha.

## Instalación y comprobación manual

Instala el APK en un dispositivo Android físico. Registra PASS/FAIL y una evidencia breve para cada caso:

| Caso | Resultado | Evidencia |
|---|---|---|
| Login alumno | Pendiente | |
| Logout y nuevo login | Pendiente | |
| Navegación alumno | Pendiente | |
| Navegación profesor | Pendiente | |
| Navegación administrador | Pendiente | |
| Persistencia de sesión tras cerrar/reabrir la app | Pendiente | |
| Solicitud/denegación/concesión de notificaciones | Pendiente | |
| Recepción de push y navegación al pulsarlo | Pendiente | |
| Selector de documentos | Pendiente | |
| Galería de imágenes/vídeos | Pendiente | |
| Multimedia privada de preguntas | Pendiente | |
| Exportación y hoja de compartir nativa | Pendiente | |
| Partida sin red y sincronización posterior | Pendiente | |
| Enlace `omniquest://update-password` | Pendiente | |

La aplicación usa galería, no captura directa de cámara, por lo que el APK bloquea el permiso `CAMERA` y `RECORD_AUDIO` del plugin de ImagePicker. Esto cumple el caso "cámara o galería" mediante galería y aplica mínimo privilegio.

## Recuperación de contraseña en build nativa

El esquema `omniquest` y `omniquest://update-password` están configurados. En nativo, `usePasswordRecoveryLinkObserver` procesa tanto enlaces con `access_token`/`refresh_token` como enlaces PKCE con `code`, persiste la sesión de recuperación y abre la pantalla de nueva contraseña.

Para validarlo de extremo a extremo debe usarse un enlace real generado por el backend configurado para la build `preview`; no inventes tokens manualmente.

## Maestro público

Con el APK ya instalado y un dispositivo/emulador visible para Maestro:

```powershell
maestro test .maestro/public-login-smoke.yaml
```

Debe validar la entrada pública y los errores de campos obligatorios.

## Maestro autenticado

Se incluyen tres smoke tests adicionales. Las credenciales se inyectan en ejecución y no se guardan en YAML:

```powershell
maestro test -e MAESTRO_STUDENT_EMAIL=<correo> -e MAESTRO_STUDENT_PASSWORD=<password> .maestro/student-authenticated-smoke.yaml
maestro test -e MAESTRO_TEACHER_EMAIL=<correo> -e MAESTRO_TEACHER_PASSWORD=<password> .maestro/teacher-authenticated-smoke.yaml
maestro test -e MAESTRO_ADMIN_EMAIL=<correo> -e MAESTRO_ADMIN_PASSWORD=<password> .maestro/admin-authenticated-smoke.yaml
```

Los flows comprueban login y navegación mínima del rol. No sustituyen la lista manual de permisos, push, selector de archivos, multimedia, compartir, offline y recuperación.

## Criterio para cerrar el punto 8

El punto se considera completo cuando:

1. `npm run test:native-readiness` pasa.
2. `npx expo-doctor@latest` pasa sin incidencias relevantes.
3. `npx expo install --check` indica dependencias compatibles.
4. `eas project:info` confirma el proyecto esperado.
5. El entorno `preview` contiene la configuración pública de Supabase accesible desde el dispositivo.
6. `eas build --platform android --profile preview` finaliza y produce APK.
7. El APK se instala en un dispositivo real.
8. `public-login-smoke.yaml` pasa.
9. Los tres smoke autenticados pasan o sus equivalentes se ejecutan manualmente y quedan documentados.
10. La tabla de comprobación manual queda completada, incluida una prueba real de push y una recuperación de contraseña mediante deep link.

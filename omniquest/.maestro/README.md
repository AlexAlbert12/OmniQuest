# Maestro mobile smoke tests

Los flows se ejecutan contra una build Android/iOS ya instalada con identificador `com.alexalbert.omniquest`.

## Público

```bash
maestro test .maestro/public-login-smoke.yaml
```

Comprueba entrada pública, navegación al login y validación cliente de campos obligatorios.

## Autenticados

Las credenciales nunca se escriben en los YAML. Se pasan con `-e`:

```bash
maestro test -e MAESTRO_STUDENT_EMAIL=<email> -e MAESTRO_STUDENT_PASSWORD=<password> .maestro/student-authenticated-smoke.yaml
maestro test -e MAESTRO_TEACHER_EMAIL=<email> -e MAESTRO_TEACHER_PASSWORD=<password> .maestro/teacher-authenticated-smoke.yaml
maestro test -e MAESTRO_ADMIN_EMAIL=<email> -e MAESTRO_ADMIN_PASSWORD=<password> .maestro/admin-authenticated-smoke.yaml
```

Los tres smoke autenticados validan login y navegación básica de alumno, profesor y administrador. La validación nativa completa de permisos, push, archivos, galería, multimedia, compartir, offline y recuperación se registra en `docs/validation/08-expo-doctor-native-preview.md`.

## Captura visual completa de Android

Los flows de captura recorren las pantallas principales y secundarias de cada rol, guardan una imagen por vista y permiten revisar el resultado sin hacer capturas manuales. La aplicación debe estar instalada y conectada a un backend con datos representativos.

```bash
maestro test --test-output-dir=.artifacts/maestro/student -e MAESTRO_STUDENT_EMAIL=<email> -e MAESTRO_STUDENT_PASSWORD=<password> .maestro/student-ui-capture.yaml
maestro test --test-output-dir=.artifacts/maestro/teacher -e MAESTRO_TEACHER_EMAIL=<email> -e MAESTRO_TEACHER_PASSWORD=<password> .maestro/teacher-ui-capture.yaml
maestro test --test-output-dir=.artifacts/maestro/admin -e MAESTRO_ADMIN_EMAIL=<email> -e MAESTRO_ADMIN_PASSWORD=<password> .maestro/admin-ui-capture.yaml
```

Las capturas usan nombres estables como `ui-student-courses.png`, `ui-teacher-reviews.png` y `ui-admin-support.png`. Los accesos administrativos protegidos solo se capturan cuando el perfil de prueba tiene el permiso correspondiente.

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

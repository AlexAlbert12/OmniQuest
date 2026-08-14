# Revisión de seguridad de dependencias

Fecha de revisión: 14/08/2026

## Objetivo

Este documento registra la revisión final de dependencias realizada para la versión candidata a entrega del TFM OmniQuest.

La revisión se realizó después de instalar las dependencias desde cero mediante `npm ci` y completar satisfactoriamente las comprobaciones de calidad, compatibilidad y construcción del proyecto.

## Estado de compatibilidad

Las dependencias instaladas son compatibles con la versión actual de Expo utilizada por OmniQuest.

Comprobaciones realizadas:

```text
npx expo install --check
Dependencies are up to date

npx expo-doctor@latest
18/18 checks passed. No issues detected!
```

La versión candidata utiliza:

Expo SDK 54.
React Native 0.81.5.
React 19.1.0.

No se han forzado actualizaciones incompatibles del SDK ni de React Native durante la fase de estabilización.

## Resultado de npm audit

La revisión mediante:

npm audit
npm audit --omit=dev

detectó vulnerabilidades transitivas asociadas principalmente a:

image-size;
postcss;
uuid.

Estas dependencias llegan al proyecto a través del ecosistema Expo/Metro y de herramientas de configuración y construcción. No son dependencias utilizadas directamente por la lógica de negocio de OmniQuest.

npm audit fix --force propone cambios incompatibles, incluyendo modificaciones mayores del SDK de Expo o de React Native.

Por este motivo no se ha aplicado una actualización forzada durante la fase final del proyecto.

## Evaluación

Las dependencias afectadas forman parte principalmente del toolchain de construcción y configuración de Expo/Metro.

No se ha identificado en OmniQuest un flujo funcional que exponga directamente estas APIs vulnerables a datos arbitrarios proporcionados por alumnos, profesores o administradores.

La decisión de mantener las versiones actuales se basa en:

compatibilidad oficial del conjunto de dependencias actualmente instalado;
ausencia de problemas detectados por Expo Doctor;
construcción web de producción satisfactoria;
suite automatizada completa satisfactoria;
riesgo de introducir regresiones mediante una actualización mayor del SDK durante la fase de cierre.

Esta decisión no implica considerar las dependencias libres de vulnerabilidades, sino aceptar de forma controlada las vulnerabilidades transitivas conocidas para esta versión candidata.

## Validaciones realizadas

En el momento de esta revisión:

npm ci: correcto;
npm run lint: correcto;
npm run typecheck: correcto;
npm run typecheck:tests: correcto;
tests estructurales: 346/346;
tests unitarios Jest: 17/17;
tests de Edge Functions: 7/7;
validación de migraciones: 109 migraciones y 21 archivos de pruebas SQL;
auditoría de accesibilidad y responsive: correcta;
auditoría del walkthrough autenticado: 0 incidencias;
native release readiness: 31/31;
npx expo install --check: dependencias actualizadas;
npx expo-doctor@latest: 18/18 comprobaciones;
build web de producción: correcto.

## Seguimiento

Las vulnerabilidades transitivas deberán revisarse nuevamente al realizar una futura actualización controlada de Expo SDK.

Cualquier actualización mayor deberá acompañarse de la ejecución completa de las pruebas automatizadas, build web, validación nativa y pruebas de regresión de OmniQuest.
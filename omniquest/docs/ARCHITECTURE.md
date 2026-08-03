# Arquitectura de OmniQuest

## 1. Objetivo y alcance

OmniQuest es una plataforma educativa gamificada construida con Expo, React Native y TypeScript. Supabase proporciona autenticación, PostgreSQL, RLS, RPC, Storage y Edge Functions. La arquitectura separa presentación, casos de uso, acceso a datos y reglas de servidor para que las pantallas no concentren consultas, agregaciones y renderizado.

## 2. Capas del sistema

```text
app/                     Rutas y composición de Expo Router
features/                Casos de uso por capacidad funcional
components/              Presentación reutilizable y accesible
hooks/                    Estado de pantalla y orquestación
lib/                      Clientes, DTO, validadores y servicios transversales
supabase/migrations/      Esquema, índices, RLS, triggers y RPC
supabase/functions/       Acciones privilegiadas y procesadores asíncronos
supabase/tests/           Contratos SQL de permisos y comportamiento
```

El patrón recomendado dentro de una feature es:

```text
features/student-progress/
  api.ts                  RPC y adaptación de respuestas
  types.ts                DTO del dominio
  useStudentProgress.ts   Estado y casos de uso
  components/             Presentación reutilizable
  screen.tsx              Composición de pantalla
```

Las rutas de `app/` deben actuar como adaptadores finos. Las reglas de cálculo, paginación y autorización no pertenecen a la vista.

## 3. Experiencias por rol

- **Alumno:** cursos, clases, partidas, progreso, ranking, logros, historial, notificaciones y soporte.
- **Profesor:** contenido educativo, alumnado, revisiones, analítica, comunicación, reporting y auditoría docente.
- **Administrador:** gobierno de usuarios y contenido, auditoría, soporte, exportaciones y acciones sensibles.
- **Invitado:** experiencia limitada y temporal, sin permisos docentes o administrativos.

La navegación por rol mejora la experiencia, pero no se considera una barrera de seguridad. La autorización real reside en RLS, funciones SQL y Edge Functions.

## 4. Seguridad por capas

1. **Cliente:** rutas tipadas, validación de formularios y ocultación de acciones no disponibles.
2. **RLS:** aislamiento de filas por usuario, matrícula, propiedad docente y rol administrativo.
3. **RPC:** consultas agregadas y operaciones con invariantes transaccionales.
4. **Edge Functions:** acciones que requieren service role, secretos, correo, push, Storage privado o auditoría sensible.
5. **Auditoría:** registros append-only, severidad de servidor, snapshots y exportaciones asíncronas.

Las respuestas correctas no se exponen al alumno antes de registrar su intento. El cliente consume DTO seguros y no consulta directamente el solucionario.

## 5. Flujo de juego seguro

El flujo activo utiliza las siguientes RPC:

1. `get_safe_game_questions`: devuelve únicamente campos jugables, sin `is_correct`, explicación ni mapa de respuestas correctas.
2. `start_game_attempt`: abre el intento y registra su contexto.
3. `submit_answer_resumable`: guarda una respuesta idempotente y la corrige en servidor.
4. `get_attempt_feedback`: libera feedback posterior solo para el propietario, su profesor o un administrador.
5. `finish_game_attempt`: cierra la partida, materializa progreso y sincroniza recompensas.

`get_game_questions` se mantiene únicamente como compatibilidad interna restringida a `service_role`; no forma parte del flujo del alumno. El diagrama detallado está en [diagrams/secure-game-flow.md](diagrams/secure-game-flow.md).

## 6. Agregación y rendimiento

Los dashboards y progresos utilizan RPC agregadas en lugar de descargar historiales completos. Las colecciones crecientes se paginan en servidor y se renderizan con `FlatList`, `SectionList` o componentes virtualizados. Los DTO de `features/*/api.ts` normalizan las respuestas JSON antes de entregarlas a la presentación.

## 7. Backend y catálogo generado

El inventario completo de tablas, RPC y Edge Functions se genera desde el repositorio:

```bash
npm run docs:generate
npm run docs:check
```

El resultado versionado se encuentra en [generated/BACKEND_CATALOG.md](generated/BACKEND_CATALOG.md). Este archivo es la fuente de verdad documental para el listado técnico y evita mantener listas manuales desactualizadas. Incluye `send-push-notification` y todos los procesadores asíncronos actuales.

## 8. Edge Functions

Las funciones se agrupan por responsabilidad:

- `admin-*`: operaciones administrativas privilegiadas.
- `teacher-*`: mutaciones docentes sensibles.
- `process-*`: colas, correo, notificaciones, media y exportaciones.
- autenticación y cuenta: `auth-attempt-guard`, `delete-account`, `manage-account-security` y `process-account-requests`.
- experiencia: importación, avatares, recordatorios, reset de progreso y push.

La capa `supabase/functions/_shared/` centraliza autorización, validación y errores públicos. Los procesadores con `verify_jwt = false` deben validar un secreto interno o contexto de servicio; esa configuración no implica acceso anónimo a la operación privilegiada.

## 9. Datos principales

Los dominios principales son:

- identidad y permisos: perfiles, roles, asignaciones y sesiones;
- aprendizaje: cursos, clases, matrículas, temas, preguntas y respuestas;
- juego: intentos, historial, puntuaciones, progreso y feedback;
- gamificación: XP, niveles, badges, temporadas y rankings;
- comunicación: notificaciones, preferencias, digests y soporte;
- operaciones: auditoría, exportaciones, media privada, analítica y solicitudes de cuenta.

La lista completa y actualizada de tablas está en el catálogo generado.

## 10. Storage y privacidad

Los recursos privados se almacenan en buckets con políticas RLS y URLs firmadas de duración limitada. Los eventos de analítica y auditoría deben excluir secretos, contraseñas, tokens y contenido personal no necesario. IP y user agent solo se capturan cuando existe una justificación documentada, preferiblemente transformados o hasheados.

## 11. Decisiones arquitectónicas

Las decisiones relevantes están versionadas en `docs/adr/`:

- [ADR-0001: flujo de juego corregido en servidor](adr/0001-secure-server-scored-game.md)
- [ADR-0002: pirámide de pruebas](adr/0002-testing-pyramid.md)
- [ADR-0003: acciones sensibles mediante Edge Functions](adr/0003-edge-functions-for-sensitive-actions.md)

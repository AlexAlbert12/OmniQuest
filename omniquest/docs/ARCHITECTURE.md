# Arquitectura de OmniQuest

Este documento resume la arquitectura técnica y funcional de OmniQuest para facilitar su mantenimiento, despliegue y defensa académica. La aplicación combina una app Expo/React Native con Supabase como backend principal: autenticación, base de datos PostgreSQL, RLS, RPC, Storage y Edge Functions.

## 1. Visión general

OmniQuest es una plataforma educativa gamificada con tres experiencias principales:

- **Alumno**: se une a cursos/clases, juega partidas, gana XP, consulta progreso, ranking, logros y notificaciones.
- **Profesor**: crea cursos, clases, temas y preguntas; importa alumnos; revisa respuestas abiertas; consulta analíticas y exporta informes.
- **Administrador**: gestiona usuarios, cursos, clases y acciones sensibles desde un portal separado con auditoría.

La estructura principal del proyecto está dentro de `omniquest/`:

```text
omniquest/
  app/                         Rutas de Expo Router agrupadas por rol
    (auth)/                    Login, registro y recuperación
    (student)/                 Pantallas del alumno
    (teacher)/                 Pantallas del profesor
    (admin)/                   Pantallas del administrador
  components/                  Componentes visuales reutilizables
  hooks/                       Hooks de estado y dominio
  lib/                         Utilidades, clientes, analítica, notificaciones y exportaciones
  supabase/
    migrations/                Esquema, RPC, RLS, triggers y políticas
    functions/                 Supabase Edge Functions
  types/database.types.ts      Contrato TypeScript generado desde Supabase
```

`app/_layout.tsx` centraliza la guardia de navegación: resuelve sesión, perfil, rol y estado activo; redirige a la home correspondiente y bloquea rutas de otros roles desde la experiencia de cliente. La seguridad real se completa en base de datos mediante RLS, RPC y Edge Functions.

## 2. Roles y permisos

### Alumno

El alumno puede:

- editar su perfil visible;
- unirse a clases mediante código;
- jugar partidas y responder preguntas;
- consultar progreso, ranking, logros, historial y notificaciones;
- resetear su propio progreso mediante función controlada.

Las rutas principales están en `app/(student)/`.

### Profesor

El profesor puede:

- crear y editar cursos, clases, temas y preguntas;
- importar alumnos y gestionar inscripciones;
- revisar respuestas abiertas;
- consultar informes, ranking de clase, historial por alumno y preguntas con muchos fallos;
- exportar CSV/Markdown;
- ejecutar acciones sensibles mediante Edge Functions de profesor.

Las rutas principales están en `app/(teacher)/`.

### Administrador

El administrador puede:

- activar/desactivar usuarios;
- crear profesores;
- resetear contraseña;
- archivar cursos;
- desactivar clases;
- borrar progreso de alumnos;
- consultar auditoría administrativa.

Las rutas principales están en `app/(admin)/`. Las acciones sensibles se ejecutan mediante Edge Functions `admin-*` y quedan registradas en `admin_audit_logs`.

## 3. Modelo de datos principal

Las tablas principales están versionadas en `omniquest/supabase/migrations/`.

| Tabla | Responsabilidad |
|---|---|
| `profiles` | Perfil, rol, visibilidad, puntos materializados y estado activo del usuario. |
| `roles` | Catálogo de roles (`student`, `teacher`, `guest`, `admin`). |
| `subjects` | Cursos/asignaturas creados por profesores. |
| `classrooms` | Clases/aulas dentro de un curso, con código de unión. |
| `subject_topics` | Temas de un curso. |
| `questions` | Preguntas de juego o práctica. |
| `answers` | Respuestas asociadas a cada pregunta. |
| `enrollments` | Matriculación de alumnos en cursos/clases. |
| `game_attempts` | Sesiones de partida. |
| `attempt_history` | Fuente de verdad de cada respuesta del alumno. |
| `subject_scores` | Resumen de progreso por curso/clase. |
| `topic_scores` | Resumen de progreso por tema. |
| `student_badges` | Logros concedidos y XP de recompensa. |
| `notifications` | Notificaciones persistentes. |
| `notification_state` | Estado local de lectura/borrado cuando aplica. |
| `user_notification_preferences` | Preferencias de categorías de notificación. |
| `admin_audit_logs` | Auditoría de acciones administrativas. |
| `teacher_audit_logs` | Auditoría de acciones sensibles del profesor. |

## 4. Flujo de autenticación y navegación

El flujo de entrada es:

1. Supabase Auth crea o recupera la sesión.
2. La app consulta `profiles` para conocer `role_id` y `active`.
3. Si el usuario está inactivo o no tiene perfil válido, se fuerza salida local.
4. Si está autenticado, se redirige a:
   - `/(student)/homeStudent` para `student` o `guest`;
   - `/(teacher)/homeTeacher` para `teacher`;
   - `/(admin)/homeAdmin` para `admin`.
5. Si intenta entrar en una ruta de otro rol, se redirige a su home.

Esta guardia mejora la UX, pero no sustituye a RLS ni a validaciones server-side.

## 5. Flujo de juego

El flujo de partida del alumno es:

1. El alumno selecciona un curso, clase o tema.
2. Se llama a RPCs como `start_game_attempt` y `get_game_questions`.
3. La pregunta se muestra en `app/(student)/play/[id].tsx` y componentes de `components/student/game/`.
4. Cada respuesta se envía a la RPC `submit_answer`.
5. El servidor valida:
   - usuario autenticado;
   - matrícula del alumno;
   - pregunta activa;
   - tema jugable;
   - respuesta correcta según tipo de pregunta;
   - XP ganado.
6. Se inserta una fila en `attempt_history`.
7. Se actualizan resúmenes de partida y progreso (`game_attempts`, `subject_scores`, `topic_scores`).
8. Al finalizar, `finish_game_attempt` marca el intento como cerrado, sincroniza logros y recalcula puntos.

La app no calcula la puntuación final como fuente de verdad. La puntuación se valida en PostgreSQL mediante RPC.

## 6. XP, puntos y logros

La regla conceptual es:

```text
attempt_history.earned_points = XP ganado por respuestas
student_badges.reward_xp      = XP ganado por logros
profiles.points               = suma materializada para mostrar rápido
```

`profiles.points` no debe tratarse como fuente primaria. Su valor se recalcula desde:

```text
sum(attempt_history.earned_points) + sum(student_badges.reward_xp)
```

La migración de sincronización introduce funciones/triggers como:

- `recalculate_student_points(student_id)`;
- `sync_student_points(student_id)`;
- triggers sobre `attempt_history` y `student_badges`.

Los logros se sincronizan con `sync_student_badges()`. Tras cerrar una partida, `finish_game_attempt()` llama a la sincronización de badges y a la sincronización de puntos para evitar que ranking, home y perfil queden desactualizados.

## 7. Notificaciones

La arquitectura final prioriza `public.notifications` como fuente principal.

Componentes relevantes:

```text
hooks/useNotifications.ts
lib/notifications/persistent.ts
lib/notifications/preferences.ts
lib/notifications/derivedStudent.ts
lib/notifications/derivedTeacher.ts
lib/notifications/types.ts
```

La fuente recomendada es:

```text
public.notifications = fuente principal
derivedStudent/derivedTeacher = fallback o feature flag de compatibilidad
```

`create_notification` aplica preferencias de `user_notification_preferences` en servidor antes de insertar o reactivar notificaciones. El frontend también filtra por preferencias para no mostrar notificaciones antiguas o derivadas que el usuario haya desactivado.

Categorías principales:

- `activity_enabled`: actividad, inscripciones, logros y clases nuevas.
- `news_enabled`: avisos generales o novedades.

## 8. Auditoría

### Auditoría admin

Las acciones sensibles del administrador se registran en `admin_audit_logs` con:

- `admin_id`;
- `action`;
- `target_table`;
- `target_id`;
- `metadata`;
- `created_at`.

Ejemplos de acciones:

- activar/desactivar usuario;
- crear profesor;
- resetear contraseña;
- borrar progreso de estudiante;
- archivar curso;
- desactivar clase.

### Auditoría docente

Las acciones sensibles del profesor se registran en `teacher_audit_logs` cuando pasan por Edge Functions de profesor, por ejemplo:

- actualizar curso;
- crear/actualizar tema;
- regenerar código de clase;
- quitar alumno;
- resetear progreso;
- actualizar avatar/perfil docente cuando aplica.

La auditoría no debe guardar secretos ni contraseñas en claro como dato persistente. Las credenciales temporales solo se devuelven en respuestas inmediatas cuando es necesario para el flujo docente.

## 9. Edge Functions

Las Edge Functions mueven acciones críticas fuera del cliente y usan validaciones server-side con service role cuando corresponde.

Funciones actuales:

```text
admin-archive-course
admin-create-teacher
admin-deactivate-classroom
admin-delete-student-progress
admin-reset-password
admin-toggle-user
delete-account
import-students
profile-update-avatar
student-reset-own-progress
teacher-archive-subject
teacher-create-topic
teacher-delete-question
teacher-regenerate-class-code
teacher-remove-student-from-class
teacher-reset-own-data
teacher-reset-student-progress
teacher-student-reminder
teacher-update-subject
teacher-update-topic
```

La capa compartida está en:

```text
supabase/functions/_shared/
  admin.ts
  teacher.ts
  errors.ts
```

`errors.ts` evita exponer mensajes internos de Supabase directamente al cliente. Las funciones devuelven mensajes controlados y registran detalles internos en logs.

## 10. RLS y seguridad de datos

La seguridad se reparte en tres capas:

1. **Navegación por rol en cliente** para evitar experiencias incorrectas.
2. **RLS y policies** para restringir lectura/escritura directa desde cliente.
3. **RPC/Edge Functions** para acciones críticas y operaciones que necesitan validación server-side.

Puntos clave:

- `profiles` tiene RLS activado y policies para perfil propio, profesor, admin y visibilidad controlada.
- El ranking público se expone mediante RPCs seguras para evitar hacer `select('*')` de perfiles públicos.
- Los profesores solo pueden acceder a cursos y alumnos relacionados con sus cursos.
- Los alumnos solo pueden jugar preguntas de cursos/clases donde están matriculados.
- Las respuestas correctas no deben exponerse al alumno antes de responder.
- Las acciones admin/profesor sensibles se mueven a Edge Functions o RPCs con validación explícita.

## 11. Storage y avatares

El bucket `avatars` se crea por migración y es público para poder mostrar imágenes en ranking, perfiles y sidebars.

Las policies permiten:

- lectura pública de avatares;
- inserción/actualización/borrado solo del avatar propio;
- rutas compatibles con `<user-id>.jpg` y `<user-id>/avatar.jpg`.

La app sube el archivo al bucket, pero la actualización de `profiles.avatar` se canaliza mediante `profile-update-avatar` para dejar el perfil coherente y auditable cuando aplica.

## 12. Importación de alumnos

El flujo de importación está diseñado para no depender totalmente del email transaccional:

1. El profesor importa alumnos.
2. La Edge Function crea usuarios/perfiles cuando corresponde.
3. Se crean inscripciones en curso/clase.
4. Se devuelven métricas de resultado:
   - creados;
   - existentes;
   - inscritos;
   - errores;
   - emails enviados;
   - emails omitidos.
5. Si Resend no está configurado, la importación continúa y se devuelven credenciales temporales para exportar o copiar.

Esto hace la demo menos frágil y evita que la ausencia de email bloquee el flujo docente.

## 13. Reporting y exportaciones

La capa de exportación está centralizada en:

```text
lib/reportExports.ts
```

Soporta:

- CSV de estudiantes;
- informe por pregunta;
- historial completo por alumno;
- ranking/clase;
- resumen docente semanal en Markdown.

En web, se descarga el archivo. En iOS/Android, se usa `expo-file-system` y `expo-sharing` para generar el archivo y abrir el menú nativo de compartir.

## 14. Responsive móvil

La UI se orienta a una experiencia móvil moderna:

- bottom nav para alumno, profesor y administrador;
- cards en lugar de tablas en pantallas móviles;
- chips horizontales;
- modales tipo hoja/full-screen en teléfono;
- acciones grandes y claras;
- menos texto secundario para evitar sobrecarga cognitiva.

El objetivo visual es que la app no parezca una web comprimida, sino una app móvil de aprendizaje con jerarquía clara y ritmo de gamificación.

## 15. Contrato TypeScript con Supabase

`types/database.types.ts` debe regenerarse tras cambios de esquema:

```bash
npx supabase gen types typescript --local > types/database.types.ts
```

O contra el proyecto remoto:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > types/database.types.ts
```

Este archivo es importante porque documenta el contrato real entre frontend y base de datos. Si las migraciones y los tipos no coinciden, pueden aparecer `as any`, errores de TypeScript o inconsistencias difíciles de defender.

## 16. Despliegue y configuración

La configuración local de Supabase está en:

```text
omniquest/supabase/config.toml
```

Flujo recomendado:

```bash
cd omniquest
supabase link --project-ref TU_PROJECT_REF
supabase db push
supabase functions deploy admin-archive-course admin-create-teacher admin-deactivate-classroom admin-delete-student-progress admin-reset-password admin-toggle-user delete-account import-students profile-update-avatar student-reset-own-progress teacher-archive-subject teacher-create-topic teacher-delete-question teacher-regenerate-class-code teacher-remove-student-from-class teacher-reset-own-data teacher-reset-student-progress teacher-student-reminder teacher-update-subject teacher-update-topic
npx supabase gen types typescript --project-id TU_PROJECT_REF > types/database.types.ts
```

Secrets necesarios para funciones:

```text
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
MAIL_FROM
```

`RESEND_API_KEY` y `MAIL_FROM` son necesarios para envío real de email, pero la importación de alumnos debe seguir funcionando aunque no estén configurados.

## 17. Decisiones de arquitectura defendibles

- **Servidor como fuente de verdad del juego**: el cliente no decide XP final ni corrección crítica.
- **`profiles.points` materializado, no primario**: mejora rendimiento sin duplicar la fuente lógica.
- **Auditoría separada admin/docente**: facilita trazabilidad y defensa del proyecto.
- **Notificaciones persistentes como fuente principal**: evita depender de consultas derivadas del cliente.
- **Edge Functions para acciones sensibles**: mejora control de permisos y mensajes de error.
- **RLS activado en tablas críticas**: la seguridad no depende de ocultar botones en UI.
- **Exportaciones multiplataforma**: web descarga; móvil comparte archivo nativo.

## 18. Áreas futuras

- Añadir tests SQL/RLS automatizados por rol.
- Paginación completa en AdminPortal para grandes volúmenes de datos.
- Reducir más pantallas monolíticas (`settings`, `AdminPortal`, `TeacherQuestionForm`).
- Sustituir definitivamente notificaciones derivadas por eventos persistentes generados en servidor.
- Añadir observabilidad más formal a Edge Functions.
- Completar estrategia de push/email si la app pasa a producción real.

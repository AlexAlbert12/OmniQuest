# OmniQuest

OmniQuest es una aplicación educativa gamificada desarrollada con Expo, React Native y Supabase. El objetivo del proyecto es ofrecer un entorno donde el profesorado pueda crear cursos, clases, temas y preguntas, y donde el alumnado pueda practicar mediante partidas con puntuación, progreso, logros, ranking e historial de actividad.

Este repositorio corresponde a un Trabajo Fin de Máster y busca ser reproducible: incluye el código de la app, migraciones SQL, políticas RLS, funciones RPC, Storage, documentación técnica y **32 Supabase Edge Functions** para operaciones sensibles y procesos asíncronos.

## Objetivo educativo

OmniQuest combina evaluación formativa y gamificación. La app permite convertir preguntas de clase en partidas cortas, dar feedback al alumno y ofrecer al profesor analíticas sobre participación, precisión, preguntas con más fallos y progreso de la clase.

La puntuación se usa como elemento motivador, pero la analítica docente prioriza métricas educativas como precisión, intentos, fallos, evolución y actividad real.

## Roles

- **Alumno**: se une a clases mediante código, juega partidas, consulta progreso, ranking, historial, notificaciones y logros conseguidos.
- **Profesor**: crea y gestiona cursos, clases, temas, preguntas, alumnos inscritos, importaciones, informes y auditoría docente.
- **Administrador**: gestiona usuarios, cursos, clases, acciones sensibles y auditoría administrativa desde un portal protegido.
- **Invitado**: rol limitado pensado para acceso controlado o pruebas, con permisos reducidos respecto al alumno registrado.

## Funcionalidades principales

- Registro e inicio de sesión con Supabase Auth.
- Creación automática de perfil mediante trigger `auth.users -> profiles`.
- Cursos y clases con códigos de invitación únicos.
- Gestión de temas y preguntas por parte del profesor.
- Preguntas con respuestas, explicaciones, tiempo límite y puntuación.
- Partidas para alumnos con corrección y puntuación validadas en servidor.
- Historial de intentos en `attempt_history`.
- XP coherente: `profiles.points` se materializa desde `attempt_history.earned_points` y `student_badges.reward_xp`.
- Ranking global, semanal y por clase mediante RPCs seguras.
- Progreso por curso, temas débiles, historial de actividad y logros.
- Notificaciones persistentes en `public.notifications`, con preferencias por usuario.
- Push nativo con registro de dispositivos, cola de entrega, reintentos y recibos.
- Caché offline por usuario y reintento duradero de mutaciones y respuestas de juego.
- Soporte con tickets, conversación, adjuntos, estados, SLA y entrega opcional por email.
- Revisión manual de respuestas abiertas con cola, rúbricas, asignación y trazabilidad.
- Contenido multimedia privado para preguntas, con URLs firmadas y procesamiento en servidor.
- Auditoría administrativa en `admin_audit_logs`.
- Auditoría docente en `teacher_audit_logs`.
- Importación de alumnos con credenciales temporales y flujo post-importación.
- Reporting/exportación docente en CSV y Markdown, compatible con web y móvil.
- Bucket público `avatars` para imágenes de perfil, con policies de Storage.
- Preferencias de usuario: idioma, zona horaria, color de acento, privacidad y notificaciones.
- Borrado de cuenta y acciones destructivas mediante Edge Functions.
- Diseño responsive con navegación móvil específica para alumno, profesor y administrador.

## Documentación técnica

- [Arquitectura del proyecto](omniquest/docs/ARCHITECTURE.md)
- [Despliegue y Edge Functions](omniquest/docs/DEPLOYMENT.md)

## Arquitectura

La aplicación está dentro de la carpeta `omniquest/`.

```text
omniquest/
  app/                         Pantallas y rutas de Expo Router
    (auth)/                    Login, registro y recuperación
    (student)/                 Experiencia del alumno
    (teacher)/                 Experiencia del profesor
    (admin)/                   Portal de administración
  components/                  Componentes compartidos y por rol
  hooks/                       Hooks de juego, notificaciones y estado
  lib/                         Supabase, dominio, reporting y utilidades
  docs/                        Arquitectura y despliegue
  scripts/                     Scripts de despliegue de funciones
  supabase/
    config.toml                Configuración local de Supabase
    migrations/                Esquema SQL versionado, RPC, RLS y Storage
    functions/                 Edge Functions de acciones sensibles
  types/database.types.ts      Tipos generados del esquema Supabase
```

La app usa Expo Router con grupos de rutas por rol. `app/_layout.tsx` aplica una guardia global: usuarios no autenticados van a login, alumnos no pueden navegar a rutas de profesor/admin y profesores no pueden entrar en pantallas de alumno/admin.

## Tecnologías

- Expo SDK 54
- React 19
- React Native 0.81
- Expo Router 6
- TypeScript
- Supabase Auth, Database, RLS, RPC, Storage y Edge Functions
- NativeWind / Tailwind
- Expo File System y Expo Sharing para exportación de datos en móvil
- Resend como proveedor opcional para emails transaccionales

## Modelo de datos

El esquema principal está versionado en `omniquest/supabase/migrations/`.

Tablas principales:

- `profiles`: perfil, rol, puntos, privacidad, avatar y estado del usuario.
- `roles`: roles disponibles (`student`, `teacher`, `admin`, `guest`).
- `subjects`: cursos/asignaturas creadas por profesores.
- `classrooms`: clases/aulas dentro de un curso.
- `subject_topics`: temas dentro de un curso o clase.
- `questions`: preguntas asociadas a curso, clase y tema.
- `answers`: respuestas posibles de cada pregunta.
- `enrollments`: matrículas de alumnos o invitados.
- `attempt_history`: intentos reales de respuesta y XP ganado por respuesta.
- `game_attempts`: sesiones de partida.
- `subject_scores`: resumen de progreso por curso/clase.
- `topic_scores`: resumen de progreso por tema.
- `student_badges`: logros obtenidos y XP de recompensa.
- `notifications`: notificaciones persistentes.
- `notification_state`: estado leído/borrado por usuario.
- `user_notification_preferences`: preferencias de notificaciones.
- `user_preferences`: preferencias generales de usuario.
- `user_support_tickets`: solicitudes de soporte.
- `admin_audit_logs`: auditoría de acciones administrativas.
- `teacher_audit_logs`: auditoría de acciones docentes sensibles.

Storage:

- `avatars`: bucket público para avatares, con escritura limitada al propio usuario.

## RPCs relevantes

Funciones de curso, juego y progreso:

- `generate_unique_subject_code`
- `generate_unique_classroom_code`
- `create_subject_with_default_topic`
- `ensure_default_classroom`
- `save_teacher_question`
- `duplicate_teacher_subject`
- `join_subject_by_code`
- `get_safe_game_questions`
- `start_game_attempt`
- `submit_answer_resumable`
- `get_attempt_feedback`
- `finish_game_attempt`
- `review_open_answer_attempt`
- `sync_student_badges`
- `sync_student_points`

Funciones de ranking y perfiles públicos:

- `get_ranking_profiles`
- `get_class_ranking_profiles`
- `get_weekly_ranking_profiles`
- `get_class_weekly_ranking_profiles`

Funciones de notificaciones:

- `create_notification`
- `mark_notification_read`
- `mark_all_notifications_read`
- `delete_notification_for_user`

Funciones administrativas y reporting:

- `get_admin_dashboard_metrics`
- `get_admin_profiles_page`
- `get_admin_subjects_page`
- `get_admin_classrooms_page`
- `get_admin_enrollments_summary`
- `delete_user_relational_data`

## Edge Functions

El proyecto incluye **32 Edge Functions** para operaciones sensibles y procesos asíncronos. Cubren gobierno administrativo, acciones docentes, seguridad de cuenta, importaciones, avatares, push, correo, soporte, exportaciones, solicitudes de privacidad y procesamiento de contenido multimedia.

El inventario se genera automáticamente desde el repositorio y se mantiene en [el catálogo de backend](omniquest/docs/generated/BACKEND_CATALOG.md). Las funciones autenticadas validan identidad, rol y propiedad en servidor. Los procesadores sin verificación JWT del gateway requieren un secreto interno o la service role y no quedan expuestos como operaciones anónimas privilegiadas.

## Auditoría

OmniQuest registra acciones sensibles en tablas separadas:

- `admin_audit_logs`: acciones de administrador como activar/desactivar usuarios, resetear contraseñas, archivar cursos, desactivar clases o eliminar progreso.
- `teacher_audit_logs`: acciones docentes como borrar preguntas, resetear progreso, quitar alumnos, regenerar códigos, editar cursos/temas, actualizar avatar o borrar datos docentes.

Esto permite defender trazabilidad, responsabilidad y control de acciones críticas.

## Notificaciones

La fuente principal de notificaciones es `public.notifications`. El frontend consume notificaciones persistentes y solo mantiene notificaciones derivadas como fallback o modo compatibilidad.

Las preferencias de usuario se guardan en `user_notification_preferences` y se aplican tanto en servidor como en la experiencia final de la app.

## Reporting y exportación

El proyecto incluye exportaciones orientadas a profesor:

- CSV de estudiantes.
- CSV de informe por pregunta.
- CSV de historial de alumno.
- CSV de ranking/clase.
- Resumen docente semanal en Markdown.

En web se descargan como archivo. En móvil se usan `expo-file-system` y `expo-sharing` para abrir el menú nativo de compartir.

## Variables de entorno

Crea un archivo `.env` en `omniquest/` con:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
EXPO_PUBLIC_APP_NAME=OmniQuest
```

También se admite `EXPO_PUBLIC_SUPABASE_KEY` como alternativa para la clave anónima.

Secrets necesarios para Edge Functions:

```bash
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
RESEND_API_KEY=tu_resend_api_key
MAIL_FROM="OmniQuest <no-reply@tu-dominio.com>"
```

`RESEND_API_KEY` y `MAIL_FROM` son recomendables para enviar credenciales y recordatorios. Si no están configurados, la importación de alumnos puede continuar y marcar los emails como no enviados.

No subas claves reales al repositorio.

## Instalación

Requisitos:

- Node.js LTS
- npm
- Expo CLI mediante `npx expo`
- Proyecto Supabase
- Supabase CLI
- Docker si se usa Supabase local

Pasos:

```bash
cd omniquest
npm ci
npm run quality:install
```

Configura las variables de entorno y después arranca la app:

```bash
npm run web
```

O usa el servidor de Expo:

```bash
npm start
```

## Configuración de Supabase

1. Crea un proyecto en Supabase.
2. Copia la URL y la anon key en `.env`.
3. Vincula el proyecto con Supabase CLI.
4. Aplica las migraciones.
5. Configura los secrets necesarios para Edge Functions.
6. Despliega todas las Edge Functions versionadas.
7. Regenera `types/database.types.ts` si modificas el esquema.

Ejemplo con Supabase CLI:

```bash
cd omniquest
supabase link --project-ref TU_PROJECT_REF
supabase db push
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
supabase secrets set RESEND_API_KEY="TU_RESEND_API_KEY"
supabase secrets set MAIL_FROM="OmniQuest <no-reply@tu-dominio.com>"
./scripts/deploy-functions.sh
```

En Windows PowerShell puedes usar:

```powershell
cd omniquest
.\scripts\deploy-functions.ps1
```

Documentación completa de despliegue:

```text
omniquest/docs/DEPLOYMENT.md
```

Para regenerar tipos con proyecto remoto:

```bash
supabase gen types typescript --project-id TU_PROJECT_REF --schema public > types/database.types.ts
```

Para regenerar tipos en local:

```bash
supabase start
supabase db reset
npx supabase gen types typescript --local > types/database.types.ts
```

## Políticas RLS

La seguridad no depende solo del frontend. Las migraciones incluyen políticas RLS y funciones auxiliares para:

- Permitir al profesor acceder solo a sus propios cursos, clases y alumnos.
- Permitir al alumno leer clases solo si está matriculado.
- Proteger `profiles` con RLS y policies por rol.
- Evitar que el alumno lea respuestas correctas antes de responder.
- Restringir preguntas inactivas en la experiencia del alumno.
- Validar uniones a clase mediante `join_subject_by_code`.
- Ejecutar corrección, puntuación y cierre de partida mediante RPC del servidor.
- Exponer ranking público mediante RPCs que no devuelven emails ni datos sensibles.

La guardia de navegación mejora la experiencia de usuario, pero RLS, RPCs y Edge Functions son la defensa real de datos.

## Scripts de ejecución

Desde `omniquest/`:

```bash
npm start          # Inicia Expo
npm run web        # Abre la app en web
npm run android    # Abre en Android
npm run ios        # Abre en iOS
npm run lint       # Ejecuta lint
```

Comprobación de TypeScript:

```bash
npx tsc --noEmit
```

Despliegue de Edge Functions:

```bash
./scripts/deploy-functions.sh
```

O en Windows:

```powershell
.\scripts\deploy-functions.ps1
```

## Limitaciones conocidas

- La app tiene notificaciones persistentes internas, pero todavía no implementa push nativo completo.
- El proveedor de email transaccional es opcional y depende de configurar Resend.
- Algunas pantallas siguen siendo grandes y están en proceso de refactorización hacia hooks y componentes más pequeños.
- La eliminación de cuenta combina base de datos, Auth y Storage; la parte relacional se centraliza en SQL, pero Auth/Storage son servicios externos.
- El proyecto requiere aplicar las migraciones antes de ejecutarse contra una base de datos nueva.
- Si se cambia el esquema Supabase, hay que regenerar los tipos para mantener TypeScript alineado.
- La cobertura automatizada de tests aún es limitada.

## Futuras mejoras

- Integrar push nativo real.
- Ampliar tests unitarios para analíticas, reglas de puntuación y transformaciones.
- Añadir pruebas SQL/RLS para validar permisos por rol.
- Completar la extracción de pantallas grandes en hooks y componentes reutilizables.
- Añadir paginación avanzada en más secciones administrativas.
- Añadir actividades programadas con fechas reales de inicio y fin.
- Mejorar accesibilidad, estados vacíos y experiencia offline.

## Estado del proyecto

OmniQuest es un prototipo funcional orientado a TFM. La base del producto está implementada, con especial atención a reproducibilidad, separación por roles, seguridad en Supabase, auditoría, Edge Functions, experiencia móvil y analíticas educativas basadas en datos reales.

# OmniQuest

OmniQuest es una aplicación educativa gamificada desarrollada con Expo, React Native y Supabase. El objetivo del proyecto es ofrecer un entorno donde el profesorado pueda crear clases, temas y preguntas, y donde el alumnado pueda practicar mediante partidas con puntuación, progreso, logros e historial de actividad.

Este repositorio corresponde a un Trabajo Fin de Máster y busca ser reproducible: incluye el código de la app, migraciones SQL, políticas RLS, funciones RPC y una Edge Function para operaciones sensibles.

## Objetivo educativo

OmniQuest combina evaluación formativa y gamificación. La app permite convertir preguntas de clase en partidas cortas, dar feedback al alumno y ofrecer al profesor analíticas sobre participación, precisión, preguntas con más fallos y progreso de la clase.

La puntuación se usa como elemento motivador, pero la analítica docente prioriza métricas educativas como precisión, intentos, fallos y actividad real.

## Roles

- **Profesor**: crea y gestiona clases, temas, preguntas, alumnos inscritos y analíticas.
- **Alumno**: se une a clases mediante código, juega partidas, consulta progreso, historial y logros conseguidos.
- **Invitado**: rol limitado pensado para acceso controlado o pruebas, con permisos reducidos respecto al alumno registrado.

## Funcionalidades principales

- Registro e inicio de sesión con Supabase Auth.
- Creación de perfil automática mediante trigger `auth.users -> profiles`.
- Clases con código de invitación único.
- Gestión de temas y preguntas por parte del profesor.
- Preguntas con respuestas, explicaciones, tiempo límite y puntuación.
- Partidas para alumnos con corrección y puntuación validadas en servidor.
- Historial de intentos en `attempt_history`.
- Analíticas docentes basadas en datos reales de intentos.
- Ranking, progreso por asignatura, logros y actividad reciente.
- Preferencias de usuario: idioma, zona horaria, color de acento, privacidad y notificaciones.
- Exportación de datos del usuario.
- Borrado de cuenta mediante Edge Function.

## Arquitectura

La aplicación está dentro de la carpeta `omniquest/`.

```text
omniquest/
  app/                     Pantallas y rutas de Expo Router
    (auth)/                Login y registro
    (student)/             Experiencia del alumno
    (teacher)/             Experiencia del profesor
  components/              Componentes compartidos y formularios
  hooks/                   Hooks de juego, notificaciones y estado
  lib/                     Utilidades, Supabase, analítica y dominio
  supabase/
    migrations/            Esquema SQL versionado, RPC y RLS
    functions/delete-account/
  types/database.types.ts  Tipos generados del esquema Supabase
```

La app usa Expo Router con grupos de rutas por rol. `app/_layout.tsx` aplica una guardia global: usuarios no autenticados van a login, alumnos no pueden navegar a rutas de profesor y profesores no pueden entrar en pantallas de alumno.

## Tecnologías

- Expo SDK 54
- React 19
- React Native 0.81
- Expo Router 6
- TypeScript
- Supabase Auth, Database, RLS, RPC y Edge Functions
- NativeWind / Tailwind
- Expo File System y Expo Sharing para exportación de datos en móvil

## Modelo de datos

El esquema principal está versionado en `omniquest/supabase/migrations/`.

Tablas principales:

- `profiles`: perfil, rol, puntos, preferencias visibles y datos de usuario.
- `roles`: roles disponibles (`student`, `teacher`, `guest`).
- `subjects`: clases/asignaturas creadas por profesores.
- `subject_topics`: temas dentro de una clase.
- `questions`: preguntas asociadas a clase y tema.
- `answers`: respuestas posibles de cada pregunta.
- `enrollments`: matrículas de alumnos o invitados en clases.
- `attempt_history`: intentos reales de respuesta.
- `subject_scores`: progreso agregado por clase.
- `topic_scores`: progreso agregado por tema.
- `student_badges`: logros obtenidos por alumnos.
- `game_attempts`: sesiones de partida.
- `notification_state`: estado de notificaciones.
- `user_support_tickets`: tickets o solicitudes de soporte.
- `classrooms`: datos auxiliares de aula.

Funciones RPC relevantes:

- `generate_unique_subject_code`
- `create_subject_with_default_topic`
- `save_teacher_question`
- `duplicate_teacher_subject`
- `join_subject_by_code`
- `get_game_questions`
- `start_game_attempt`
- `submit_answer`
- `sync_student_badges`
- `delete_user_relational_data`

## Variables de entorno

Crea un archivo `.env` en `omniquest/` con:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
```

Tambien se admite `EXPO_PUBLIC_SUPABASE_KEY` como alternativa para la clave anonima.

La Edge Function `delete-account` necesita secretos de Supabase:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_anonima
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

No subas claves reales al repositorio.

## Instalación

Requisitos:

- Node.js LTS
- npm
- Expo CLI mediante `npx expo`
- Proyecto Supabase
- Supabase CLI si se van a aplicar migraciones desde terminal

Pasos:

```bash
cd omniquest
npm install
```

Configura las variables de entorno y despues arranca la app:

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
3. Aplica las migraciones de `omniquest/supabase/migrations/`.
4. Despliega la Edge Function `delete-account`.
5. Configura los secretos de la Edge Function.
6. Regenera `types/database.types.ts` si modificas el esquema.

Ejemplo con Supabase CLI:

```bash
cd omniquest
supabase link --project-ref TU_PROJECT_REF
supabase db push
supabase functions deploy delete-account
```

Para regenerar tipos:

```bash
supabase gen types typescript --project-id TU_PROJECT_REF --schema public > types/database.types.ts
```

## Políticas RLS

La seguridad no depende solo del frontend. Las migraciones incluyen políticas RLS y funciones auxiliares para:

- Permitir al profesor acceder solo a sus propias clases.
- Permitir al alumno leer clases solo si está matriculado.
- Evitar que el alumno lea respuestas correctas antes de responder.
- Restringir preguntas inactivas en la experiencia del alumno.
- Validar uniones a clase mediante `join_subject_by_code`.
- Ejecutar corrección y puntuación mediante RPC del servidor.

La guardia de navegación mejora la experiencia de usuario, pero RLS es la defensa real de datos.

## Scripts de ejecución

Desde `omniquest/`:

```bash
npm start          # Inicia Expo
npm run web        # Abre la app en web
npm run android    # Abre en Android
npm run ios        # Abre en iOS
npm run lint       # Ejecuta lint
```

Comprobacion de TypeScript:

```bash
npx tsc --noEmit
```

## Limitaciones conocidas

- Las preferencias de notificaciones se guardan, pero todavía no hay proveedor real de push/email integrado.
- Algunas pantallas siguen siendo grandes y están en proceso de refactorización hacia hooks y componentes más pequeños.
- La eliminación de cuenta combina base de datos, Auth y Storage; la parte relacional se centraliza en SQL, pero Auth/Storage son servicios externos.
- El proyecto requiere aplicar las migraciones antes de ejecutarse contra una base de datos nueva.
- Si se cambia el esquema Supabase, hay que regenerar los tipos para mantener TypeScript alineado.
- La cobertura automatizada de tests aún es limitada.

## Futuras mejoras

- Integrar envío real de notificaciones push y email.
- Ampliar tests unitarios para analíticas, reglas de puntuación y transformaciones.
- Añadir pruebas SQL/RLS para validar permisos por rol.
- Completar la extracción de pantallas grandes en hooks y componentes reutilizables.
- Mejorar informes docentes exportables.
- Añadir actividades programadas con fechas reales de inicio y fin.
- Mejorar accesibilidad, estados vacios y experiencia offline.

## Estado del proyecto

OmniQuest es un prototipo funcional orientado a TFM. La base del producto está implementada, con especial atención a reproducibilidad, separación por roles, seguridad en Supabase y analíticas educativas basadas en datos reales.

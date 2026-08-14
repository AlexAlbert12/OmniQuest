# Preparación de los recorridos autenticados

> Snapshot histórico del hito de preparación inicial. Las cifras de este documento corresponden a ese momento; para el inventario backend actual consulta `BACKEND_CATALOG.md`.

## Resumen ejecutivo

- Estado del código y de los contratos estáticos: **PASS**.
- Estado de la ejecución real contra Supabase local: **BLOCKED EN ESTE ENTORNO** porque no están disponibles Docker, Supabase CLI ni PostgreSQL.
- Puntos funcionales trazados: **84**.
- Inventario cliente: **227 llamadas**, **18 tablas**, **117 RPC**, **19 Edge Functions** y los buckets privados utilizados por la aplicación.
- Migraciones acumuladas: **80**.
- Suites SQL: **11** con **277 aserciones previstas**.
- Pruebas de código fuente: se deben consultar en el informe final de ejecución; no se considera validado ningún recorrido visual hasta ejecutarlo localmente.

La ausencia de ejecución local no implica que el recorrido esté completado. La matriz indica que el código, los permisos esperados y las pruebas de regresión están conectados; la columna de validación manual debe completarse en el equipo que ejecuta Supabase local y Expo.

## Correcciones de preparación aplicadas

| Área | Corrección |
|---|---|
| Autorización SQL | Matriz final de privilegios mínimos para todas las tablas usadas directamente por los recorridos. |
| Perfiles | La actualización directa queda limitada a `alias` y `visibility`; `role_id`, `active` y otros campos sensibles permanecen protegidos. |
| Clases | El cliente solo conserva `SELECT`; la creación y las mutaciones siguen pasando por RPC o Edge Functions. |
| Notificaciones | Se elimina el fallback que escribía directamente en `notifications`; las operaciones usan exclusivamente RPC protegidas. |
| Medios privados | Se mantiene `question_media_assets` fuera del acceso directo del cliente y se conserva la autorización mediante helper protegido. |
| Auditoría administrativa | Las activaciones y desactivaciones masivas generan también eventos individuales `admin.user.activate` y `admin.user.deactivate`. |
| CSV | Se neutralizan `=`, `+`, `-`, `@`, tabulador y retorno de carro, incluso con espacios iniciales. |
| Verificación posterior | Comprueba multimedia, idempotencia, ticket exacto, nota interna, CSV descargado y ausencia de mutación tras el 403 del auditor. |
| Operación local | Se añaden scripts para preparar secretos locales y procesar exportaciones administrativas y docentes. |

## Matriz de trazabilidad

### Profesor

| ID | Acción | Implementación principal | Recursos protegidos | Cobertura | Validación local |
|---|---|---|---|---|---|
| P-01 | Iniciar sesión | Auth de Supabase y registro de sesión | `profiles`, `register_user_session`, `auth-attempt-guard` | Diagnóstico y pruebas de autenticación | Pendiente |
| P-02 | Crear curso | Operación servidor | `create_subject_with_default_topic`, `subjects` | pgTAP y pruebas de fuente | Pendiente |
| P-03 | Comprobar clase principal | Lectura RLS | `classrooms` | Matriz de privilegios y RLS | Pendiente |
| P-04 | Comprobar tema inicial | Lectura RLS | `subject_topics` | Matriz de privilegios y RLS | Pendiente |
| P-05 | Crear opción múltiple | RPC protegida | `save_teacher_question`, `questions`, `answers` | Pruebas de tipos | Pendiente |
| P-06 | Crear verdadero/falso | RPC protegida | `save_teacher_question` | Pruebas de tipos | Pendiente |
| P-07 | Crear respuesta abierta | RPC protegida | `save_teacher_question`, revisión manual | Pruebas de tipos | Pendiente |
| P-08 | Crear rellenar huecos | RPC protegida | `save_teacher_question` | Pruebas de tipos | Pendiente |
| P-09 | Crear ordenar | RPC protegida | `save_teacher_question` | Pruebas de tipos | Pendiente |
| P-10 | Crear unir parejas | RPC protegida | `save_teacher_question` | Pruebas de tipos | Pendiente |
| P-11 | Crear asignar destinos | RPC protegida | `save_teacher_question` | Pruebas de tipos | Pendiente |
| P-12 | Adjuntar imagen pequeña | Storage privado y Edge Function | `question-media`, `process-question-media` | pgTAP y prueba de fuente | Pendiente |
| P-13 | Guardar texto alternativo | RPC protegida | `questions.media_alt_text` | Verificación posterior | Pendiente |
| P-14 | Reabrir imagen privada | Manifest y URL firmada | `get_question_media_manifest`, Storage | Pruebas de medios | Pendiente |
| P-15 | Importar alumno demo | Edge Function | `import-students`, Auth Admin, matrículas | Prueba de autorización Edge | Pendiente |
| P-16 | Lista paginada de alumnos | RPC paginada | `get_teacher_students_page` | Auditoría de RPC | Pendiente |
| P-17 | Recordatorio redirect | Edge Function | `teacher-student-reminder`, cola y preferencias | Prueba de autorización Edge | Pendiente |
| P-18 | Copiar código de clase | Lectura RLS | `classrooms.code` | Matriz de acceso | Pendiente |
| P-19 | Progreso y alumnos en riesgo | RPC agregadas | `get_teacher_subject_analytics`, `get_teacher_attention_students_page` | Auditoría de RPC | Pendiente |
| P-20 | Revisar respuesta abierta | RPC de revisión | Cola, historial y comentarios de revisión | Pruebas de revisión | Pendiente |
| P-21 | Informe de pregunta | RPC de informe | `get_teacher_question_report` | Prueba de informe | Pendiente |
| P-22 | Exportar datos docentes | Exportación local o trabajo privado | `request_teacher_audit_export`, worker y bucket | Worker y CSV | Pendiente |
| P-23 | Archivar pregunta con intentos | Edge Function y RPC | `teacher-delete-question`, `archive_teacher_question` | Prueba de preservación histórica | Pendiente |
| P-24 | Consultar auditoría docente | RPC paginada | `get_teacher_audit_logs_page_v2` | Verificación posterior | Pendiente |

### Alumno

| ID | Acción | Implementación principal | Recursos protegidos | Cobertura | Validación local |
|---|---|---|---|---|---|
| A-01 | Iniciar sesión | Auth y sesión | `profiles`, `register_user_session` | Diagnóstico Auth | Pendiente |
| A-02 | Rechazar `NOEXISTE` | RPC de matrícula | `join_subject_by_code` | Fixture demo | Pendiente |
| A-03 | Rechazar `EXPCL001` | Caducidad en servidor | `join_subject_by_code` | pgTAP | Pendiente |
| A-04 | Rechazar `ARCHCL01` | Estado del curso en servidor | `join_subject_by_code` | Fixture demo | Pendiente |
| A-05 | Matricularse con código válido | RPC protegida | `join_subject_by_code`, `enrollments` | pgTAP | Pendiente |
| A-06 | Ver solo el curso autorizado | RLS | `subjects`, `classrooms`, `enrollments` | pgTAP | Pendiente |
| A-07 | Rechazar doble matrícula | Restricción y RPC | `enrollments` | Verificación posterior | Pendiente |
| A-08 | Empezar partida | RPC protegida | `start_game_attempt` | pgTAP | Pendiente |
| A-09 | Obtener preguntas sin soluciones | Contrato seguro | `get_safe_game_questions` | pgTAP | Pendiente |
| A-10 | Responder opción múltiple | RPC reanudable | `submit_answer_resumable` | Pruebas de juego | Pendiente |
| A-11 | Responder verdadero/falso | RPC reanudable | `submit_answer_resumable` | Pruebas de juego | Pendiente |
| A-12 | Responder respuesta abierta | RPC reanudable | intento y revisión manual | Pruebas de juego | Pendiente |
| A-13 | Responder huecos | RPC reanudable | payload validado en servidor | Pruebas de tipos | Pendiente |
| A-14 | Responder ordenar | RPC reanudable | payload validado en servidor | Pruebas de tipos | Pendiente |
| A-15 | Responder parejas | RPC reanudable | payload validado en servidor | Pruebas de tipos | Pendiente |
| A-16 | Responder destinos | RPC reanudable | payload validado en servidor | Pruebas de tipos | Pendiente |
| A-17 | Guardar y salir | Persistencia de partida | `game_attempts`, `attempt_history` | Pruebas de reanudación | Pendiente |
| A-18 | Reanudar | RPC y estado persistido | partida activa y preguntas restantes | Pruebas de reanudación | Pendiente |
| A-19 | No repetir pregunta | Contrato seguro | historial del intento | Verificación posterior | Pendiente |
| A-20 | No duplicar XP | Cálculo servidor e idempotencia | recibos y puntuaciones | Verificación posterior | Pendiente |
| A-21 | Activar modo offline | Outbox cliente | cola local | Pruebas offline de fuente | Pendiente |
| A-22 | Encolar respuesta | Outbox idempotente | `submission_id` | Pruebas offline | Pendiente |
| A-23 | Restaurar red y sincronizar | Reintento reanudable | `game_answer_submission_receipts` | Verificación posterior | Pendiente |
| A-24 | Finalizar partida | RPC protegida | `finish_game_attempt` | pgTAP | Pendiente |
| A-25 | Consultar XP | Lecturas RLS/agregadas | perfil y puntuaciones | Matriz de acceso | Pendiente |
| A-26 | Consultar progreso | RPC agregada | `get_student_progress_summary` | Pruebas de fuente | Pendiente |
| A-27 | Consultar ranking | RPC paginada | ranking y privacidad | Pruebas de ranking | Pendiente |
| A-28 | Consultar historial | RPC paginada | intentos propios | Pruebas de historial | Pendiente |
| A-29 | Sincronizar logros | RPC protegida | `sync_student_badges` | pgTAP | Pendiente |
| A-30 | Crear ticket exacto | Inserción RLS | `user_support_tickets` | Verificación posterior | Pendiente |
| A-31 | Cerrar y volver a iniciar sesión | Auth persistente | Auth y datos servidor | Verificación manual | Pendiente |

### Administrador global

| ID | Acción | Implementación principal | Recursos protegidos | Cobertura | Validación local |
|---|---|---|---|---|---|
| G-01 | Iniciar sesión | Auth y contexto admin | `get_admin_portal_context` | Pruebas admin | Pendiente |
| G-02 | Dashboard | RPC agregada | `get_admin_dashboard_metrics` | Auditoría de RPC | Pendiente |
| G-03 | Usuarios | RPC paginada | `get_admin_profiles_page` | Auditoría de RPC | Pendiente |
| G-04 | Cursos | RPC paginada | `get_admin_subjects_page` | Auditoría de RPC | Pendiente |
| G-05 | Clases | RPC paginada | `get_admin_classrooms_page` | Auditoría de RPC | Pendiente |
| G-06 | Buscar cuentas demo | Filtros servidor | directorio admin | Pruebas admin | Pendiente |
| G-07 | Desactivar importado | Edge Function | `admin-bulk-operations` | Auditoría individual añadida | Pendiente |
| G-08 | Reactivar importado | Edge Function | `admin-bulk-operations` | Auditoría individual añadida | Pendiente |
| G-09 | Confirmar `super_admin` | RPC de roles | asignaciones protegidas | Verificación previa | Pendiente |
| G-10 | Confirmar `auditor` | RPC de roles | asignaciones protegidas | Verificación previa | Pendiente |
| G-11 | Archivar curso | Edge Function | operación masiva y auditoría | Pruebas admin | Pendiente |
| G-12 | Restaurar curso | Edge Function | operación masiva y auditoría | Pruebas admin | Pendiente |
| G-13 | Desactivar clase | Edge Function | operación masiva y auditoría | Pruebas admin | Pendiente |
| G-14 | Reactivar clase | Edge Function | operación masiva y auditoría | Pruebas admin | Pendiente |
| G-15 | Abrir ticket | RPC paginada | soporte protegido | Pruebas soporte | Pendiente |
| G-16 | Actualizar ticket | RPC protegida | `admin_update_support_ticket_secured` | Pruebas soporte | Pendiente |
| G-17 | Añadir nota interna | RPC protegida | mensajes internos | Verificación posterior | Pendiente |
| G-18 | Consultar estados auditados | RPC segura | auditoría inmutable | Pruebas admin | Pendiente |
| G-19 | Solicitar exportación | RPC protegida | `request_admin_export_job` | Pruebas exportación | Pendiente |
| G-20 | Procesar exportación | Worker con secreto | `process-admin-export-jobs` | Script local de workers | Pendiente |
| G-21 | Descargar CSV neutralizado | Bucket privado | `admin-exports` | Verificación real del archivo | Pendiente |

### Administrador restringido

| ID | Acción | Implementación principal | Recursos protegidos | Cobertura | Validación local |
|---|---|---|---|---|---|
| R-01 | Iniciar sesión | Auth y contexto admin | rol `auditor` | Verificación previa | Pendiente |
| R-02 | Consultar auditoría | RPC segura y RLS | auditoría admin | Pruebas admin | Pendiente |
| R-03 | No gestionar usuarios | Permiso granular | `users.manage` | Pruebas de autorización | Pendiente |
| R-04 | No gestionar cursos | Permiso granular | `courses.manage` | Pruebas de autorización | Pendiente |
| R-05 | No desactivar clases | Permiso granular | `courses.manage` | Pruebas de autorización | Pendiente |
| R-06 | `admin-toggle-user` devuelve 403 | Edge Function | `getAdminContext` | Verificación posterior | Pendiente |
| R-07 | El 403 no modifica datos | Lectura con `service_role` posterior | `profiles.active` | Verificación posterior | Pendiente |
| R-08 | El 403 no filtra datos | Inspección del cuerpo de respuesta | respuesta pública segura | Verificación posterior | Pendiente |

## Comandos de ejecución local

```powershell
cd omniquest
npx supabase start
npx supabase migration up --local
npm run test:migrations
npm run test:source
npm run audit:walkthrough
npx supabase test db --debug
npm run demo:prepare-functions-env
$env:OMNIQUEST_DEMO_PASSWORD = 'TU_PASSWORD_DEMO'
npm run demo:prepare
npm run demo:diagnose-auth
npm run demo:verify
npx supabase functions serve --env-file .\supabase\functions\.env --debug
```

En otra terminal:

```powershell
cd omniquest
npx expo start --web --port 8081 -c
```

Cuando se hayan solicitado las exportaciones:

```powershell
npm run demo:process-workers
```

Después de completar todos los recorridos:

```powershell
npm run demo:verify:after
```

## Criterio de cierre

El estado global solo debe cambiar de **BLOCKED** a **PASS** cuando `npx supabase test db --debug`, `npm run demo:verify`, el recorrido manual completo y `npm run demo:verify:after` terminen correctamente en el Supabase local del proyecto.

# Matriz de permisos por rol

Esta matriz resume capacidades de producto. La fuente ejecutable son las policies RLS, grants, RPC y comprobaciones de Edge Functions.

| Capacidad | Invitado | Alumno | Profesor | Administrador |
|---|---:|---:|---:|---:|
| Gestionar perfil propio | Limitado | Sí | Sí | Sí |
| Unirse a una clase | No | Sí | No | Supervisión |
| Jugar preguntas seguras | Demo limitada | Sí, si matriculado | Vista/prueba docente | Supervisión |
| Ver progreso propio | Limitado | Sí | Sí | Supervisión |
| Ver progreso de otros alumnos | No | No | Solo cursos propios | Sí, según permiso |
| Crear cursos, clases y temas | No | No | Sí | Supervisión/acciones autorizadas |
| Crear y editar preguntas | No | No | Solo contenido propio | Supervisión |
| Revisar respuestas abiertas | No | No | Solo alumnado propio | Supervisión |
| Gestionar usuarios y roles | No | No | No | Sí, con permiso |
| Ejecutar acciones sensibles | No | Reset propio controlado | Edge Functions docentes | Edge Functions administrativas |
| Consultar auditoría | No | No | Auditoría docente propia | Auditoría administrativa |
| Gestionar soporte | Crear/consultar propio | Crear/consultar propio | Crear/consultar propio | Cola y conversación según permiso |
| Exportaciones masivas | No | No | Informes propios | Jobs administrativos autorizados |

## Reglas transversales

- El cliente nunca concede permisos por sí mismo.
- Un profesor no accede a cursos, clases o alumnado ajenos.
- Un alumno no consulta el solucionario antes de responder.
- Las operaciones con service role se ejecutan únicamente en Edge Functions o procesos de servidor.
- Los permisos administrativos granulares se verifican además del valor general del rol.

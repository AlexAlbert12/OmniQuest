# ADR-0003: acciones sensibles mediante Edge Functions

- Estado: aceptada
- Contexto: algunas operaciones requieren service role, secretos externos, correo, push o auditoría que no deben residir en el cliente.

## Decisión

Las mutaciones privilegiadas se exponen mediante Edge Functions por dominio. La autorización compartida vive en `_shared/`, las respuestas públicas se sanitizan y las funciones se despliegan desde un inventario automático.

## Consecuencias

- Se centralizan autorización, auditoría y observabilidad.
- Los procesadores sin verificación JWT en gateway deben validar un secreto interno.
- El catálogo generado y CI detectan funciones no documentadas o configuración desalineada.

# ADR-0002: pirámide de pruebas ejecutables

- Estado: aceptada
- Contexto: la suite histórica comprobaba principalmente la presencia de cadenas en archivos y no detectaba fallos de renderizado, eventos o navegación.

## Decisión

Mantener contratos de arquitectura como capa rápida, y añadir React Native Testing Library, pruebas de hooks, SQL/RLS, Deno para Edge Functions, Playwright web y Maestro móvil.

## Consecuencias

- Aumenta la confianza en comportamiento real y accesibilidad.
- CI requiere instalar tooling adicional y levantar Supabase local para integración.
- Las pruebas E2E se limitan a recorridos críticos para controlar tiempo y fragilidad.

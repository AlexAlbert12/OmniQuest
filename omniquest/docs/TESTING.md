# Estrategia de pruebas de OmniQuest

## 1. Principios

La suite combina pruebas rápidas y deterministas con validaciones de integración. Las pruebas de contrato sobre texto fuente se mantienen solo como red de arquitectura; no sustituyen el renderizado, las interacciones ni los permisos reales.

## 2. Preparación local

La aplicación y las herramientas de calidad se instalan en dos pasos deliberadamente separados:

```bash
npm install
npm run quality:install
```

`npm install` instala las dependencias de ejecución de OmniQuest. `quality:install` instala las versiones fijadas de Jest, React Native Testing Library, tipos de Jest, Playwright y utilidades asociadas sin alterar el `package-lock.json` de la aplicación.

El typecheck también está separado:

```bash
npm run typecheck
npm run typecheck:tests
```

- `typecheck` valida únicamente la aplicación, excluyendo todo `tests/**`.
- `typecheck:tests` valida los tests TypeScript ubicados en cualquier carpeta `tests/**/unit/**` y debe ejecutarse después de `quality:install`.

Esta separación evita que la aplicación falle porque las herramientas de pruebas todavía no se hayan instalado y soporta tanto `tests/unit` como `tests/source/unit`.

## 3. Pirámide

### Reglas puras y contratos de arquitectura

```bash
npm run test:source
```

Valida reglas sin framework y restricciones estructurales. Se han retirado aserciones visuales frágiles basadas en valores literales como `48%`.

### Componentes y hooks

```bash
npm run quality:install
npm run typecheck:tests
npm run test:unit
```

Jest, `jest-expo` y React Native Testing Library cubren:

- renderizado y accesibilidad de controles;
- eventos de botones;
- estados loading/disabled;
- validación de formularios;
- comportamiento de `useAppFeedback`;
- nombre y parámetros JSON de RPC administrativas.

### SQL, RLS y RPC

```bash
npx supabase start
npx supabase db reset
npm run test:migrations
npm run test:db
```

Las pruebas SQL verifican aislamiento por rol, acceso al contenido educativo, juego seguro, corrección en servidor y contratos operativos. `validate-migrations.mjs` añade validación estática de nombres, timestamps, conflictos y RPC críticas.

### Edge Functions

```bash
npm run test:functions
```

Los tests Deno de `_shared/errors_test.ts` comprueban códigos HTTP, payloads públicos y que las excepciones internas no se filtren al cliente. Las funciones con lógica de dominio nueva deben añadir tests junto a su módulo o extraer reglas puras a `_shared/`.

### Web E2E, responsive y accesibilidad

```bash
npx playwright install chromium
npm run test:e2e
```

Los smoke tests cubren navegación pública, validación del login, nombres accesibles y ausencia de overflow horizontal en móvil/escritorio. Las pruebas visuales adjuntan capturas completas al informe de Playwright.

### Móvil

```bash
maestro test .maestro/public-login-smoke.yaml
```

Maestro valida un flujo mínimo sobre una build instalada. Este paso se ejecuta manualmente o en una infraestructura móvil dedicada; no se simula con pruebas de texto fuente.

## 4. Pipeline mínimo

```text
npm ci
quality tooling
lint
typecheck app + tests
unit/source tests
migration validation
Supabase reset + SQL tests
Edge Function tests
build web
Playwright E2E
```

La implementación versionada se encuentra en `.github/workflows/quality.yml`.

## 5. Política para nuevas pruebas

- Un bug debe incorporar una prueba que falle antes del arreglo.
- Una nueva RPC debe probar nombre, parámetros, permisos y respuesta relevante.
- Un formulario debe probar error y caso válido.
- Un componente interactivo debe probar nombre accesible, estado y acción.
- Una migración de seguridad debe ampliar `supabase/tests`.
- Una Edge Function debe probar sus reglas puras y respuestas públicas.
- Las capturas visuales son evidencia de revisión; los snapshots solo se promueven a baseline cuando la UI es estable.

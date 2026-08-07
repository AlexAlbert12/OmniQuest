# Runbook de backup previo a despliegue

## Objetivo

Antes de aplicar migraciones remotas, OmniQuest debe conservar evidencia suficiente para identificar el proyecto, reconstruir la versión anterior y recuperar datos si existiera una pérdida o corrupción real.

## Backup preferido

1. En proyectos con backups gestionados o PITR, abre `Database > Backups` en Supabase y confirma que existe un punto de recuperación anterior al despliegue.
2. Registra la fecha/hora UTC y el proyecto. No basta con anotar "hay backup": la referencia debe distinguir el punto concreto que se utilizaría.
3. En un proyecto sin backup gestionado adecuado, crea un backup lógico con Supabase CLI mediante `npm run release:baseline -- --logical-backup ...`.
4. Los dumps lógicos se guardan en `release-artifacts/`, que está excluido de Git porque puede contener datos personales.

Los backups de base de datos no recuperan los binarios eliminados de Supabase Storage. Si una release modifica o elimina ficheros de `avatars`, `question-media`, `account-exports`, `admin-exports` o `teacher-audit-exports`, conserva también los objetos necesarios o evita operaciones destructivas hasta cerrar la ventana de observación.

## Baseline reproducible

Con un backup gestionado ya identificado:

```powershell
npm run release:baseline -- --backup-ref "Supabase backup/PITR <fecha-hora UTC>" --frontend-ref "<git-tag-commit-EAS-build-o-release-web>"
```

Si necesitas backup lógico:

```powershell
npm run release:baseline -- --logical-backup --frontend-ref "<git-tag-commit-EAS-build-o-release-web>"
```

El script:

- identifica el `project_ref` enlazado;
- registra fecha/hora UTC, versión de `package.json` y estado Git cuando está disponible;
- guarda `supabase migration list`;
- guarda el resultado de `supabase db push --dry-run`;
- guarda `supabase functions list`;
- descarga el código de las Edge Functions actualmente desplegadas antes de sustituirlas;
- registra el inventario local de migraciones y Edge Functions;
- opcionalmente genera dumps de esquema, datos y roles.

No ejecutes `npx supabase db push` si el baseline falla o el `db-push-dry-run.txt` no coincide con lo esperado.

## Evidencias que deben conservarse

Cada directorio `release-artifacts/<timestamp>/` debe contener como mínimo:

- `release-manifest.json`;
- `migrations-remote.txt`;
- `db-push-dry-run.txt`;
- `functions-remote.txt`;
- `local-inventory.json`;
- `remote-edge-functions/` con la versión desplegada antes de la release;
- referencia de frontend anterior en `frontendRollbackRef`.

Cuando se use `--logical-backup` se añaden `database-schema.sql`, `database-data.sql` y `database-roles.sql`.

## Política de conservación

- No subas `release-artifacts/` al repositorio.
- No copies secrets de Edge Functions ni valores de Vault a las evidencias.
- Conserva el baseline al menos hasta terminar la validación funcional y operativa de la release.
- Para una defensa/demo, conserva una evidencia sin datos personales: manifiesto, listados y captura/registro del backup gestionado. El dump con datos debe permanecer fuera de la memoria y del repositorio.

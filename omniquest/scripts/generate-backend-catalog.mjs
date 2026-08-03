import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { discoverDatabaseObjects, discoverEdgeFunctions } from './backend-inventory.mjs'

const root = process.cwd()
const target = join(root, 'docs', 'generated', 'BACKEND_CATALOG.md')
const checkOnly = process.argv.includes('--check')
const [edgeFunctions, database] = await Promise.all([discoverEdgeFunctions(root), discoverDatabaseObjects(root)])
const content = renderCatalog(edgeFunctions, database)

if (checkOnly) {
  let current = ''
  try { current = await readFile(target, 'utf8') } catch { /* generated file is missing */ }
  if (current !== content) {
    console.error('docs/generated/BACKEND_CATALOG.md is out of date. Run npm run docs:generate.')
    process.exit(1)
  }
  console.log(`Backend catalog is current: ${edgeFunctions.length} Edge Functions, ${database.tables.length} tables and ${database.functions.length} SQL functions.`)
} else {
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
  console.log(`Generated ${target}`)
}

function renderCatalog(edgeFunctions, database) {
  const edgeRows = edgeFunctions.map((item) => `| \`${item.name}\` | ${item.verifyJwt ? 'JWT requerido' : 'JWT desactivado; autenticación interna/secret obligatoria'} |`).join('\n')
  const tableRows = database.tables.map((name) => `- \`${name}\``).join('\n')
  const rpcRows = database.functions.map((name) => `- \`${name}\``).join('\n')

  return `# Catálogo backend generado\n\n> Archivo generado por \`npm run docs:generate\`. No editar manualmente.\n\n## Resumen\n\n- Migraciones: **${database.migrations.length}**\n- Tablas públicas detectadas: **${database.tables.length}**\n- Funciones/RPC públicas detectadas: **${database.functions.length}**\n- Edge Functions: **${edgeFunctions.length}**\n\n## Edge Functions\n\n| Función | Verificación de acceso en gateway |\n|---|---|\n${edgeRows}\n\nLa desactivación de \`verify_jwt\` no convierte una función en pública: los procesadores programados validan su secreto interno o el contexto de servicio antes de ejecutar trabajo privilegiado.\n\n## Tablas públicas\n\n${tableRows}\n\n## Funciones y RPC públicas\n\n${rpcRows}\n`
}

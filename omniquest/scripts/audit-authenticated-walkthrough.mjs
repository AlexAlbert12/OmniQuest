import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

const root = process.cwd()
const writeMode = process.argv.includes('--write')
const checkMode = process.argv.includes('--check')
const sourceRoots = ['app', 'components', 'features', 'hooks', 'lib']
const extensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const migrationDir = join(root, 'supabase', 'migrations')
const edgeDir = join(root, 'supabase', 'functions')
const markdownPath = join(root, 'docs', 'generated', 'AUTHENTICATED_WALKTHROUGH_AUDIT.md')
const jsonPath = join(root, 'docs', 'generated', 'AUTHENTICATED_WALKTHROUGH_CALLS.json')
const expectedQuestionTypes = ['multiple_choice', 'true_false', 'open_answer', 'fill_blank', 'ordering', 'match_pairs', 'drag_drop']
const errors = []

const sourceFiles = (await Promise.all(sourceRoots.filter((path) => existsSync(join(root, path))).map((path) => collectFiles(join(root, path))))).flat().sort()
const migrationFiles = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort()
const migrationSource = (await Promise.all(migrationFiles.map((name) => readFile(join(migrationDir, name), 'utf8')))).join('\n')
const calls = []

for (const absolutePath of sourceFiles) {
  const source = await readFile(absolutePath, 'utf8')
  const path = relative(root, absolutePath).replaceAll('\\', '/')
  collectCalls(calls, source, path, 'rpc', /(?:supabase\s*\.\s*rpc|callPlatformRpc|callTeacherRpc|useAdminRpcPage|fetchAllRpcRowsUntyped)[^('\"\n]*\(\s*['"]([^'"]+)['"]/g)
  collectCalls(calls, source, path, 'edge', /(?:supabase\s*\.\s*functions\s*\.\s*invoke|invokeEdgeFunction(?:<[^>]+>)?|invokeAdminAction(?:<[^>]+>)?)\(\s*['"]([^'"]+)['"]/g)
  collectCalls(calls, source, path, 'storage', /(?:supabase\s*\.\s*)?storage\s*\.\s*from\(\s*['"]([^'"]+)['"]\)/g)
  collectCalls(calls, source, path, 'table', /(?:supabase|dynamicClient)\s*\.\s*from\(\s*['"]([^'"]+)['"]\)/g)
}

const uniqueCalls = [...new Map(calls.map((item) => [`${item.kind}|${item.resource}|${item.path}|${item.line}`, item])).values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.resource.localeCompare(b.resource) || a.path.localeCompare(b.path) || a.line - b.line)
const rpcNames = [...new Set(uniqueCalls.filter((item) => item.kind === 'rpc').map((item) => item.resource))].sort()
const edgeNames = [...new Set(uniqueCalls.filter((item) => item.kind === 'edge').map((item) => item.resource))].sort()
const tableNames = [...new Set(uniqueCalls.filter((item) => item.kind === 'table').map((item) => item.resource))].sort()
const storageBuckets = [...new Set(uniqueCalls.filter((item) => item.kind === 'storage').map((item) => item.resource))].sort()

for (const rpc of rpcNames) {
  const created = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${escapeRegExp(rpc)}\\s*\\(`, 'i').test(migrationSource)
  const granted = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${escapeRegExp(rpc)}\\s*\\([\\s\\S]*?\\)\\s+to\\s+[^;]*authenticated`, 'i').test(migrationSource)
  if (!created) errors.push(`RPC sin definición: ${rpc}`)
  if (!granted) errors.push(`RPC sin EXECUTE para authenticated: ${rpc}`)
}
for (const edge of edgeNames) if (!existsSync(join(edgeDir, edge, 'index.ts'))) errors.push(`Edge Function inexistente: ${edge}`)

const clientSource = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n')
if (/https:\/\/[a-z0-9]{20}\.supabase\.co/i.test(clientSource)) errors.push('El código cliente contiene una URL remota fija de Supabase.')
if (/\.from\(\s*['"]notifications['"]\s*\)/.test(clientSource)) errors.push('El cliente accede directamente a notifications en lugar de usar la API protegida.')
for (const type of expectedQuestionTypes) if (!clientSource.includes(type)) errors.push(`Tipo de pregunta no conectado en cliente: ${type}`)

const finalMatrix = await readFile(join(migrationDir, '20260805200000_authenticated_walkthrough_authorization_matrix.sql'), 'utf8')
for (const table of ['roles', 'profiles', 'subjects', 'classrooms', 'subject_topics', 'questions', 'answers', 'enrollments', 'subject_scores', 'topic_scores', 'attempt_history', 'student_badges', 'notification_state', 'user_preferences', 'user_notification_preferences', 'user_support_tickets', 'support_ticket_messages', 'support_ticket_attachments', 'account_deletion_requests', 'data_export_requests', 'admin_audit_logs', 'notifications']) {
  if (!finalMatrix.includes(`public.${table}`)) errors.push(`La matriz final no incluye la tabla cliente: ${table}`)
}
const csvSource = await readFile(join(root, 'supabase', 'functions', '_shared', 'csv.ts'), 'utf8')
if (!csvSource.includes('/^[\\t\\r]/.test(raw)') || !csvSource.includes('/^[=+@-]/.test(raw.trimStart())')) errors.push('La exportación servidor no neutraliza todos los prefijos de fórmula.')
const adminBulk = await readFile(join(root, 'supabase', 'functions', 'admin-bulk-operations', 'index.ts'), 'utf8')
if (!/writeAdminAudit\([\s\S]*action: auditAction[\s\S]*targetTable: 'profiles'/.test(adminBulk)) errors.push('Las activaciones y desactivaciones masivas no generan auditoría individual.')

const summary = {
  generatedAt: migrationFiles.at(-1) || 'sin-migraciones',
  sourceFiles: sourceFiles.length,
  calls: uniqueCalls.length,
  tables: tableNames,
  rpcs: rpcNames,
  edgeFunctions: edgeNames,
  storageBuckets,
  errors,
}
const markdown = buildMarkdown(summary, uniqueCalls)
const json = `${JSON.stringify({ ...summary, calls: uniqueCalls }, null, 2)}\n`

if (writeMode) {
  await mkdir(dirname(markdownPath), { recursive: true })
  await writeFile(markdownPath, markdown)
  await writeFile(jsonPath, json)
}
if (checkMode) {
  await assertCurrent(markdownPath, markdown)
  await assertCurrent(jsonPath, json)
}
console.log(`Walkthrough audit: ${uniqueCalls.length} calls, ${tableNames.length} tables, ${rpcNames.length} RPCs, ${edgeNames.length} Edge Functions, ${errors.length} issue(s).`)
if (errors.length) {
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(path)
    const extension = entry.name.slice(entry.name.lastIndexOf('.'))
    return extensions.has(extension) ? [path] : []
  }))
  return nested.flat()
}

function collectCalls(target, source, path, kind, pattern) {
  for (const match of source.matchAll(pattern)) target.push({ kind, resource: match[1], path, line: source.slice(0, match.index).split('\n').length })
}

function buildMarkdown(summary, inventory) {
  const lines = [
    '# Auditoría de recorridos autenticados', '',
    `Estado acumulado hasta: ${summary.generatedAt}`, '',
    '## Resumen', '',
    `- Archivos cliente inspeccionados: ${summary.sourceFiles}`,
    `- Llamadas inventariadas: ${summary.calls}`,
    `- Tablas detectadas: ${summary.tables.length}`,
    `- RPC detectadas: ${summary.rpcs.length}`,
    `- Edge Functions detectadas: ${summary.edgeFunctions.length}`,
    `- Buckets detectados: ${summary.storageBuckets.length}`,
    `- Incidencias estructurales: ${summary.errors.length}`, '',
    '## Recursos', '',
    `- Tablas: ${summary.tables.join(', ') || 'Ninguna'}`,
    `- RPC: ${summary.rpcs.join(', ') || 'Ninguna'}`,
    `- Edge Functions: ${summary.edgeFunctions.join(', ') || 'Ninguna'}`,
    `- Buckets: ${summary.storageBuckets.join(', ') || 'Ninguno'}`, '',
    '## Inventario de llamadas', '',
    '| Tipo | Recurso | Archivo | Línea |',
    '|---|---|---|---:|',
    ...inventory.map((item) => `| ${item.kind} | \`${item.resource}\` | \`${item.path}\` | ${item.line} |`), '',
    '## Resultado', '',
    summary.errors.length ? summary.errors.map((error) => `- FAIL: ${error}`).join('\n') : '- PASS: no se detectaron huecos estructurales en el inventario estático.', '',
  ]
  return `${lines.join('\n')}\n`
}

async function assertCurrent(path, expected) {
  const current = await readFile(path, 'utf8').catch(() => '')
  if (current !== expected) errors.push(`Artefacto generado desactualizado: ${relative(root, path).replaceAll('\\', '/')}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

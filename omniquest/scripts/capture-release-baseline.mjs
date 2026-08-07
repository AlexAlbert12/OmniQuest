import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { discoverDatabaseObjects, discoverEdgeFunctions } from './backend-inventory.mjs'

const root = process.cwd()
const options = parseArgs(process.argv.slice(2))

if (options.help) {
  printHelp()
  process.exit(0)
}

if (!existsSync(join(root, 'package.json')) || !existsSync(join(root, 'supabase', 'config.toml'))) {
  fail('Ejecuta este comando desde la raiz de omniquest.')
}

const projectRef = options.projectRef || process.env.SUPABASE_PROJECT_REF?.trim() || readLinkedProjectRef(root)
if (!projectRef) fail('No se pudo identificar el proyecto Supabase. Ejecuta `npx supabase link --project-ref ...` o usa `--project-ref`.')
if (!options.frontendRef) fail('Debes indicar `--frontend-ref` con el commit/tag, EAS build id o release web anterior compatible.')
if (!options.backupReference && !options.logicalBackup) fail('Debes acreditar un backup gestionado con `--backup-ref "..."` o crear un backup logico con `--logical-backup`.')

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const database = await discoverDatabaseObjects(root)
const edgeFunctions = await discoverEdgeFunctions(root)
const git = readGitState(root)
const now = new Date()
const stamp = formatStamp(now)
const artifactRoot = resolve(root, options.outputDir || 'release-artifacts', stamp)
const remoteFunctionsRoot = join(artifactRoot, 'remote-edge-functions')

if (options.dryRun) {
  console.log('Pre-deploy baseline (dry run)')
  console.log(`Project: ${projectRef}`)
  console.log(`Output: ${artifactRoot}`)
  console.log(`Local migrations: ${database.migrations.length}`)
  console.log(`Local Edge Functions: ${edgeFunctions.length}`)
  console.log(`Backup: ${options.logicalBackup ? 'logical dump' : options.backupReference}`)
  console.log(`Frontend rollback ref: ${options.frontendRef}`)
  process.exit(0)
}

await mkdir(artifactRoot, { recursive: true })

const localInventory = {
  migrations: database.migrations,
  edgeFunctions,
}
await writeFile(join(artifactRoot, 'local-inventory.json'), `${JSON.stringify(localInventory, null, 2)}\n`)

const migrationList = runSupabase(['migration', 'list', '--linked'], root)
await writeFile(join(artifactRoot, 'migrations-remote.txt'), migrationList)

const dryRun = runSupabase(['db', 'push', '--dry-run', '--linked'], root)
await writeFile(join(artifactRoot, 'db-push-dry-run.txt'), dryRun)

const functionsList = runSupabase(['functions', 'list', '--project-ref', projectRef], root)
await writeFile(join(artifactRoot, 'functions-remote.txt'), functionsList)

if (options.logicalBackup) {
  console.log('\nCreating logical database backup...')
  runSupabase(['db', 'dump', '--linked', '--file', join(artifactRoot, 'database-schema.sql')], root, true)
  runSupabase(['db', 'dump', '--linked', '--data-only', '--use-copy', '--file', join(artifactRoot, 'database-data.sql')], root, true)
  runSupabase(['db', 'dump', '--linked', '--role-only', '--file', join(artifactRoot, 'database-roles.sql')], root, true)
}

console.log('\nDownloading the currently deployed Edge Functions...')
await mkdir(join(remoteFunctionsRoot, 'supabase'), { recursive: true })
await cp(join(root, 'supabase', 'config.toml'), join(remoteFunctionsRoot, 'supabase', 'config.toml'))
runSupabase(['--workdir', remoteFunctionsRoot, 'functions', 'download', '--project-ref', projectRef, '--use-api'], root, true)

const deployedFunctionFiles = await listFilesIfPresent(join(remoteFunctionsRoot, 'supabase', 'functions'))
const frontendRef = options.frontendRef
const manifest = {
  capturedAtUtc: now.toISOString(),
  projectRef,
  packageVersion: String(packageJson.version || 'unknown'),
  backup: options.logicalBackup
    ? {
        mode: 'logical-cli',
        files: ['database-schema.sql', 'database-data.sql', 'database-roles.sql'],
        warning: 'Supabase CLI db dump excludes Supabase-managed schemas by default and does not back up Storage object binaries.',
      }
    : { mode: 'managed-supabase', reference: options.backupReference },
  frontendRollbackRef: frontendRef,
  git,
  localMigrationCount: database.migrations.length,
  localEdgeFunctionCount: edgeFunctions.length,
  remoteEdgeFunctionSourceFiles: deployedFunctionFiles.length,
  evidence: ['migrations-remote.txt', 'db-push-dry-run.txt', 'functions-remote.txt', 'local-inventory.json', 'remote-edge-functions/'],
  compensatingMigrationPlan: 'docs/runbooks/rollback/20260807113500_teacher_audit_export_worker.compensating.sql',
}
await writeFile(join(artifactRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await writeFile(join(artifactRoot, 'README.txt'), buildReadme(manifest))

console.log(`\nBaseline completed: ${artifactRoot}`)
console.log('Do not commit release-artifacts: it can contain a database data dump.')
console.log('Review db-push-dry-run.txt before running `npx supabase db push`.')

function parseArgs(args) {
  const result = { backupReference: '', dryRun: false, frontendRef: '', help: false, logicalBackup: false, outputDir: '', projectRef: '' }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') result.help = true
    else if (arg === '--logical-backup') result.logicalBackup = true
    else if (arg === '--dry-run') result.dryRun = true
    else if (arg === '--project-ref') result.projectRef = requireValue(args, ++index, arg)
    else if (arg === '--backup-ref') result.backupReference = requireValue(args, ++index, arg)
    else if (arg === '--frontend-ref') result.frontendRef = requireValue(args, ++index, arg)
    else if (arg === '--output-dir') result.outputDir = requireValue(args, ++index, arg)
    else fail(`Argumento no reconocido: ${arg}`)
  }
  return result
}

function requireValue(args, index, flag) {
  const value = args[index]?.trim()
  if (!value || value.startsWith('--')) fail(`Falta el valor de ${flag}.`)
  return value
}

function readLinkedProjectRef(projectRoot) {
  const path = join(projectRoot, 'supabase', '.temp', 'project-ref')
  if (!existsSync(path)) return ''
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

function readGitState(projectRoot) {
  const inside = run('git', ['rev-parse', '--is-inside-work-tree'], projectRoot, false)
  if (!inside.ok || inside.stdout.trim() !== 'true') return { available: false, branch: null, commit: null, dirty: null }
  const commit = run('git', ['rev-parse', 'HEAD'], projectRoot, false).stdout.trim() || null
  const branch = run('git', ['branch', '--show-current'], projectRoot, false).stdout.trim() || null
  const dirty = Boolean(run('git', ['status', '--porcelain'], projectRoot, false).stdout.trim())
  return { available: true, branch, commit, dirty }
}

function runSupabase(args, cwd, inherit = false) {
  const require = createRequire(import.meta.url)
  let cliPath
  try {
    cliPath = require.resolve('supabase/dist/supabase.js')
  } catch {
    fail('No se encontro el Supabase CLI local. Ejecuta `npm ci` antes de preparar la release.')
  }
  const result = spawnSync(process.execPath, [cliPath, ...args], { cwd, env: process.env, encoding: inherit ? undefined : 'utf8', stdio: inherit ? 'inherit' : 'pipe' })
  if (result.error) fail(`No se pudo iniciar Supabase CLI: ${result.error.message}`)
  if (result.status !== 0) {
    if (!inherit) {
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
    fail(`Supabase CLI termino con codigo ${result.status}: supabase ${args.join(' ')}`)
  }
  return inherit ? '' : `${result.stdout || ''}${result.stderr || ''}`
}

function run(command, args, cwd, inherit) {
  const result = spawnSync(command, args, { cwd, env: process.env, encoding: inherit ? undefined : 'utf8', stdio: inherit ? 'inherit' : 'pipe' })
  return { ok: !result.error && result.status === 0, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') }
}

async function listFilesIfPresent(directory) {
  if (!existsSync(directory)) return []
  const output = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) await walk(fullPath)
      else output.push(fullPath.slice(directory.length + 1).replaceAll('\\', '/'))
    }
  }
  await walk(directory)
  return output.sort()
}

function buildReadme(manifest) {
  return [
    'OmniQuest pre-deploy baseline',
    `Captured UTC: ${manifest.capturedAtUtc}`,
    `Project: ${manifest.projectRef}`,
    `Frontend rollback ref: ${manifest.frontendRollbackRef || 'NOT RECORDED - record it manually before deploying frontend'}`,
    `Database backup mode: ${manifest.backup.mode}`,
    '',
    'Required checks before db push:',
    '1. Confirm the backup/snapshot is usable and belongs to this project.',
    '2. Review migrations-remote.txt and db-push-dry-run.txt.',
    '3. Keep remote-edge-functions/ until the observation window has ended.',
    '4. Do not remove rows from supabase_migrations.schema_migrations to roll back.',
    '5. Prefer fix-forward; use a new compensating migration when schema rollback is needed.',
    '',
    'Important: database dumps and managed database backups do not restore deleted Storage object binaries. Back up critical Storage objects separately when applicable.',
    '',
  ].join('\n')
}

function formatStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function printHelp() {
  console.log(`Usage:\n  npm run release:baseline -- --backup-ref "Dashboard backup 2026-08-07 10:00 UTC" --frontend-ref <git-tag-or-build-id>\n  npm run release:baseline -- --logical-backup --frontend-ref <git-tag-or-build-id>\n\nOptions:\n  --project-ref <ref>     Project ref if the local project is not linked.\n  --backup-ref <text>     Evidence/reference for a Supabase-managed backup or PITR point.\n  --logical-backup        Create schema, data and role dumps with Supabase CLI.\n  --frontend-ref <ref>    Git tag/commit, EAS build id or web release id used for frontend rollback.\n  --output-dir <path>     Base directory for evidence. Default: release-artifacts.\n  --dry-run               Validate local inputs without invoking the remote project.\n  -h, --help              Show this help.\n\nOne of --backup-ref or --logical-backup is mandatory. The generated release-artifacts directory is gitignored because a logical data dump can contain personal data.`)
}

function fail(message) {
  console.error(`\n[release:baseline] ${message}`)
  process.exit(1)
}

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function discoverEdgeFunctions(root = process.cwd()) {
  const functionsDir = join(root, 'supabase', 'functions')
  const config = await readFile(join(root, 'supabase', 'config.toml'), 'utf8')
  const entries = await readdir(functionsDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => ({ name: entry.name, verifyJwt: readVerifyJwt(config, entry.name) }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function discoverDatabaseObjects(root = process.cwd()) {
  const migrationsDir = join(root, 'supabase', 'migrations')
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
  const tables = new Map()
  const functions = new Map()

  for (const file of files) {
    const source = await readFile(join(migrationsDir, file), 'utf8')
    applyObjectEvents(source, file, tables, functions)
  }

  return {
    tables: [...tables.entries()].filter(([, state]) => state.active).map(([name]) => name).sort(),
    functions: [...functions.entries()].filter(([, state]) => state.active).map(([name]) => name).sort(),
    migrations: files,
  }
}

function readVerifyJwt(config, functionName) {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const section = config.match(new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`))
  if (!section) return true
  const value = section[1].match(/^\s*verify_jwt\s*=\s*(true|false)\s*$/m)
  return value ? value[1] === 'true' : true
}

function applyObjectEvents(source, file, tables, functions) {
  const eventPattern = /\b(create\s+(?:or\s+replace\s+)?function|drop\s+function(?:\s+if\s+exists)?|create\s+(?:unlogged\s+)?table(?:\s+if\s+not\s+exists)?|drop\s+table(?:\s+if\s+exists)?)\s+(?:only\s+)?public\.([a-zA-Z_][a-zA-Z0-9_]*)/gi
  for (const match of source.matchAll(eventPattern)) {
    const operation = match[1].toLowerCase().replace(/\s+/g, ' ')
    const name = match[2]
    const collection = operation.includes('function') ? functions : tables
    collection.set(name, { active: operation.startsWith('create'), file })
  }
}

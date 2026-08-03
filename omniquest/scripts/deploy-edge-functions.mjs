import { spawnSync } from 'node:child_process'
import { discoverEdgeFunctions } from './backend-inventory.mjs'

const selected = new Set(process.argv.slice(2))
const allFunctions = await discoverEdgeFunctions(process.cwd())
const functions = selected.size ? allFunctions.filter((item) => selected.has(item.name)) : allFunctions

if (selected.size && functions.length !== selected.size) {
  const known = new Set(functions.map((item) => item.name))
  const missing = [...selected].filter((name) => !known.has(name))
  console.error(`Unknown Edge Function(s): ${missing.join(', ')}`)
  process.exit(1)
}

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
for (const item of functions) {
  const args = ['supabase', 'functions', 'deploy', item.name]
  if (!item.verifyJwt) args.push('--no-verify-jwt')
  console.log(`\nDeploying ${item.name}${item.verifyJwt ? '' : ' (--no-verify-jwt)'}...`)
  const result = spawnSync(executable, args, { cwd: process.cwd(), stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log(`\nDeployed ${functions.length} Edge Function(s).`)

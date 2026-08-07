import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { discoverEdgeFunctions } from './backend-inventory.mjs'

const require = createRequire(import.meta.url)
const supabaseCliPath = require.resolve('supabase/dist/supabase.js')
const selected = new Set(process.argv.slice(2))
const allFunctions = await discoverEdgeFunctions(process.cwd())
const functions = selected.size ? allFunctions.filter((item) => selected.has(item.name)) : allFunctions

if (selected.size && functions.length !== selected.size) {
  const known = new Set(functions.map((item) => item.name))
  const missing = [...selected].filter((name) => !known.has(name))
  console.error(`Unknown Edge Function(s): ${missing.join(', ')}`)
  process.exit(1)
}

for (const item of functions) {
  const args = ['functions', 'deploy', item.name]
  if (!item.verifyJwt) args.push('--no-verify-jwt')
  console.log(`\nDeploying ${item.name}${item.verifyJwt ? '' : ' (--no-verify-jwt)'}...`)
  const result = spawnSync(process.execPath, [supabaseCliPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) {
    console.error(`Could not start Supabase CLI for ${item.name}:`, result.error)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log(`\nDeployed ${functions.length} Edge Function(s).`)

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const migrationsDir = join(root, 'supabase', 'migrations')
const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
const errors = []
const timestamps = new Set()

for (const file of files) {
  const match = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/)
  if (!match) errors.push(`${file}: expected YYYYMMDDHHMMSS_snake_case.sql`)
  if (match && timestamps.has(match[1])) errors.push(`${file}: duplicated migration timestamp ${match[1]}`)
  if (match) timestamps.add(match[1])

  const source = await readFile(join(migrationsDir, file), 'utf8')
  if (!source.trim()) errors.push(`${file}: empty migration`)
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(source)) errors.push(`${file}: unresolved merge conflict`)
}

const completeSource = await Promise.all(files.map((file) => readFile(join(migrationsDir, file), 'utf8'))).then((parts) => parts.join('\n'))
for (const required of ['start_game_attempt', 'get_safe_game_questions', 'submit_answer', 'get_attempt_feedback', 'finish_game_attempt']) {
  if (!new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${required}\\s*\\(`, 'i').test(completeSource)) {
    errors.push(`secure game RPC ${required} is not created by any migration`)
  }
}
if (!/revoke\s+execute\s+on\s+function\s+public\.get_game_questions[\s\S]*?from\s+authenticated/i.test(completeSource)) {
  errors.push('legacy get_game_questions is not revoked from authenticated clients')
}
if (!/grant\s+execute\s+on\s+function\s+public\.get_safe_game_questions[\s\S]*?to\s+authenticated/i.test(completeSource)) {
  errors.push('get_safe_game_questions is not granted to authenticated clients')
}

const sqlTests = (await readdir(join(root, 'supabase', 'tests'))).filter((name) => name.endsWith('.sql'))
if (!sqlTests.length) errors.push('supabase/tests does not contain SQL tests')

if (errors.length) {
  console.error(`Migration validation failed with ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Validated ${files.length} migrations, ${sqlTests.length} SQL test files and the secure game RPC contract.`)

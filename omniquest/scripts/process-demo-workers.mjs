import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadLocalSupabaseEnvironment } from './local-supabase-environment.mjs'

const { url, anonKey } = loadLocalSupabaseEnvironment()
const source = await readFile(join(process.cwd(), 'supabase', 'functions', '.env'), 'utf8').catch(() => '')
const env = parseEnvironment(source)
const workers = [
  { name: 'Exportaciones administrativas', functionName: 'process-admin-export-jobs', header: 'x-queue-secret', secretName: 'ADMIN_EXPORT_QUEUE_SECRET', secret: env.ADMIN_EXPORT_QUEUE_SECRET },
  { name: 'Exportaciones de auditoría docente', functionName: 'process-teacher-audit-exports', header: 'x-cron-secret', secretName: 'TEACHER_AUDIT_EXPORT_SECRET', secret: env.TEACHER_AUDIT_EXPORT_SECRET },
]
const results = []
for (const worker of workers) {
  if (!worker.secret) throw new Error(`Falta ${worker.secretName} en supabase/functions/.env. Ejecuta npm run demo:prepare-functions-env.`)
  let processed = 0
  let rounds = 0
  while (rounds < 10) {
    rounds += 1
    const response = await fetch(`${url}/functions/v1/${worker.functionName}`, { method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json', [worker.header]: worker.secret }, body: JSON.stringify({ limit: 10 }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`${worker.functionName} respondió ${response.status}: ${String(payload?.error || 'error desconocido')}`)
    const current = Number(payload?.processed || 0)
    processed += current
    if (current === 0) break
  }
  results.push({ proceso: worker.name, resultado: 'PASS', procesados: processed, rondas: rounds })
}
console.table(results)

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf('=')
    return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1)] : null
  }).filter(Boolean))
}

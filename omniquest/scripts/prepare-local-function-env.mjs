import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const path = join(process.cwd(), 'supabase', 'functions', '.env')
const secretNames = ['AUTH_RATE_LIMIT_PEPPER', 'ADMIN_EXPORT_QUEUE_SECRET', 'TEACHER_AUDIT_EXPORT_SECRET', 'QUESTION_MEDIA_CLEANUP_SECRET', 'ACCOUNT_REQUESTS_CRON_SECRET', 'PUSH_QUEUE_SECRET', 'SUPPORT_EMAIL_QUEUE_SECRET', 'DIGEST_QUEUE_SECRET']
const current = await readFile(path, 'utf8').catch(() => '')
const values = parseEnvironment(current)
for (const name of secretNames) if (!values[name]) values[name] = randomBytes(32).toString('hex')
values.EMAIL_DELIVERY_MODE ||= 'redirect'
const localWebUrl = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '8081'}`
values.SITE_URL ||= localWebUrl
values.PASSWORD_RESET_REDIRECT_TO ||= `${localWebUrl}/reset-password`
values.PASSWORD_RECOVERY_REDIRECT_URL ||= values.PASSWORD_RESET_REDIRECT_TO
const order = [...secretNames, 'EMAIL_DELIVERY_MODE', 'SITE_URL', 'PASSWORD_RESET_REDIRECT_TO', 'PASSWORD_RECOVERY_REDIRECT_URL']
const outputNames = [...order, ...Object.keys(values).filter((name) => !order.includes(name))]
const output = `${outputNames.map((name) => `${name}=${values[name]}`).join('\n')}\n`
await mkdir(dirname(path), { recursive: true })
await writeFile(path, output, { mode: 0o600 })
console.table(order.map((name) => ({ variable: name, estado: values[name] ? 'configurada' : 'ausente' })))
console.log('Entorno local de Edge Functions preparado sin mostrar secretos.')

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf('=')
    return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1)] : null
  }).filter(Boolean))
}

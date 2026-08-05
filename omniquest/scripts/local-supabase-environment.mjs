import { execFileSync } from 'node:child_process'

export function loadLocalSupabaseEnvironment() {
  const output = readLocalSupabaseStatus()
  const values = parseEnvironment(output)
  const url = process.env.SUPABASE_URL || values.API_URL || values.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || values.ANON_KEY || values.PUBLISHABLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || values.SERVICE_ROLE_KEY || values.SECRET_KEY
  if (!url || !anonKey || !serviceRoleKey) throw new Error('No se pudieron obtener las credenciales de Supabase local. Ejecuta npx supabase start antes de continuar.')
  const hostname = new URL(url).hostname
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname) && process.env.ALLOW_REMOTE_DEMO_SEED !== 'true') throw new Error(`Se rechazó preparar datos demo fuera de local: ${url}`)
  return { url, anonKey, serviceRoleKey }
}

function readLocalSupabaseStatus() {
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  try {
    if (process.platform === 'win32') {
      const commandProcessor = process.env.ComSpec || 'cmd.exe'
      return execFileSync(commandProcessor, ['/d', '/s', '/c', 'npx supabase status -o env'], options)
    }
    return execFileSync('npx', ['supabase', 'status', '-o', 'env'], options)
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : Buffer.isBuffer(error?.stderr) ? error.stderr.toString('utf8').trim() : ''
    throw new Error(stderr || 'No se pudo consultar Supabase local. Comprueba que Docker Desktop y npx supabase start estén activos.', { cause: error })
  }
}

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf('=')
    if (separator < 1) return null
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    return [key, value]
  }).filter(Boolean))
}

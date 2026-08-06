import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { loadLocalSupabaseEnvironment } from './local-supabase-environment.mjs'

const port = readPort(process.env.PLAYWRIGHT_PORT || '8082')
await assertPortAvailable(port)

const require = createRequire(import.meta.url)
const expoCli = require.resolve('expo/bin/cli')
const expoArgs = ['start', '--web', '--port', String(port)]
if (process.env.PLAYWRIGHT_CLEAR_CACHE === '1') expoArgs.push('--clear')

const child = spawn(process.execPath, [expoCli, ...expoArgs], {
  cwd: process.cwd(),
  env: resolveEnvironment(port),
  stdio: 'inherit',
  windowsHide: true,
})

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', (error) => {
  console.error(`No se pudo iniciar Expo para Playwright: ${error.message}`)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})

function readPort(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`PLAYWRIGHT_PORT debe ser un puerto válido. Valor recibido: ${value}`)
  return parsed
}

function resolveEnvironment(value) {
  const environment = { ...process.env, CI: '1', BROWSER: 'none', PLAYWRIGHT_PORT: String(value) }
  const hasExplicitSupabaseEnvironment = Boolean(
    environment.EXPO_PUBLIC_SUPABASE_URL ||
    environment.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    environment.EXPO_PUBLIC_SUPABASE_KEY,
  )
  if (hasExplicitSupabaseEnvironment) return environment

  try {
    const { url, anonKey } = loadLocalSupabaseEnvironment()
    environment.EXPO_PUBLIC_SUPABASE_URL = url
    environment.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey
  } catch {
    // Expo may still resolve a complete checked-in or local dotenv configuration.
  }
  return environment
}

function assertPortAvailable(value) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', (error) => {
      const cause = error?.code === 'EADDRINUSE' ? `El puerto ${value} está ocupado. Cierra el proceso que lo usa o define PLAYWRIGHT_PORT con otro puerto libre.` : error.message
      reject(new Error(cause))
    })
    server.listen({ host: '127.0.0.1', port: value, exclusive: true }, () => server.close(resolve))
  })
}

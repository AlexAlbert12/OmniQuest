import { spawnSync } from 'node:child_process'
import { getMissingAuthenticatedE2EEnvironment, hasAuthenticatedE2EEnvironment } from './authenticated.helpers'

export default function globalSetup() {
  const configured = hasAuthenticatedE2EEnvironment()
  const missing = getMissingAuthenticatedE2EEnvironment()
  const allowAuthenticatedSkip = process.env.E2E_ALLOW_AUTH_SKIP === '1'

  if (!configured && missing.length === 6 && allowAuthenticatedSkip) return
  if (!configured) throw new Error(`La configuración E2E autenticada está incompleta. Faltan: ${missing.join(', ')}. Define las seis variables en esta misma terminal antes de ejecutar npm run test:e2e.`)

  const result = spawnSync(process.execPath, ['scripts/prepare-authenticated-e2e.mjs'], { cwd: process.cwd(), env: process.env, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`La preparación E2E autenticada terminó con código ${result.status ?? 'desconocido'}.`)
}

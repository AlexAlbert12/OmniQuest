import { spawnSync } from 'node:child_process'
import { getMissingAuthenticatedE2EEnvironment, hasAuthenticatedE2EEnvironment } from './authenticated.helpers'

export default function globalSetup() {
  const configured = hasAuthenticatedE2EEnvironment()
  const missing = getMissingAuthenticatedE2EEnvironment()
  if (!configured && missing.length === 6) return
  if (!configured) throw new Error(`La configuración E2E autenticada está incompleta. Faltan: ${missing.join(', ')}`)

  const result = spawnSync(process.execPath, ['scripts/prepare-authenticated-e2e.mjs'], { cwd: process.cwd(), env: process.env, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`La preparación E2E autenticada terminó con código ${result.status ?? 'desconocido'}.`)
}

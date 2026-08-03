import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const manifest = JSON.parse(await readFile(new URL('../quality/tooling.json', import.meta.url), 'utf8'))
const packages = Array.isArray(manifest.packages) ? manifest.packages.filter((value) => typeof value === 'string' && value.trim().length > 0) : []
if (!packages.length) throw new Error('quality/tooling.json does not define any packages.')

const npmArgs = ['install', '--no-save', '--package-lock=false', '--legacy-peer-deps', ...packages]
const npmExecPath = process.env.npm_execpath

console.log(`Installing ${packages.length} pinned quality packages...`)

const result = npmExecPath
  ? spawnSync(process.execPath, [npmExecPath, ...npmArgs], { cwd: process.cwd(), env: process.env, stdio: 'inherit', shell: false })
  : spawnSync('npm', npmArgs, { cwd: process.cwd(), env: process.env, stdio: 'inherit', shell: process.platform === 'win32' })

if (result.error) {
  console.error('Could not start npm:', result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8')

test('quality pipeline runs behavioural, SQL, Edge Function and web E2E layers', () => {
  const workflow = read('.github/workflows/quality.yml')
  const packageJson = read('package.json')

  assert.match(workflow, /npm run test:unit/)
  assert.match(workflow, /npm run test:db/)
  assert.match(workflow, /npm run test:functions/)
  assert.match(workflow, /npm run test:e2e/)
  assert.match(workflow, /npm run build:web/)
  assert.match(packageJson, /"test:unit"/)
})

test('deployment documentation and generated catalog cover the current backend', () => {
  const architecture = read('docs/ARCHITECTURE.md')
  const catalog = read('docs/generated/BACKEND_CATALOG.md')
  const deployment = read('docs/DEPLOYMENT.md')

  assert.match(architecture, /get_safe_game_questions/)
  assert.match(architecture, /submit_answer_resumable/)
  assert.match(catalog, /send-push-notification/)
  assert.match(deployment, /deploy-edge-functions\.mjs/)
  assert.doesNotMatch(deployment, /Funciones actuales:\s*```text/)
})

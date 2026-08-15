import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { DEMO_QUESTIONS, STUDENT_IDENTITIES, TEACHER_IDENTITIES } from '../../scripts/tfm-dataset-config.mjs'

const expectedTypes = ['multiple_choice', 'true_false', 'open_answer', 'fill_blank', 'ordering', 'match_pairs', 'drag_drop']

test('TFM demo identities are complete, synthetic and unique', () => {
  assert.equal(TEACHER_IDENTITIES.length, 4)
  assert.equal(STUDENT_IDENTITIES.length, 25)
  const identities = [...TEACHER_IDENTITIES, ...STUDENT_IDENTITIES]
  assert.equal(new Set(identities.map((identity) => identity.email)).size, identities.length)
  assert.ok(identities.every((identity) => identity.email.endsWith('@demo.omniquest.test')))
  assert.equal(TEACHER_IDENTITIES.filter((identity) => identity.demoLogin).length, 1)
  assert.equal(STUDENT_IDENTITIES.filter((identity) => identity.demoLogin).length, 1)
})

test('TFM demo question additions cover all supported interaction types', () => {
  assert.ok(DEMO_QUESTIONS.length >= 9)
  const types = new Set(DEMO_QUESTIONS.map((question) => question.type))
  for (const type of expectedTypes) assert.ok(types.has(type), `Falta ${type}`)
  assert.ok(DEMO_QUESTIONS.every((question) => question.text.trim().length > 0 && question.answers.length > 0))
})

test('TFM dataset apply path has explicit destructive-operation guards', async () => {
  const source = await readFile(new URL('../../scripts/prepare-tfm-dataset.mjs', import.meta.url), 'utf8')
  assert.match(source, /process\.argv\.includes\('--apply'\)/)
  assert.match(source, /assertApplyConfirmation\(\)/)
  assert.match(source, /--keep-question-media-path/)
  assert.match(source, /OMNIQUEST_TFM_DEMO_PASSWORD/)
  assert.match(source, /DRY RUN completado/)
})

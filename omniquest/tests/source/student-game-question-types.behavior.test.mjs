import test from 'node:test'
import assert from 'node:assert/strict'
import {
  QUESTION_TYPES,
  normalizeQuestionType,
  isChoiceQuestion,
  getQuestionInstruction,
  getBlankCount,
  splitFillPrompt,
  buildOpenAnswerSubmission,
  buildFillBlankSubmission,
  buildOrderingSubmission,
  buildPairingSubmission,
  withQuestionVersionMetadata,
  isQuestionVersionConflict,
} from '../../lib/gameQuestionLogic.js'

test('supports every game question type explicitly', () => {
  assert.deepEqual(QUESTION_TYPES, [
    'multiple_choice',
    'true_false',
    'open_answer',
    'fill_blank',
    'ordering',
    'match_pairs',
    'drag_drop',
  ])
  for (const type of QUESTION_TYPES) {
    assert.equal(normalizeQuestionType(type), type)
    assert.ok(getQuestionInstruction(type).length > 3)
  }
  assert.equal(normalizeQuestionType('unknown'), 'multiple_choice')
  assert.equal(isChoiceQuestion('multiple_choice'), true)
  assert.equal(isChoiceQuestion('true_false'), true)
  assert.equal(isChoiceQuestion('open_answer'), false)
})

test('normalizes open answers without changing their meaning', () => {
  assert.deepEqual(buildOpenAnswerSubmission('  Madrid  '), { answerText: 'Madrid' })
})

test('builds ordered fill-blank submissions', () => {
  assert.equal(getBlankCount({ text: 'La ___ de ___', blank_count: 2 }), 2)
  assert.deepEqual(splitFillPrompt('La ___ de [[blank]]'), ['La ', ' de ', ''])
  assert.deepEqual(buildFillBlankSubmission(['  Tierra ', ' España ']), { answerText: 'Tierra, España' })
})

test('preserves the requested order for ordering questions', () => {
  assert.deepEqual(buildOrderingSubmission([9, 4, 7]), { payload: { answer_ids: [9, 4, 7] } })
})

test('builds normalized pairs for matching and drag-drop questions', () => {
  const expected = { payload: { pairs: [{ left: 'Sol', right: 'Estrella' }, { left: 'Tierra', right: 'Planeta' }] } }
  assert.deepEqual(buildPairingSubmission([
    { left: ' Sol ', right: ' Estrella ' },
    { left: ' Tierra ', right: ' Planeta ' },
  ]), expected)
})

test('attaches the downloaded question version to offline submissions', () => {
  const result = withQuestionVersionMetadata({ answer_ids: [1, 2] }, '2026-07-29T08:00:00.000Z')
  assert.deepEqual(result, {
    answer_ids: [1, 2],
    _omniquest_question_updated_at: '2026-07-29T08:00:00.000Z',
  })
  assert.deepEqual(withQuestionVersionMetadata(undefined, '2026-07-29T08:00:00.000Z'), {
    _omniquest_question_updated_at: '2026-07-29T08:00:00.000Z',
  })
})

test('detects server conflicts caused by edited offline questions', () => {
  assert.equal(isQuestionVersionConflict({ code: '40001' }), true)
  assert.equal(isQuestionVersionConflict({ message: 'QUESTION_VERSION_CONFLICT' }), true)
  assert.equal(isQuestionVersionConflict({ message: 'network error' }), false)
})

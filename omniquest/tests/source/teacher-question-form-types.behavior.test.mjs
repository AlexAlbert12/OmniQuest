import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { teacherQuestionSchema } from '../../lib/questionFormSchema.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const base = {
  selectedType: 'multiple',
  questionText: '¿Cuál es la respuesta?',
  timeLimit: '30',
  points: '10',
  mediaType: null,
  mediaAltText: '',
  mediaTranscript: '',
  mediaSubtitlesVtt: '',
  visibleAnswers: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }],
  openExpectedAnswer: '',
  fillAnswersText: '',
  orderItemsText: '',
  matchPairsText: '',
  dragdropPairsText: '',
}

const validCases = [
  { selectedType: 'multiple' },
  { selectedType: 'boolean', visibleAnswers: [{ text: 'Verdadero', isCorrect: true }, { text: 'Falso', isCorrect: false }] },
  { selectedType: 'open', openExpectedAnswer: 'Respuesta esperada' },
  { selectedType: 'fill', questionText: 'La capital es ____', fillAnswersText: 'Madrid' },
  { selectedType: 'order', orderItemsText: 'Primero\nSegundo' },
  { selectedType: 'match', matchPairsText: 'España | Madrid' },
  { selectedType: 'dragdrop', dragdropPairsText: '8 - 3 | 5' },
]

for (const validCase of validCases) {
  test(`question schema accepts ${validCase.selectedType}`, () => {
    const result = teacherQuestionSchema.safeParse({ ...base, ...validCase })
    assert.equal(result.success, true)
  })
}

test('question schema rejects invalid structures for every interactive family', () => {
  for (const invalid of [
    { selectedType: 'multiple', visibleAnswers: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] },
    { selectedType: 'open', openExpectedAnswer: '' },
    { selectedType: 'fill', questionText: 'Sin marcador', fillAnswersText: '' },
    { selectedType: 'order', orderItemsText: 'Solo uno' },
    { selectedType: 'match', matchPairsText: 'Incompleta' },
    { selectedType: 'dragdrop', dragdropPairsText: 'Incompleta' },
  ]) {
    const result = teacherQuestionSchema.safeParse({ ...base, ...invalid })
    assert.equal(result.success, false, `Expected ${invalid.selectedType} to fail`)
  }
})

test('question authoring uses autosave, cancellable media and the real game renderer', () => {
  const hook = read('components/teacher/question-form/useTeacherQuestionForm.ts')
  const media = read('lib/questionMedia.ts')
  const preview = read('components/teacher/question-form/QuestionPreview.tsx')
  const prompt = read('components/teacher/question-form/QuestionPromptEditor.tsx')
  const fillBlank = read('components/teacher/question-form/FillBlankEditor.tsx')
  const ordering = read('components/teacher/question-form/OrderingEditor.tsx')
  const matching = read('components/teacher/question-form/MatchingPairsEditor.tsx')

  assert.match(hook, /saveTeacherQuestionDraft/)
  assert.match(hook, /readTeacherQuestionDraft/)
  assert.match(hook, /beforeRemove/)
  assert.match(hook, /beforeunload/)
  assert.match(hook, /AbortController/)
  assert.match(media, /onProgress/)
  assert.match(media, /signal\?\.aborted/)
  assert.match(preview, /GameQuestionRenderer/)
  assert.match(prompt, /Convertir selección en hueco/)
  assert.match(prompt, /reconcileFillBlankAnswers/)
  assert.match(fillBlank, /Vista del enunciado/)
  assert.match(fillBlank, /Respuesta del hueco/)
  assert.doesNotMatch(fillBlank, /Una solución por línea/)
  assert.match(ordering, /Mover elemento/)
  assert.match(matching, /accessibilityHint/)
})

test('question authoring uses neutral prompts and one canonical destination-assignment type', () => {
  const prompt = read('components/teacher/question-form/QuestionPromptEditor.tsx')
  const matching = read('components/teacher/question-form/MatchingPairsEditor.tsx')
  const types = read('components/teacher/question-form/types.ts')
  const utilities = read('components/teacher/question-form/utils.ts')
  const hook = read('components/teacher/question-form/useTeacherQuestionForm.ts')

  assert.match(prompt, /Escribe aquí el enunciado de la pregunta\./)
  assert.doesNotMatch(prompt, /capital de Francia/)
  assert.match(matching, /placeholder=\{isMatch \? 'Escribe el concepto' : 'Escribe el elemento'\}/)
  assert.match(matching, /placeholder=\{isMatch \? 'Escribe la pareja' : 'Escribe el destino'\}/)
  assert.doesNotMatch(matching, /placeholder=\{isMatch \? 'España' : '8 - 3'\}/)
  assert.doesNotMatch(types, /\{ id: 'match', title: 'Unir parejas'/)
  assert.match(utilities, /normalized === 'match_pairs'\) return 'dragdrop'/)
  assert.match(hook, /state\.selectedType === 'match' \? 'dragdrop'/)
})

test('teacher student history renders the stored profile photo before initials', () => {
  const history = read('app/(teacher)/student/[id]/history.tsx')

  assert.match(history, /summary\.profile\.avatar\?\.startsWith\('http'\)/)
  assert.match(history, /source=\{\{ uri: summary\.profile\.avatar \}\}/)
  assert.match(history, /accessibilityLabel=.*Foto de/)
})

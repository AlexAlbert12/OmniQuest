import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('question form is split into focused editors and a five-step wizard', () => {
  const files = [
    'QuestionTypeSelector.tsx',
    'MultipleChoiceEditor.tsx',
    'TrueFalseEditor.tsx',
    'OpenAnswerEditor.tsx',
    'FillBlankEditor.tsx',
    'OrderingEditor.tsx',
    'MatchingPairsEditor.tsx',
    'QuestionPreview.tsx',
    'QuestionValidationPanel.tsx',
    'QuestionSettingsPanel.tsx',
    'useTeacherQuestionForm.ts',
  ]
  for (const file of files) {
    assert.equal(existsSync(join(root, 'components/teacher/question-form', file)), true, `${file} should exist`)
  }

  const types = read('components/teacher/question-form/types.ts')
  const form = read('components/teacher/TeacherQuestionForm.tsx')
  assert.match(types, /type QuestionWizardStep = 1 \| 2 \| 3 \| 4 \| 5/)
  assert.match(types, /label: 'Vista previa'/)
  assert.match(form, /activeStep === 5/)
})

test('teacher students prioritize attention and inactivity before an expandable desktop table', () => {
  const screen = read('app/(teacher)/students.tsx')
  const desktop = read('components/teacher/students/TeacherStudentsDesktop.tsx')
  assert.match(screen, /TeacherStudentPrioritySections/)
  assert.match(screen, /TeacherStudentsDesktopTable/)
  assert.match(desktop, /Necesitan atención/)
  assert.match(desktop, /Sin actividad/)
  assert.match(desktop, /accessibilityState=\{\{ expanded \}\}/)
  assert.match(desktop, /Ver detalle/)
})

test('student history leads with recommendation and moves analytics into lazy tabs', () => {
  const history = read('app/(teacher)/student/[id]/history.tsx')
  const hook = read('hooks/teacher/useTeacherStudentHistory.ts')
  const summary = read('components/teacher/student-history/StudentHistorySummary.tsx')
  assert.match(history, /StudentHistorySummary/)
  assert.match(summary, /Acción recomendada/)
  assert.match(history, /StudentHistoryTimeline/)
  assert.match(history, /StudentHistoryWeaknesses/)
  assert.match(history, /StudentHistoryReviews/)
  assert.match(history, /history\.activeTab === 'metrics'/)
  assert.match(hook, /loadedTabsRef/)
})

test('question report exposes immediate diagnosis and the requested teacher actions', () => {
  const report = read('app/(teacher)/question-report/[id].tsx')
  assert.match(report, /QuestionInsightHero/)
  assert.match(report, /Tasa de fallo/)
  assert.match(report, /Alumnos afectados/)
  assert.match(report, /Editar pregunta/)
  assert.match(report, /Duplicar/)
  assert.match(report, /Archivar/)
  assert.match(report, /Revisar manualmente/)
  assert.match(report, /Distribución de respuestas/)
})

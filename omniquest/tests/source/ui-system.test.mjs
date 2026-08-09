import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('the global palette exposes role, semantic and gamification tokens', () => {
  const tokens = read('lib/designTokens.ts')
  const theme = read('lib/appTheme.tsx')

  for (const path of [
    'background', 'surface', 'border', 'text', 'brand', 'semantic', 'gamification',
  ]) assert.match(tokens, new RegExp(`${path}:`))

  assert.match(tokens, /student: '#09acf4'/)
  assert.match(tokens, /teacher: '#09acf4'/)
  assert.match(tokens, /admin: '#A78BFA'/)
  assert.match(tokens, /semanticIcons/)
  assert.match(theme, /tokens: DesignColorTokens/)
  assert.match(theme, /createDesignColorTokens/)
})

test('buttons and tabs use shared accessible components', () => {
  const button = read('components/ui/AppButton.tsx')
  const tabs = read('components/ui/AppTabs.tsx')
  const subject = read('app/(teacher)/subject/[id].tsx')
  const questions = read('components/teacher/subject/SubjectQuestionsTab.tsx')

  assert.match(button, /primary.*secondary.*ghost.*danger.*success/s)
  assert.match(button, /accessibilityState/)
  assert.match(button, /loading/)
  assert.match(button, /tokens\.text\.onAccent/)
  assert.doesNotMatch(button, /tokens\.text\.inverse/)
  assert.match(tabs, /horizontal/)
  assert.match(tabs, /accessibilityRole="tab"/)
  assert.match(subject, /<AppTabs/)
  assert.match(questions, /<AppTabs/)
})

test('teacher desktop toolbars render horizontally instead of vertical ScrollViews', () => {
  const students = read('features/teacher-students/screen.tsx')
  const subject = read('app/(teacher)/subject/[id].tsx')

  assert.match(students, /flexDirection: 'row', flexWrap: 'wrap'/)
  assert.match(students, /Filtrar estudiantes por estado/)
  assert.match(subject, /accessibilityLabel="Secciones del curso"/)
  assert.doesNotMatch(subject, /horizontal=\{!isWide\}[\s\S]{0,300}teacherSubjectTabItems/)
})

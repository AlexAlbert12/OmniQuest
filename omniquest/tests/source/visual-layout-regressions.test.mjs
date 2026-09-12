import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('question preview and validation keep independent intrinsic heights on mobile', () => {
  const form = read('components/teacher/TeacherQuestionForm.tsx')

  assert.match(form, /isDesktop \? 'min-w-0 flex-\[1\.55\]' : 'min-w-0'/)
  assert.match(form, /isDesktop \? 'min-w-0 flex-1' : 'min-w-0'/)
})

test('topic creation aligns its action with the bottom of the deadline field', () => {
  const structure = read('components/teacher/subject/SubjectCourseStructure.tsx')

  assert.match(structure, /label="Crear tema"[\s\S]*style=\{\{ alignSelf: 'flex-end' \}\}/)
})

test('student detail metrics use a readable modal-width grid', () => {
  const modals = read('components/teacher/students/StudentModals.tsx')

  assert.match(modals, /min-w-\[150px\][^"\n]*flex-1/)
  assert.match(modals, /flexBasis: 150/)
  assert.doesNotMatch(modals, /min-w-\[100px\] flex-1 rounded-xl/)
})

test('student table keeps horizontal space between progress and XP columns', () => {
  const students = read('components/teacher/subject/SubjectStudentsTab.tsx')

  assert.match(students, /min-w-\[130px\][^"\n]*flex-\[1\][^"\n]*pr-4/)
})

test('game review uses the default structural border', () => {
  const review = read('app/(student)/review/[attemptId].tsx')

  assert.equal((review.match(/borderColor: tokens\.border\.default/g) || []).length >= 4, true)
  assert.doesNotMatch(review, /borderColor: withAlpha\(tokens\.brand\.student, '80'\)/)
})

test('privacy help icons use the primary white foreground', () => {
  const settings = read('components/settings/SettingsSections.tsx')

  assert.match(settings, /name="shield-checkmark-outline" size=\{22\} color=\{colors\.text\}/)
  assert.match(settings, /name="open-outline" size=\{13\} color=\{colors\.text\}/)
})

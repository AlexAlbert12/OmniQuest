import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('topic detail uses paginated RPCs and explicit lifecycle actions', () => {
  const screen = read('app/(teacher)/topic/[id].tsx')
  const hook = read('hooks/teacher/useTeacherTopicDetail.ts')
  assert.match(hook, /get_teacher_topic_questions_page/)
  assert.match(hook, /get_teacher_topic_summary/)
  assert.match(screen, /Editar tema/)
  assert.match(screen, /Fecha límite/)
  assert.match(screen, /Añadir pregunta/)
  assert.match(screen, /Archivar tema/)
  assert.match(screen, /Visibilidad/)
  assert.match(screen, /Disponibilidad/)
  assert.doesNotMatch(screen, /\.from\(/)
})

test('teacher students page delegates filters and pagination to one RPC', () => {
  const route = read('app/(teacher)/students.tsx')
  const screen = read('features/teacher-students/screen.tsx')
  const hook = read('features/teacher-students/api.ts')
  const migration = read('supabase/migrations/20260730150000_teacher_topic_questions_students_history.sql')
  assert.match(route, /features\/teacher-students\/screen/)
  assert.match(hook, /get_teacher_students_page/)
  assert.match(hook, /p_limit/)
  assert.match(hook, /p_offset/)
  assert.doesNotMatch(screen, /\.from\(['"](?:enrollments|subject_scores|attempt_history|questions)/)
  assert.match(migration, /'accuracyPercent'/)
  assert.match(migration, /'participation'/)
  assert.match(migration, /'lastActivityAt'/)
  assert.match(migration, /'questions'/)
  assert.match(migration, /'subjectScore'/)
})

test('student history has server summary, lazy tabs, paged timeline and teacher notes', () => {
  const screen = read('app/(teacher)/student/[id]/history.tsx')
  const hook = read('hooks/teacher/useTeacherStudentHistory.ts')
  const migration = read('supabase/migrations/20260730150000_teacher_topic_questions_students_history.sql')
  assert.match(hook, /loadedTabsRef/)
  assert.match(hook, /get_teacher_student_history_timeline_page/)
  assert.match(hook, /get_teacher_student_history_summary/)
  assert.match(hook, /add_teacher_student_note/)
  assert.match(screen, /StudentHistorySummary/)
  assert.match(screen, /StudentHistoryTimeline/)
  assert.match(screen, /StudentHistoryMetrics/)
  assert.doesNotMatch(screen, /\.from\(/)
  assert.match(migration, /teacher_student_notes/)
  assert.match(migration, /'recommendation'/)
  assert.match(migration, /'comparison'/)
})

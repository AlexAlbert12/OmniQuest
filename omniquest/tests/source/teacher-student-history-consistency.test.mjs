import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const migration = read('supabase/migrations/20260811095500_teacher_student_history_semantics.sql')
const historyHook = read('hooks/teacher/useTeacherStudentHistory.ts')
const historyScreen = read('app/(teacher)/student/[id]/history.tsx')
const timeline = read('components/teacher/student-history/StudentHistoryTimeline.tsx')
const reviews = read('components/teacher/student-history/StudentHistoryReviews.tsx')
const manualReviewHook = read('hooks/teacher/useManualReview.ts')

test('pending manual reviews do not reduce history accuracy or reinforcement diagnostics', () => {
  assert.match(migration, /manual_review_status not in \('pending', 'in_review'\)/)
  assert.match(migration, /'evaluatedAttempts'/)
  assert.match(migration, /'pendingEvaluation'/)
  assert.match(migration, /least\(100, round\(100\.0 \* m\.answered_questions \/ m\.available_questions\)/)
  assert.match(migration, /get_teacher_student_history_weaknesses[\s\S]*manual_review_status, 'not_required'\) not in \('pending', 'in_review'\)/)
})

test('history timeline distinguishes correct, incorrect, pending, needs-changes and skipped attempts', () => {
  assert.match(timeline, /item\.was_skipped/)
  assert.match(timeline, /status === 'pending' \|\| status === 'in_review'/)
  assert.match(timeline, /status === 'needs_changes'/)
  assert.match(timeline, /label: 'Correcta'/)
  assert.match(timeline, /label: 'Incorrecta'/)
  assert.match(timeline, /Sin responder/)
})

test('history period only scopes analysis while activity and reviews remain complete', () => {
  assert.match(historyScreen, /Periodo de análisis/)
  assert.match(historyScreen, /Actividad y Revisiones muestran el historial completo/)
  assert.match(timeline, /Actividad histórica/)
  assert.match(reviews, /independientemente del periodo de análisis/)
})

test('reviews are paged and can open the exact manual-review attempt', () => {
  assert.match(historyHook, /reviewsPage/)
  assert.match(historyHook, /p_offset: requestedPage \* PAGE_SIZE/)
  assert.match(reviews, /PaginationControls/)
  assert.match(historyScreen, /attemptId: String\(item\.id\)/)
  assert.match(manualReviewHook, /p_student_id: context\?\.studentId/)
  assert.match(manualReviewHook, /p_attempt_id: context\?\.attemptId/)
  assert.match(migration, /p_student_id uuid default null/)
  assert.match(migration, /p_attempt_id bigint default null/)
})

test('practice recommendations preserve the subject classroom and topic that produced the diagnosis', () => {
  assert.match(migration, /'subjectId', \(select subject_id from weak_topic\)/)
  assert.match(migration, /'classroomId', \(select classroom_id from weak_topic\)/)
  assert.match(migration, /'topicId', \(select topic_id from weak_topic\)/)
  assert.match(historyScreen, /recommendation\.subjectId/)
  assert.match(historyScreen, /recommendation\.classroomId/)
})

test('visible lazy history data is refreshed without eagerly loading every secondary tab', () => {
  assert.match(historyHook, /refreshVisible/)
  assert.match(historyHook, /loadTab\(activeTab, true\)/)
  assert.match(historyHook, /loadedTabsRef/)
  assert.match(historyHook, /activeTab === 'weaknesses' \|\| activeTab === 'metrics'/)
})

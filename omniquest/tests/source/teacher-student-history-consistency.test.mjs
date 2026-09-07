import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const migration = read('supabase/migrations/20260811095500_teacher_student_history_semantics.sql')
const reviewSimplification = read('supabase/migrations/20260811104500_manual_review_owner_only_simplification.sql')
const historyHook = read('hooks/teacher/useTeacherStudentHistory.ts')
const historyScreen = read('app/(teacher)/student/[id]/history.tsx')
const historySummary = read('components/teacher/student-history/StudentHistorySummary.tsx')
const timeline = read('components/teacher/student-history/StudentHistoryTimeline.tsx')
const weaknesses = read('components/teacher/student-history/StudentHistoryWeaknesses.tsx')
const reviews = read('components/teacher/student-history/StudentHistoryReviews.tsx')
const manualReviewHook = read('hooks/teacher/useManualReview.ts')
const appTabs = read('components/ui/AppTabs.tsx')

test('pending manual reviews do not reduce history accuracy or reinforcement diagnostics', () => {
  assert.match(reviewSimplification, /manual_review_status <> 'pending'/)
  assert.match(migration, /'evaluatedAttempts'/)
  assert.match(migration, /'pendingEvaluation'/)
  assert.match(migration, /least\(100, round\(100\.0 \* m\.answered_questions \/ m\.available_questions\)/)
  assert.match(reviewSimplification, /get_teacher_student_history_weaknesses[\s\S]*manual_review_status, 'not_required'\) <> 'pending'/)
})

test('history timeline distinguishes correct, incorrect, pending, needs-changes and skipped attempts', () => {
  assert.match(timeline, /item\.was_skipped/)
  assert.match(timeline, /status === 'pending'/)
  assert.doesNotMatch(timeline, /in_review/)
  assert.match(timeline, /status === 'needs_changes'/)
  assert.match(timeline, /label: 'Correcta'/)
  assert.match(timeline, /label: 'Incorrecta'/)
  assert.match(timeline, /Sin responder/)
})

test('history period only scopes analysis while activity and reviews remain complete', () => {
  assert.match(historyScreen, /Periodo de análisis/)
  assert.match(historyScreen, /Actividad y Revisiones muestran el historial completo/)
  assert.match(timeline, /Actividad histórica/)
  assert.doesNotMatch(reviews, /periodDays|periodo de análisis/)
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

test('student history keeps its mobile overview compact without diverging from desktop controls', () => {
  assert.match(historyScreen, /shrink-0 items-end/)
  assert.match(historyScreen, /min-w-0 flex-1/)
  assert.match(historySummary, /isDesktop \? 'flex-row flex-wrap gap-3' : 'flex-row gap-2'/)
  assert.equal((historySummary.match(/<Metric isDesktop=\{isDesktop\}/g) || []).length, 4)
  assert.doesNotMatch(historySummary, /aspectRatio: 1/)
  assert.match(historySummary, /size="sm"/)
  assert.match(historySummary, /isDesktop \? 'mt-4 flex-row flex-wrap gap-3' : 'mt-3 flex-row gap-2'/)
  assert.match(timeline, /isDesktop \? 'p-4' : 'p-3'/)
  assert.match(weaknesses, /const errorRate = 100 - accuracy/)
  assert.match(weaknesses, /Necesita refuerzo/)
  assert.match(appTabs, /const rail = !fill && mobileRail/)
  assert.doesNotMatch(appTabs, /responsive\.isMobile/)
})

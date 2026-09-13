import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('manual review attempts use an explicit unresolved evaluation state', () => {
  const helper = read('lib/studentAttemptEvaluation.ts')
  const game = read('hooks/useGame.ts')
  const result = read('components/student/game/GameResultState.tsx')

  assert.match(helper, /manualReviewStatus/)
  assert.match(helper, /status === 'needs_changes'/)
  assert.match(helper, /status === 'approved'/)
  assert.match(helper, /status === 'rejected'/)
  assert.match(helper, /return state === 'pending' \|\| state === 'needs_changes'/)
  assert.match(game, /pending: number/)
  assert.match(game, /pending: current\.pending \+ \(requiresManualReview \? 1 : 0\)/)
  assert.doesNotMatch(game, /requiresManualReview[\s\S]{0,180}incorrect: previous\.incorrect \+ 1/)
  assert.match(result, /evaluated = Math\.max\(0, summary\.correct \+ summary\.incorrect\)/)
  assert.match(result, /Precisión provisional/)
  assert.match(result, /Pendientes de revisión/)
})

test('student history, course attempts and progress do not present pending answers as failures', () => {
  const course = read('app/(student)/class/[id].tsx')
  const coursePanel = read('components/student/course/CourseProgressPanel.tsx')
  const activity = read('components/student/activity/StudentActivityAttemptRow.tsx')
  const filters = read('components/student/activity/StudentActivityFilters.tsx')
  const progress = read('hooks/student/useStudentProgress.ts')
  const exportModel = read('features/teacher-students/exportModel.ts')

  assert.match(course, /isStudentAttemptFailure/)
  assert.match(course, /getStudentAttemptEvaluationState/)
  assert.match(coursePanel, /Pendiente de revisión/)
  assert.match(coursePanel, /Necesita cambios/)
  assert.match(activity, /getStudentAttemptEvaluationState/)
  assert.match(activity, /Respuesta aprobada/)
  assert.match(activity, /Pendiente de revisión/)
  assert.match(activity, /Revisada el/)
  assert.match(filters, /id: 'pending'/)
  assert.match(progress, /getStudentAttemptEvaluationState/)
  assert.match(progress, /evaluationState === 'pending' \|\| evaluationState === 'needs_changes'/)
  assert.match(progress, /const correct = evaluationState === 'correct'/)
  assert.match(exportModel, /student\.evaluatedAttempts > 0/)
})

test('manual review notifications are accepted and exposed to the student', () => {
  const types = read('lib/notifications/types.ts')
  const persistent = read('lib/notifications/persistent.ts')
  const notifications = read('app/(student)/notifications.tsx')

  assert.match(types, /'manual_review'/)
  assert.match(persistent, /'manual_review'/)
  assert.match(persistent, /type === 'manual_review'/)
  assert.match(notifications, /key: 'manual_review'/)
  assert.match(notifications, /label: 'Revisiones'/)
})

test('student progress exposes recent game sessions and reuses the existing review route', () => {
  const api = read('features/student-progress/api.ts')
  const progressHook = read('hooks/student/useStudentProgress.ts')
  const progressScreen = read('app/(student)/progress.tsx')
  const recentGames = read('components/student/progress/RecentGames.tsx')
  const review = read('app/(student)/review/[attemptId].tsx')

  assert.match(api, /get_student_recent_game_attempts/)
  assert.match(progressHook, /from '\.\.\/\.\.\/features\/student-progress\/api'/)
  assert.match(progressHook, /fetchStudentRecentGames\(5\)\.catch/)
  assert.match(progressHook, /return \[\] as StudentRecentGame\[\]/)
  assert.match(progressScreen, /<RecentGames/)
  assert.match(progressScreen, /pathname: '\/\(student\)\/review\/\[attemptId\]'/)
  assert.match(recentGames, /Partidas recientes/)
  assert.match(recentGames, /pendingTotal/)
  assert.match(recentGames, /Ver partida/)
  assert.match(review, /review\.evaluated_total/)
  assert.match(review, /review\.pending_total/)
  assert.match(review, /Precisión provisional/)
})

test('database migration excludes unresolved reviews from failures and provides recent game aggregates', () => {
  const migration = read('supabase/migrations/20260912224500_open_answer_review_consistency_recent_games.sql')

  assert.match(migration, /create or replace function public\.get_student_recent_game_attempts/)
  assert.match(migration, /ga\.student_id = v_user_id/)
  assert.match(migration, /'pending', 'in_review', 'needs_changes'/)
  assert.match(migration, /'evaluatedAttempts'/)
  assert.match(migration, /'pendingReviewAttempts'/)
  assert.match(migration, /'evaluated_total'/)
  assert.match(migration, /'pending_total'/)
  assert.match(migration, /'pendingAttempts'/)
  assert.match(migration, /manual_review_status[^\n]*not in \('pending', 'in_review', 'needs_changes'\)/)
  assert.match(migration, /get_teacher_question_affected_students_page/)
  assert.match(migration, /get_teacher_students_page/)
  assert.match(migration, /get_teacher_subject_analytics/)
  assert.match(migration, /get_safe_game_questions/)
})

test('existing manual review backend remains delta-based and notification-driven', () => {
  const reviewMigration = read('supabase/migrations/20260720120000_learning_planning_manual_review_media.sql')
  const ownerMigration = read('supabase/migrations/20260811104500_manual_review_owner_only_simplification.sql')

  assert.match(reviewMigration, /v_delta_points := v_new_earned_points - coalesce\(v_attempt\.earned_points, 0\)/)
  assert.match(reviewMigration, /v_delta_correct := case when v_new_is_correct then 1 else 0 end/)
  assert.match(reviewMigration, /perform public\.recalculate_student_points\(v_attempt\.student_id\)/)
  assert.match(reviewMigration, /'manual_review'/)
  assert.match(reviewMigration, /manual-review-status:/)
  assert.match(ownerMigration, /if v_previous_status is distinct from p_status then/)
  assert.match(ownerMigration, /review_open_answer_attempt_v2/)
})

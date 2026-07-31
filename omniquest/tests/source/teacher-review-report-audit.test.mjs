import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDir, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const migration = read('supabase/migrations/20260730190000_teacher_review_reports_audit.sql')

test('manual review exposes SLA, rubrics, batch operations, assignment and immutable history', () => {
  for (const contract of [
    'manual_review_due_at',
    'manual_review_rubrics',
    'manual_review_comment_templates',
    'manual_review_saved_filters',
    'assign_manual_review_attempts',
    'batch_review_manual_attempts',
    'manual_review_history',
    'prevent_manual_review_history_mutation',
  ]) assert.match(migration, new RegExp(contract))

  assert.match(migration, /v_previous_status is distinct from p_status/)
  assert.match(migration, /manual_review_assigned_to = v_teacher_id/)
  assert.match(read('app/(teacher)/reviews.tsx'), /ManualReviewBatchBar/)
  assert.match(read('hooks/teacher/useManualReview.ts'), /get_teacher_manual_review_queue/)
})

test('question report is split and includes diagnostic server aggregates', () => {
  const screen = read('app/(teacher)/question-report/[id].tsx')
  for (const moduleName of [
    'useQuestionReport',
    'QuestionDiagnosisCard',
    'AnswerDistributionChart',
    'AffectedStudentsList',
    'QuestionReportActions',
  ]) assert.match(screen, new RegExp(moduleName))

  for (const metric of [
    'sampleSize',
    'lowSample',
    'abandonmentPercent',
    'averageTimeSeconds',
    'discrimination',
    'classComparison',
    'temporalTrend',
  ]) assert.match(migration, new RegExp(metric, 'i'))
})

test('teacher audit is immutable, sanitized, retained, filtered and exported asynchronously', () => {
  for (const contract of [
    'before_state',
    'after_state',
    'prevent_teacher_audit_mutation',
    'sanitize_teacher_audit_payload',
    'apply_teacher_audit_retention',
    'detect_teacher_audit_anomalies',
    'teacher_audit_saved_filters',
    'teacher_audit_export_requests',
    'request_teacher_audit_export',
  ]) assert.match(migration, new RegExp(contract))

  assert.match(migration, /submitted_answer_text/)
  assert.match(migration, /password_hash/)
  assert.match(read('supabase/functions/process-teacher-audit-exports/index.ts'), /TEACHER_AUDIT_EXPORT_SECRET/)
  assert.match(read('app/(teacher)/audit.tsx'), /TeacherAuditTimeline/)
  assert.match(read('app/(teacher)/audit.tsx'), /TeacherAuditExports/)
})

test('the TypeScript regressions reported after the previous teacher refactor stay fixed', () => {
  const banner = read('components/ui/AppStatusBanner.tsx')
  const settings = read('components/settings/SettingsSections.tsx')
  const ordering = read('components/teacher/question-form/OrderingEditor.tsx')
  const timeline = read('components/teacher/student-history/StudentHistoryTimeline.tsx')

  assert.match(banner, /style\?: StyleProp<ViewStyle>/)
  assert.match(settings, /SettingsAboutPanel[\s\S]*const \{ colors \} = useAppTheme\(\)/)
  assert.doesNotMatch(ordering, /accessibilityRole="listitem"/)
  assert.doesNotMatch(timeline, /accessibilityRole="listitem"/)
})

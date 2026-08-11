import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDir, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const migration = read('supabase/migrations/20260730190000_teacher_review_reports_audit.sql')
const reviewSimplification = read('supabase/migrations/20260811104500_manual_review_owner_only_simplification.sql')
const auditSimplification = read('supabase/migrations/20260811130000_teacher_audit_teacher_facing_simplification.sql')

test('manual review exposes owner-only access, SLA, reusable comments, batch decisions and immutable history', () => {
  for (const contract of [
    'manual_review_due_at',
    'manual_review_comment_templates',
    'batch_review_manual_attempts',
    'manual_review_history',
    'prevent_manual_review_history_mutation',
  ]) assert.match(migration + reviewSimplification, new RegExp(contract))

  assert.match(reviewSimplification, /manual_review_status = 'pending'/)
  assert.match(reviewSimplification, /s\.teacher_id = v_user_id/)
  assert.match(reviewSimplification, /A student-visible comment is required for this decision/)
  assert.match(reviewSimplification, /drop function if exists public\.assign_manual_review_attempts/)
  assert.match(reviewSimplification, /drop function if exists public\.save_manual_review_rubric/)
  assert.match(reviewSimplification, /drop function if exists public\.save_manual_review_filter/)
  assert.match(reviewSimplification, /drop table if exists public\.manual_review_rubrics/)
  assert.match(reviewSimplification, /drop table if exists public\.manual_review_saved_filters/)
  assert.match(reviewSimplification, /with scope as[\s\S]*filtered as/)
  assert.match(read('app/(teacher)/reviews.tsx'), /ManualReviewBatchBar/)
  assert.doesNotMatch(read('app/(teacher)/reviews.tsx'), /Guardar filtro|assignee|rúbrica/i)
  assert.doesNotMatch(read('hooks/teacher/useManualReview.ts'), /assign_manual_review|save_manual_review_filter|save_manual_review_rubric/)
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

test('teacher audit exposes owner-only activity history, minimized payloads and understandable asynchronous exports', () => {
  for (const contract of [
    'before_state',
    'after_state',
    'prevent_teacher_audit_mutation',
    'sanitize_teacher_audit_payload',
    'apply_teacher_audit_retention',
    'detect_teacher_audit_anomalies',
    'teacher_audit_export_requests',
    'request_teacher_audit_export',
  ]) assert.match(migration + auditSimplification, new RegExp(contract))

  assert.match(auditSimplification, /drop function if exists public\.save_teacher_audit_filter/)
  assert.match(auditSimplification, /drop table if exists public\.teacher_audit_saved_filters/)
  assert.match(auditSimplification, /role_id = 'teacher'.*coalesce\(p\.active, true\)/)
  assert.match(auditSimplification, /new\.metadata -> 'previous'/)
  assert.match(auditSimplification, /'description'.*'note'.*'comments'/s)
  assert.match(read('supabase/functions/_shared/teacher.ts'), /beforeState\?: Record<string, unknown>/)
  assert.match(read('supabase/functions/teacher-update-topic/index.ts'), /beforeState: safeTopicAuditState\(previous\)/)
  assert.match(read('supabase/functions/teacher-update-subject/index.ts'), /afterState: safeSubjectAuditState\(data\)/)

  const auditUi = read('app/(teacher)/audit.tsx') + read('components/teacher/audit/TeacherAuditFilters.tsx') + read('components/teacher/audit/TeacherAuditTimeline.tsx') + read('hooks/teacher/useTeacherAudit.ts')
  assert.doesNotMatch(auditUi, /Guardar filtro|save_teacher_audit_filter|label="Entidad"|label="Actualizar"/)
  assert.match(auditUi, /Todas las acciones/)
  assert.match(auditUi, /Historial de actividad/)
  assert.match(auditUi, /EXPORT_POLL_MS = 45_000/)
  assert.match(read('lib/teacherAuditPresentation.ts'), /'teacher\.topic\.update': 'Tema actualizado'/)

  const exportWorker = read('supabase/functions/process-teacher-audit-exports/index.ts')
  assert.match(exportWorker, /TEACHER_AUDIT_EXPORT_SECRET/)
  assert.match(exportWorker, /'Fecha'.*'Severidad'.*'Acción'.*'Elemento'.*'Identificador'.*'Antes'.*'Después'/s)
  assert.match(exportWorker, /'Código de acción'.*'Código de entidad'/s)
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

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const migration = read('supabase/migrations/20260727120000_analytics_private_question_media.sql')

test('analytics is consent-aware, indexed, retained and aggregate-only for admins', () => {
  const analytics = read('lib/analytics.ts')
  const layout = read('app/_layout.tsx')
  const settings = read('components/settings/SettingsSections.tsx')
  const admin = read('components/admin/dashboard/AdminUsageAnalyticsPanel.tsx')

  assert.match(migration, /analytics_enabled boolean not null default false/)
  assert.match(migration, /analytics_events_occurred_at_brin_idx/)
  assert.match(migration, /apply_analytics_retention/)
  assert.match(migration, /analytics_reporting_identities/)
  assert.match(migration, /revoke select on table public\.analytics_events from authenticated/)
  assert.match(migration, /'funnel'/)
  assert.match(migration, /'retention'/)
  assert.match(migration, /'rpc_latency_ms'/)
  assert.match(analytics, /trackScreenView/)
  assert.match(analytics, /measureRpc/)
  assert.match(layout, /trackScreenView/)
  assert.match(settings, /Analítica de producto/)
  assert.match(admin, /Embudo de aprendizaje/)
})

test('server events cover joins and question type usage while forms report abandonment', () => {
  const game = read('hooks/useGame.ts')
  const formAnalytics = read('hooks/useFormAnalytics.ts')
  const questionForm = read('components/teacher/question-form/useTeacherQuestionForm.ts')

  assert.match(migration, /log_course_join_analytics/)
  assert.match(migration, /'course_joined'/)
  assert.match(migration, /log_question_type_analytics/)
  assert.match(migration, /'question_answered'/)
  assert.match(game, /trackUsageEvent\('question_viewed'/)
  assert.match(formAnalytics, /'form_abandoned'/)
  assert.match(questionForm, /useFormAnalytics\('teacher_question'/)
})

test('question media is private, signed, scanned, accessible and cleaned', () => {
  const media = read('lib/questionMedia.ts')
  const view = read('components/questions/QuestionMedia.tsx')
  const editor = read('components/teacher/TeacherQuestionMediaEditor.tsx')
  const processor = read('supabase/functions/process-question-media/index.ts')
  const cleanup = read('supabase/functions/cleanup-question-media/index.ts')

  assert.match(migration, /public = false/)
  assert.match(migration, /question_media_select_authorized/)
  assert.match(migration, /get_question_media_manifest/)
  assert.match(migration, /question_media_assets/)
  assert.match(media, /createSignedUrl/)
  assert.match(media, /QUESTION_MEDIA_SIGNED_URL_TTL_SECONDS = 15 \* 60/)
  assert.match(media, /validateQuestionMediaBytes/)
  assert.match(media, /QUESTION_MEDIA_MAX_VIDEO_SECONDS/)
  assert.match(view, /parseWebVtt/)
  assert.match(view, /generateThumbnailsAsync/)
  assert.match(editor, /Transcripción obligatoria/)
  assert.match(editor, /Subtítulos WebVTT obligatorios/)
  assert.match(processor, /EICAR-STANDARD-ANTIVIRUS-TEST-FILE/)
  assert.match(cleanup, /findUntrackedFiles/)
  assert.equal(existsSync(join(root, 'supabase/functions/process-question-media/index.ts')), true)
  assert.equal(existsSync(join(root, 'supabase/functions/cleanup-question-media/index.ts')), true)
})

test('edge errors are persisted as sanitized operational analytics', () => {
  const errors = read('supabase/functions/_shared/errors.ts')
  assert.match(errors, /scheduleOperationalErrorWrite/)
  assert.match(errors, /event_name: 'edge_function_error'/)
  assert.match(errors, /purpose: 'operational'/)
  assert.match(errors, /slice\(0, 240\)/)
})

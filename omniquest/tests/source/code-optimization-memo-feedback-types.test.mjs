import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('high-frequency rows and cards use selective memoization', () => {
  for (const file of [
    'components/student/ranking/RankingMobileList.tsx',
    'components/student/ranking/RankingTable.tsx',
    'components/teacher/students/TeacherStudentList.tsx',
    'components/notifications/NotificationListItem.tsx',
    'components/notifications/NotificationFeed.tsx',
    'components/admin/audit/AdminAuditComponents.tsx',
    'components/admin/audit/AdminAuditTable.tsx',
    'components/teacher/subject/SubjectQuestionsTab.tsx',
    'components/student/home/StudentHomeAchievements.tsx',
    'components/student/profile/StudentProfileAchievements.tsx',
    'components/student/course/TopicPlanet.tsx',
    'app/(student)/badges.tsx',
  ]) assert.match(read(file), /React\.memo/, `${file} should memoize its repeated visual units`)
})

test('virtualized handlers are stable in ranking, notifications and questions', () => {
  for (const file of [
    'components/student/ranking/RankingMobileList.tsx',
    'components/student/ranking/RankingTable.tsx',
    'components/notifications/NotificationFeed.tsx',
    'components/teacher/subject/SubjectQuestionsTab.tsx',
  ]) assert.match(read(file), /useCallback/, `${file} should stabilize handlers passed to a list`)
})

test('application feedback is exposed through one typed hook', () => {
  const feedback = read('hooks/useAppFeedback.ts')
  assert.match(feedback, /success:/)
  assert.match(feedback, /error:/)
  assert.match(feedback, /warning:/)
  assert.match(feedback, /confirm:/)

  for (const file of [
    'components/admin/hooks/useAdminActions.ts',
    'components/admin/hooks/useAdminData.ts',
    'components/admin/hooks/useAdminExportJobs.ts',
    'components/admin/audit/AdminAuditSection.tsx',
    'components/admin/support/AdminSupportSection.tsx',
    'features/teacher-students/useTeacherStudentsController.ts',
  ]) assert.match(read(file), /useAppFeedback/, `${file} should use the shared feedback service`)
})

test('json rpc payloads are narrowed and new rpc contracts are typed', () => {
  for (const file of [
    'hooks/teacher/useTeacherCommunicationSettings.ts',
    'hooks/teacher/useTeacherNotifications.ts',
    'lib/support.ts',
  ]) {
    const source = read(file)
    assert.match(source, /isRecord/)
    assert.doesNotMatch(source, /Record<string, any>/)
  }

  const types = read('types/database.types.ts')
  assert.match(types, /get_admin_audit_policy:/)
  assert.match(types, /get_admin_support_directory:/)
  assert.match(types, /verify_admin_audit_chain:/)
  assert.match(types, /p_internal_comment\?: string/)
  assert.match(types, /search_app_entities:[\s\S]*p_offset\?: number/)
})

test('the removed mobile tab is no longer imported by admin metrics', () => {
  assert.doesNotMatch(read('components/admin/dashboard/AdminMetrics.tsx'), /AdminMobileSectionTabs/)
})

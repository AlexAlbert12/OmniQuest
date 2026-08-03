import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDir, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const migrationPath = 'supabase/migrations/20260729223000_teacher_server_aggregates_lazy_tabs.sql'

test('teacher home consumes server aggregates instead of rebuilding the dashboard in JavaScript', () => {
  const route = read('app/(teacher)/homeTeacher.tsx')
  const home = read('features/teacher-dashboard/screen.tsx')
  const hook = read('features/teacher-dashboard/api.ts')
  const migration = read(migrationPath)

  assert.match(route, /features\/teacher-dashboard\/screen/)
  assert.match(home, /useTeacherDashboard\(\)/)
  assert.doesNotMatch(home, /\.from\(/)
  assert.match(hook, /get_teacher_dashboard_summary/)
  assert.match(hook, /get_teacher_attention_students_page/)
  assert.match(hook, /get_teacher_recent_activity_page/)

  for (const rpc of [
    'get_teacher_dashboard_summary',
    'get_teacher_attention_students_page',
    'get_teacher_recent_activity_page',
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`))
  }
})

test('teacher courses and classrooms use independent paged server hooks', () => {
  const route = read('app/(teacher)/classes.tsx')
  const screen = read('features/teacher-catalog/screen.tsx')
  const coursesHook = read('features/teacher-catalog/api.ts')
  const classroomsHook = coursesHook
  const migration = read(migrationPath)

  assert.match(route, /features\/teacher-catalog\/screen/)
  assert.match(screen, /useTeacherCatalog/)
  assert.match(screen, /FlatList/)
  assert.match(screen, /PaginationControls/)
  assert.doesNotMatch(screen, /\.from\(/)
  assert.match(coursesHook, /p_limit: pageSize/)
  assert.match(coursesHook, /p_offset: page \* pageSize/)
  assert.match(classroomsHook, /get_teacher_classrooms_page/)
  assert.match(migration, /create or replace function public\.get_teacher_courses_page/)
  assert.match(migration, /create or replace function public\.get_teacher_classrooms_page/)
})

test('course detail loads each tab through an independent server resource', () => {
  const page = read('app/(teacher)/subject/[id].tsx')
  const detailRouteHook = read('hooks/teacher/useTeacherSubjectDetail.ts')
  const detailHook = read('features/teacher-subject/useTeacherSubjectDetail.ts')
  const migration = read(migrationPath)

  for (const component of [
    'SubjectSummaryTab',
    'SubjectTopicsSection',
    'SubjectQuestionsTab',
    'SubjectStudentsTab',
    'SubjectAnalyticsTab',
  ]) {
    assert.match(page, new RegExp(component))
  }

  assert.match(detailRouteHook, /features\/teacher-subject/)
  for (const hook of [
    'useTeacherSubjectOverview',
    'useTeacherSubjectTopics',
    'useTeacherSubjectQuestions',
    'useTeacherSubjectStudents',
    'useTeacherSubjectAnalytics',
  ]) {
    assert.match(detailHook, new RegExp(hook))
  }

  assert.match(detailHook, /enabled: activeTab === 'topics' \|\| activeTab === 'questions'/)
  assert.match(detailHook, /enabled: activeTab === 'questions'/)
  assert.match(detailHook, /enabled: activeTab === 'students'/)
  assert.match(detailHook, /enabled: activeTab === 'analytics'/)
  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(detailHook, /select\(['"]\*|answers\(\*\)/)

  for (const rpc of [
    'get_teacher_subject_overview',
    'get_teacher_subject_topics_page',
    'get_teacher_subject_questions_page',
    'get_teacher_subject_students_page',
    'get_teacher_subject_analytics',
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`))
  }
  assert.match(migration, /else to_jsonb\(id\) end/)
})

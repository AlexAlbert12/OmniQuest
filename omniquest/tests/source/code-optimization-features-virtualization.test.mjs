import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))

test('large teacher and student routes delegate to feature modules without direct Supabase access', () => {
  const routes = [
    ['app/(student)/homeStudent.tsx', 'features/student-home/screen'],
    ['app/(teacher)/homeTeacher.tsx', 'features/teacher-dashboard/screen'],
    ['app/(teacher)/classes.tsx', 'features/teacher-catalog/screen'],
    ['app/(teacher)/students.tsx', 'features/teacher-students/screen'],
  ]

  for (const [routePath, featurePath] of routes) {
    const route = read(routePath)
    assert.match(route, new RegExp(featurePath.replaceAll('/', '\\/')))
    assert.doesNotMatch(route, /supabase|\.from\(|\.rpc\(|functions\.invoke/)
  }

  for (const directory of ['student-home', 'student-progress', 'teacher-dashboard', 'teacher-catalog', 'teacher-students', 'teacher-subject']) {
    assert.equal(exists(`features/${directory}/api.ts`), true, `${directory} should own its data access`)
  }

  for (const screen of [
    'features/student-home/screen.tsx',
    'features/teacher-dashboard/screen.tsx',
    'features/teacher-catalog/screen.tsx',
    'features/teacher-students/screen.tsx',
  ]) assert.doesNotMatch(read(screen), /from ['"].*lib\/supabase|supabase\./)
})

test('student home and progress use aggregate RPCs instead of transferring attempt history rows', () => {
  const migration = read('supabase/migrations/20260803103500_code_optimization_aggregates.sql')
  const homeApi = read('features/student-home/api.ts')
  const progressApi = read('features/student-progress/api.ts')
  const legacyProgressFacade = read('lib/studentProgress.ts')

  assert.match(migration, /create or replace function public\.get_student_progress_summary\(\)/)
  assert.match(migration, /create or replace function public\.get_student_home_dashboard\(\)/)
  assert.match(migration, /attempt_history_student_attempted_at_desc_idx/)
  assert.match(homeApi, /get_student_home_dashboard/)
  assert.match(progressApi, /get_student_progress_summary/)
  assert.doesNotMatch(homeApi + progressApi + legacyProgressFacade, /\.from\(['"]attempt_history|limit:\s*5000|fetchStudentAttemptHistory/)
})

test('teacher subject students are server-paginated and reset paging when filters change', () => {
  const hook = read('hooks/teacher/subject/useTeacherSubjectStudents.ts')
  const tab = read('components/teacher/subject/SubjectStudentsTab.tsx')

  assert.match(hook, /const PAGE_SIZE = 25/)
  assert.match(hook, /p_limit: PAGE_SIZE/)
  assert.match(hook, /p_offset: page \* PAGE_SIZE/)
  assert.match(hook, /setPage\(0\)/)
  assert.match(tab, /<PaginationControls/)
  assert.match(tab, /total=\{totalStudents\}/)
})

test('growing collections use FlatList directly or the shared virtualized stack', () => {
  const virtualized = read('components/ui/VirtualizedStack.tsx')
  assert.match(virtualized, /<FlatList<T>/)
  assert.match(virtualized, /initialNumToRender=\{8\}/)
  assert.match(virtualized, /windowSize=\{7\}/)

  for (const file of [
    'components/admin/audit/AdminAuditSection.tsx',
    'components/admin/support/AdminSupportSection.tsx',
    'components/admin/users/AdminStudentsSection.tsx',
    'components/admin/users/AdminTeachersSection.tsx',
    'components/student/ranking/RankingMobileList.tsx',
    'components/student/ranking/RankingTable.tsx',
    'components/teacher/classes/TeacherCoursesList.tsx',
    'components/teacher/classes/TeacherClassroomsList.tsx',
    'components/teacher/reviews/ManualReviewQueue.tsx',
    'components/teacher/students/MobileTeacherStudents.tsx',
    'components/teacher/students/TeacherStudentsDesktop.tsx',
    'components/teacher/subject/SubjectQuestionsTab.tsx',
    'components/teacher/subject/SubjectStudentsTab.tsx',
  ]) assert.match(read(file), /VirtualizedStack/, `${file} should use the shared virtualized primitive`)

  assert.match(read('components/notifications/NotificationFeed.tsx'), /FlatList/)
  assert.match(read('features/teacher-catalog/screen.tsx'), /<FlatList/)
})

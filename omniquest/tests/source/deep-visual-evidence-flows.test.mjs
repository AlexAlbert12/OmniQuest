import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path) => fs.readFileSync(path, 'utf8')

test('la matriz web profunda cubre desktop y móvil con los tres roles', () => {
  const source = read('e2e/web/authenticated-deep-visual.spec.ts')
  assert.match(source, /chromium-desktop/)
  assert.match(source, /chromium-mobile/)
  assert.match(source, /deep-student-game-correct/)
  assert.match(source, /deep-student-game-incorrect/)
  assert.match(source, /deep-student-game-result-incorrect/)
  assert.match(source, /deep-teacher-create-course/)
  assert.match(source, /deep-teacher-create-class/)
  assert.match(source, /deep-teacher-create-topic/)
  assert.match(source, /deep-teacher-create-question/)
  assert.match(source, /deep-teacher-import-students/)
  assert.match(source, /deep-teacher-edit-content/)
  assert.match(source, /deep-admin-ticket-detail/)
  assert.match(source, /deep-admin-permissions-modal/)
  assert.match(source, /deep-admin-user-details/)
  assert.match(source, /deep-admin-user-activity/)
  assert.match(source, /openRoleNavigation\(page, 'student-nav-classes'/)
  assert.match(source, /openRoleNavigation\(page, 'teacher-nav-classes'/)
  assert.match(source, /getByLabel\('Crear curso'/)
  assert.match(source, /Progreso de la partida/)
  assert.match(source, /findVisibleOnlyLocator\(page\.getByText\(STUDENT_DEMO_QUESTION/)
  assert.match(source, /getByLabel\(`Curso \${TEACHER_DEMO_COURSE}`/)
  assert.doesNotMatch(source, /getByText\(TEACHER_DEMO_COURSE, \{ exact: true \}\)\.first\(\)/)
  assert.doesNotMatch(source, /await page\.goto\('\/classes'\)/)

  const teacherSubject = read('app/(teacher)/subject/[id].tsx')
  assert.match(teacherSubject, /const STUDENTS_SPLIT_LAYOUT_MIN_WIDTH = 1600/, 'teacher students layout must define a safe split threshold')
  assert.match(teacherSubject, /const isWide = responsive\.width >= STUDENTS_SPLIT_LAYOUT_MIN_WIDTH/, 'student analytics sidebar must only split when the teacher content has enough horizontal room')
  assert.doesNotMatch(teacherSubject, /const isWide = responsive\.isDesktop/, 'desktop alone is not wide enough for the students table plus the 360px analytics rail')
})

test('los flujos Maestro profundos dejan evidencia equivalente en Android', () => {
  const student = read('.maestro/student-deep-ui-capture.yaml')
  const teacher = read('.maestro/teacher-deep-ui-capture.yaml')
  const admin = read('.maestro/admin-deep-ui-capture.yaml')

  for (const name of [
    'ui-deep-student-course-detail',
    'ui-deep-student-topic-difficulty',
    'ui-deep-student-game-question',
    'ui-deep-student-game-correct',
    'ui-deep-student-game-incorrect',
    'ui-deep-student-game-result-incorrect',
  ]) assert.match(student, new RegExp(name))

  for (const name of [
    'ui-deep-teacher-create-course',
    'ui-deep-teacher-course-detail',
    'ui-deep-teacher-create-class',
    'ui-deep-teacher-create-topic',
    'ui-deep-teacher-create-question',
    'ui-deep-teacher-import-students',
    'ui-deep-teacher-edit-content',
  ]) assert.match(teacher, new RegExp(name))

  for (const name of [
    'ui-deep-admin-ticket-detail',
    'ui-deep-admin-permissions-modal',
    'ui-deep-admin-user-details',
    'ui-deep-admin-user-activity',
  ]) assert.match(admin, new RegExp(name))
})

test('los selectores críticos de la suite profunda siguen expuestos por la aplicación', () => {
  const studentClasses = read('app/(student)/classes.tsx')
  const studentCourse = read('app/(student)/class/[id].tsx')
  const gameUi = read('components/student/game/GameQuestionUi.tsx')
  const teacherCourse = read('components/teacher/classes/TeacherCourseCard.tsx')
  const teacherStructure = read('components/teacher/subject/SubjectCourseStructure.tsx')
  const teacherQuestions = read('components/teacher/subject/SubjectQuestionsTab.tsx')
  const adminSupport = read('components/admin/shared/AdminPrimitives.tsx')
  const adminProfile = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  const adminStudents = read('components/admin/users/AdminStudentsSection.tsx')

  assert.match(studentClasses, /student-course-/)
  assert.match(studentCourse, /student-topic-/)
  assert.match(gameUi, /Opción \$\{answerLetters\[index\]/)
  assert.match(gameUi, /Siguiente pregunta/)
  assert.match(teacherCourse, /Abrir curso \$\{course\.name\}/)
  assert.match(teacherStructure, /Nombre de la nueva clase/)
  assert.match(teacherStructure, /Título del nuevo tema/)
  assert.match(teacherQuestions, /Editar pregunta: \$\{question\.text\}/)
  assert.match(adminSupport, /Gestionar ticket \$\{ticket\.subject\}/)
  assert.match(adminProfile, /admin-profile-permissions-sheet/)
  assert.match(adminStudents, /Buscar alumno por nombre o correo/)
})

test('package.json expone comandos finales de evidencia visual', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts['test:e2e:deep-visual'], 'playwright test e2e/web/authenticated-deep-visual.spec.ts --workers=1 --project=chromium-desktop --project=chromium-mobile')
  assert.equal(pkg.scripts['test:e2e:final-visual'], 'playwright test e2e/web/authenticated-visual.spec.ts e2e/web/authenticated-deep-visual.spec.ts --workers=1 --project=chromium-desktop --project=chromium-mobile')
})

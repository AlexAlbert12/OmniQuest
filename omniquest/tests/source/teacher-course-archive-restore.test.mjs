import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const migrationPath = 'supabase/migrations/20260912150000_teacher_course_archive_restore.sql'

test('teacher catalog exposes a dedicated archived filter without changing active counters', () => {
  const types = read('features/teacher-catalog/types.ts')
  const serverTypes = read('lib/teacherServerData.ts')
  const model = read('features/teacher-catalog/model.ts')
  const screen = read('features/teacher-catalog/screen.tsx')
  const migration = read(migrationPath)

  assert.match(types, /TeacherCourseFilter[^\n]*'archived'/)
  assert.match(types, /key: 'archived', label: 'Archivados'/)
  assert.match(serverTypes, /archivedCourses: number/)
  assert.match(serverTypes, /archivedAt: string \| null/)
  assert.match(model, /is_archived: row\.isArchived/)
  assert.match(screen, /badge: catalog\.coursesPage\.summary\.archivedCourses/)
  assert.match(migration, /'courses', \(select count\(\*\)::int from active_rows\)/)
  assert.match(migration, /'archivedCourses', \(select count\(\*\)::int from archived_rows\)/)
  assert.match(migration, /v_status = 'archived' and is_archived/)
})

test('archived course cards are non-navigable, responsive and restore through a confirmed action', () => {
  const card = read('components/teacher/classes/TeacherCourseCard.tsx')
  const screen = read('features/teacher-catalog/screen.tsx')
  const api = read('features/teacher-subject/api.ts')

  assert.match(card, /if \(course\.is_archived\)[\s\S]*<ArchivedTeacherCourseCard/)
  assert.match(card, /accessibilityLabel=\{`Restaurar curso \$\{course\.name\}`\}/)
  assert.match(card, /label="Restaurar"/)
  assert.match(card, /Fecha de archivo no disponible/)
  assert.match(card, /function ArchivedTeacherCourseCard/)
  assert.match(screen, /title: 'Restaurar curso'/)
  assert.match(screen, /El curso volverá a aparecer entre tus cursos activos/)
  assert.match(screen, /await restoreTeacherSubject\(course\.id\)/)
  assert.match(screen, /markCourseRestored\(course\.id\)/)
  assert.match(screen, /feedback\.success\('Curso restaurado'/)
  assert.match(api, /body: \{ archive, subjectId \}/)
  assert.match(api, /export async function restoreTeacherSubject/)
})

test('teacher archive operation stores retention metadata, preserves classrooms and audits both directions', () => {
  const fn = read('supabase/functions/teacher-archive-subject/index.ts')
  const teacherInfrastructure = read('supabase/functions/_shared/teacher.ts')
  const auditPresentation = read('lib/teacherAuditPresentation.ts')

  assert.match(fn, /ensureTeacherSubject\([\s\S]*context\.teacherUserId/)
  assert.match(teacherInfrastructure, /\.eq\('teacher_id', teacherUserId\)/)
  assert.match(fn, /active: false[\s\S]*is_archived: true[\s\S]*archive_reason: 'Archivado por el profesor'/)
  assert.match(fn, /90 \* 86400000/)
  assert.match(fn, /active: true[\s\S]*is_archived: false[\s\S]*archive_reason: null/)
  assert.match(fn, /teacher\.subject\.archive/)
  assert.match(fn, /teacher\.subject\.restore/)
  assert.match(fn, /beforeState:[\s\S]*archive_reason:[\s\S]*archived_at:[\s\S]*retention_until:/)
  assert.match(fn, /afterState: \{ name: subject\.name, \.\.\.nextState \}/)
  assert.doesNotMatch(fn, /from\('classrooms'\)|\.from\("classrooms"\)/)
  assert.match(fn, /archive \? 'No se pudo archivar el curso\.' : 'No se pudo restaurar el curso\.'/)
  assert.match(auditPresentation, /archive_reason: 'Motivo de archivo'/)
  assert.match(auditPresentation, /retention_until: 'Conservación hasta'/)
})

test('game RPCs reject archived or inactive subjects and v2 inherits the protected payload', () => {
  const migration = read(migrationPath)
  const v2Migration = read('supabase/migrations/20260809143000_question_hints_and_academic_icons.sql')

  assert.match(migration, /create or replace function public\.start_game_attempt\([\s\S]*s\.active is true[\s\S]*coalesce\(s\.is_archived, false\) is false/)
  assert.match(migration, /create or replace function public\.get_safe_game_questions\([\s\S]*s\.active is true[\s\S]*coalesce\(s\.is_archived, false\) is false/)
  assert.match(migration, /create or replace function public\.get_student_question_catalog\([\s\S]*s\.active is true[\s\S]*coalesce\(s\.is_archived, false\) is false/)
  assert.equal((migration.match(/Este curso no está disponible para jugar\./g) || []).length, 2)
  assert.match(migration, /revoke all on function public\.start_game_attempt[\s\S]*from public, anon/)
  assert.match(migration, /revoke all on function public\.get_safe_game_questions[\s\S]*from public, anon/)
  assert.match(v2Migration, /v_questions := public\.get_safe_game_questions\(/)
  assert.doesNotMatch(migration, /submit_answer_resumable|finish_game_attempt/)
})

test('archive UX explains retention, contextual empty states and admin restore remain intact', () => {
  const detail = read('features/teacher-subject/useTeacherSubjectDetail.ts')
  const screen = read('features/teacher-catalog/screen.tsx')
  const adminBulk = read('supabase/functions/admin-bulk-operations/index.ts')
  const studentProgress = read('supabase/migrations/20260803103500_code_optimization_aggregates.sql')
  const join = read('supabase/migrations/20260805123000_expired_classroom_code_enforcement.sql')

  assert.match(detail, /No se eliminarán alumnos, preguntas, resultados ni el histórico/)
  assert.match(detail, /Cursos > Archivados/)
  assert.match(screen, /No tienes cursos archivados/)
  assert.match(screen, /Los cursos que archives aparecerán aquí/)
  assert.match(screen, /No se encontraron cursos archivados/)
  assert.match(adminBulk, /action === 'restore_courses'/)
  assert.match(adminBulk, /active: true, is_archived: false, archive_reason: null, archived_at: null, retention_until: null/)
  assert.match(studentProgress, /coalesce\(s\.active, true\) = true[\s\S]*coalesce\(s\.is_archived, false\) = false/)
  assert.match(join, /coalesce\(active, true\)[\s\S]*not coalesce\(is_archived, false\)/)
})

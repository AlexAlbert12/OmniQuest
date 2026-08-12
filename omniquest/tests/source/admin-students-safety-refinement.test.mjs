import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('admin selections are cleared when paging or filters change across governed lists', () => {
  const students = read('components/admin/users/AdminStudentsSection.tsx')
  const teachers = read('components/admin/users/AdminTeachersSection.tsx')
  const courses = read('components/admin/courses/AdminCoursesSection.tsx')
  const classrooms = read('components/admin/classrooms/AdminClassroomsSection.tsx')
  for (const source of [students, teachers, courses, classrooms]) {
    assert.match(source, /const clearSelection = selection\.clear/)
    assert.match(source, /useEffect\(\(\) => clearSelection\(\), \[/)
    assert.match(source, /clearSelection/)
    assert.match(source, /page\.page/)
    assert.match(source, /search/)
  }
})

test('student cards expose truthful account semantics without masking guests', () => {
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  const filters = read('components/admin/shared/AdminAdvancedFilters.tsx')
  assert.match(primitives, /profile\.role_id === 'guest' \? 'Invitado'/)
  assert.match(primitives, /'Cuenta sin alertas'/)
  assert.doesNotMatch(primitives, /Seguridad correcta/)
  assert.match(primitives, /profile\.last_sign_in_at \? <MiniPill/)
  assert.match(filters, /fromLabel="Alta desde"/)
  assert.match(filters, /toLabel="Alta hasta"/)
  assert.doesNotMatch(filters, /label="Rol"/)
})

test('student progress deletion requires an administrative reason and states its full irreversible scope', () => {
  const students = read('components/admin/users/AdminStudentsSection.tsx')
  const modal = read('components/admin/shared/AdminGovernanceModal.tsx')
  const actions = read('components/admin/hooks/useAdminActions.ts')
  const edge = read('supabase/functions/admin-delete-student-progress/index.ts')
  assert.match(students, /setGovernanceMode\('delete-student-progress'\)/)
  assert.match(modal, /puntuaciones, progreso por tema, intentos e insignias/)
  assert.match(modal, /Las matrículas y la cuenta del alumno se conservarán/)
  assert.match(modal, /confirmationValue\.trim\(\)\.toUpperCase\(\) === 'ELIMINAR'/)
  assert.match(actions, /studentId: student\.id, reason: administrativeReason/)
  assert.match(edge, /reason\.length < 5/)
  assert.match(edge, /reason,/)
  assert.match(edge, /student_badges/)
})

test('admin profile paging is shorter and password recovery is not styled as destructive', () => {
  const types = read('components/admin/types/admin.ts')
  const students = read('components/admin/users/AdminStudentsSection.tsx')
  const actions = read('components/admin/hooks/useAdminActions.ts')
  assert.match(types, /ADMIN_PAGE_SIZE = 25/)
  assert.match(students, /'inscripción' : 'inscripciones'/)
  assert.match(students, /label: 'Resetear contraseña', icon: 'key-outline', disabled:/)
  assert.match(actions, /confirmationText: 'RESET'.*destructive: false/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('admin course and classroom filters collapse into the shared mobile bottom-sheet pattern', () => {
  const filters = read('components/admin/shared/AdminAdvancedFilters.tsx')
  const courses = read('components/admin/courses/AdminCoursesSection.tsx')
  const classrooms = read('components/admin/classrooms/AdminClassroomsSection.tsx')
  assert.match(filters, /AdminMobileFilterShell/)
  assert.match(filters, /description="Refina el listado de cursos/)
  assert.match(filters, /description="Refina el listado de clases/)
  assert.match(filters, /Fecha de creación/)
  assert.match(courses + classrooms, /mobileAction=\{responsive\.isMobile \? exportButton/)
  assert.match(courses + classrooms, /onExport=\{!responsive\.isMobile/)
})

test('admin related actions respect RBAC and classroom-to-course navigation is exact', () => {
  const courses = read('components/admin/courses/AdminCoursesSection.tsx')
  const classrooms = read('components/admin/classrooms/AdminClassroomsSection.tsx')
  const migration = read('supabase/migrations/20260812183000_admin_content_supervision_refinement.sql')
  assert.match(courses, /permissions\.includes\('audit\.read'\)/)
  assert.match(courses, /permissions\.includes\('users\.read'\)/)
  assert.match(classrooms, /permissions\.includes\('audit\.read'\)/)
  assert.match(classrooms, /permissions\.includes\('users\.read'\)/)
  assert.match(classrooms, /courses\?subjectId=\$\{classroom\.subject_id\}/)
  assert.match(courses, /p_subject_id: exactSubjectId/)
  assert.match(migration, /p_subject_id bigint default null/)
  assert.match(migration, /subject\.id = p_subject_id/)
})

test('admin content cards use natural plurals and actionable alert language', () => {
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  const utils = read('components/admin/utils/adminUtils.ts')
  assert.match(utils, /formatAdminCount/)
  assert.match(primitives, /'clase', 'clases'/)
  assert.match(primitives, /'alumno', 'alumnos'/)
  assert.match(primitives, /'alerta', 'alertas'/)
  assert.doesNotMatch(primitives, /clase\(s\)|alumno\(s\)|incidencia\(s\)/)
})

test('admin content search is debounced and admin loading does not use student mission copy', () => {
  const courses = read('components/admin/courses/AdminCoursesSection.tsx')
  const classrooms = read('components/admin/classrooms/AdminClassroomsSection.tsx')
  const layout = read('components/layouts/RoleScreenLayout.tsx')
  const scaffold = read('components/admin/shared/AdminScaffold.tsx')
  const hub = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  assert.match(courses + classrooms, /useDebouncedValue\(search, 350\)/)
  assert.match(layout, /role === 'admin' \? <ActivityIndicator/)
  assert.match(scaffold, /Cargando área de contenido/)
  assert.match(hub, /Supervisa cursos y clases desde un único punto\./)
})

test('course deletion is only offered after retention eligibility', () => {
  const courses = read('components/admin/courses/AdminCoursesSection.tsx')
  assert.match(courses, /if \(canDelete && eligibleForDeletion\) rowActions\.push/)
  assert.match(courses, /label: 'Eliminar definitivamente'/)
  assert.doesNotMatch(courses, /label: 'Eliminar tras retención'/)
})

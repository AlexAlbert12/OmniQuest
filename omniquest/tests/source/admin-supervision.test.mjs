import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('admin user management uses typed confirmations, advanced filters and real activity routes', () => {
  const teachers = read('components/admin/users/AdminTeachersSection.tsx')
  const students = read('components/admin/users/AdminStudentsSection.tsx')
  const confirmation = read('components/admin/shared/AdminTypedConfirmation.tsx')
  const filters = read('components/admin/shared/AdminAdvancedFilters.tsx')
  const migration = read('supabase/migrations/20260722210000_admin_supervision_filters.sql')

  assert.match(confirmation, /confirmationText/)
  assert.match(confirmation, /confirmationText: 'CONFIRMAR'/)
  assert.match(confirmation, /confirmLabel: 'Confirmar'/)
  assert.match(confirmation, /const confirmLabel = state\.confirmLabel\.trim\(\) \|\| 'Confirmar'/)
  assert.match(confirmation, /label=\{confirmLabel\}/)
  assert.match(teachers + students, /Resetear contraseña/)
  assert.match(teachers + students, /Ver actividad/)
  assert.match(filters, /Estado de cuenta/)
  assert.match(filters, /Actividad reciente/)
  assert.match(filters, /Todas las clases/)
  assert.match(migration, /get_admin_profile_activity_page/)
  assert.equal(existsSync(join(root, 'app/(admin)/user/[id]/activity.tsx')), true)
})

test('admin courses and classrooms expose supervision data and related audit actions', () => {
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  const courses = read('components/admin/courses/AdminCoursesSection.tsx')
  const classrooms = read('components/admin/classrooms/AdminClassroomsSection.tsx')
  const migration = read('supabase/migrations/20260722210000_admin_supervision_filters.sql')

  assert.match(primitives, /Profesor propietario/)
  assert.match(primitives, /incidents_count/)
  assert.match(primitives, /Última actividad/)
  assert.match(courses + classrooms, /Ver auditoría/)
  assert.match(migration, /pending_reviews_count/)
  assert.match(migration, /missing_code_count/)
})

test('admin audit is server-paginated with actor, action, entity, dates and severity filters', () => {
  const audit = read('components/admin/audit/AdminAuditSection.tsx')
  const table = read('components/admin/audit/AdminAuditTable.tsx')
  const exports = read('lib/adminExports.ts')
  const migration = read('supabase/migrations/20260722210000_admin_supervision_filters.sql')

  assert.match(audit, /p_actor_id/)
  assert.match(audit, /p_target_table/)
  assert.match(audit, /p_severity/)
  assert.match(audit, /AdminDateRangeFields/)
  assert.match(table, /AdminAuditTable/)
  assert.match(exports, /p_actor_id/)
  assert.match(migration, /create or replace function public\.get_admin_audit_logs_page/)
})

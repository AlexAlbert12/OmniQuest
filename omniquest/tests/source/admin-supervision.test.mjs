import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('admin user management uses typed confirmations, advanced filters and real activity routes', () => {
  const teachers = read('components/admin/portal/AdminTeachersSection.tsx')
  const students = read('components/admin/portal/AdminStudentsSection.tsx')
  const confirmation = read('components/admin/portal/AdminTypedConfirmation.tsx')
  const filters = read('components/admin/portal/AdminAdvancedFilters.tsx')
  const migration = read('supabase/migrations/20260722210000_admin_supervision_filters.sql')

  assert.match(confirmation, /confirmationText/)
  assert.match(teachers + students, /Resetear contraseña/)
  assert.match(teachers + students, /Ver actividad/)
  assert.match(filters, /Estado de cuenta/)
  assert.match(filters, /Actividad reciente/)
  assert.match(filters, /Todas las clases/)
  assert.match(migration, /get_admin_profile_activity_page/)
  assert.equal(existsSync(join(root, 'app/(admin)/user/[id]/activity.tsx')), true)
})

test('admin courses and classrooms expose supervision data and related audit actions', () => {
  const core = read('components/admin/portal/AdminPortalCore.tsx')
  const courses = read('components/admin/portal/AdminCoursesSection.tsx')
  const classrooms = read('components/admin/portal/AdminClassroomsSection.tsx')
  const migration = read('supabase/migrations/20260722210000_admin_supervision_filters.sql')

  assert.match(core, /Profesor propietario/)
  assert.match(core, /incidents_count/)
  assert.match(core, /Última actividad/)
  assert.match(courses + classrooms, /Ver auditoría/)
  assert.match(migration, /pending_reviews_count/)
  assert.match(migration, /missing_code_count/)
})

test('admin audit is server-paginated with actor, action, entity, dates and severity filters', () => {
  const audit = read('components/admin/portal/AdminAuditSection.tsx')
  const table = read('components/admin/portal/AdminAuditTable.tsx')
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

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('admin portal core is only a coordinator and features are physically separated', () => {
  const core = read('components/admin/portal/AdminPortalCore.tsx')
  assert.ok(core.split('\n').length < 250)
  assert.doesNotMatch(core, /export type ProfileRow|function useAdminData|select\(/)
  for (const directory of ['api','hooks','types','utils','dashboard','users','courses','classrooms','audit','support']) {
    assert.equal(existsSync(join(root, 'components/admin', directory)), true, `${directory} should exist`)
  }
})

test('admin user governance supports selection, batch operations, security and immutable history', () => {
  const teachers = read('components/admin/users/AdminTeachersSection.tsx')
  const students = read('components/admin/users/AdminStudentsSection.tsx')
  const cards = read('components/admin/shared/AdminPrimitives.tsx')
  const edge = read('supabase/functions/admin-bulk-operations/index.ts')
  const migration = read('supabase/migrations/20260731130000_admin_governance_bulk_jobs.sql')
  assert.match(teachers + students, /useAdminSelection/)
  assert.match(teachers + students, /AdminBulkSelectionBar/)
  assert.match(cards, /Último acceso/)
  assert.match(cards, /deactivation_reason/)
  assert.match(edge, /No puedes desactivar tu propia cuenta administradora/)
  assert.match(edge, /normalizeReactivationDate/)
  assert.match(edge, /admin\.roles\.manage/)
  assert.match(migration, /admin_user_change_history/)
  assert.match(migration, /prevent_admin_user_change_history_update/)
  assert.match(migration, /system\.user\.auto_reactivate/)
  assert.match(migration, /admin_roles/)
})

test('large exports are asynchronous jobs with private storage', () => {
  const hook = read('components/admin/hooks/useAdminExportJobs.ts')
  const worker = read('supabase/functions/process-admin-export-jobs/index.ts')
  const migration = read('supabase/migrations/20260731130000_admin_governance_bulk_jobs.sql')
  assert.match(hook, /requestAdminExportJob/)
  assert.match(worker, /claim_admin_export_jobs/)
  assert.match(worker, /admin-exports/)
  assert.match(migration, /create table if not exists public\.admin_export_jobs/)
  assert.match(migration, /public = false/)
})

test('course governance covers ownership, archive retention and classroom consistency', () => {
  const courses = read('components/admin/courses/AdminCoursesSection.tsx')
  const classrooms = read('components/admin/classrooms/AdminClassroomsSection.tsx')
  const edge = read('supabase/functions/admin-bulk-operations/index.ts')
  const migration = read('supabase/migrations/20260731130000_admin_governance_bulk_jobs.sql')
  assert.match(courses, /Transferir propietario/)
  assert.match(courses, /Eliminar tras retención/)
  assert.match(classrooms, /code_status/)
  assert.match(edge, /deactivateClassrooms/)
  assert.match(edge, /sigue dentro del periodo de conservación/)
  assert.match(migration, /archive_reason/)
  assert.match(migration, /code_expires_at/)
  assert.match(migration, /teacher_id is null/)
  assert.match(courses, /Restaurar seleccionados/)
  assert.match(courses, /Eliminar seleccionados/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher question deletion preserves historical attempts through server-side archiving', () => {
  const edgeFunction = read('supabase/functions/teacher-delete-question/index.ts')
  const sharedTeacher = read('supabase/functions/_shared/teacher.ts')
  const migration = read('supabase/migrations/20260803191000_teacher_question_archive.sql')

  assert.match(sharedTeacher, /userClient: any/)
  assert.match(sharedTeacher, /return \{[\s\S]*userClient,/)
  assert.match(edgeFunction, /context\.userClient\.rpc\('archive_teacher_question'/)
  assert.doesNotMatch(edgeFunction, /\.from\('questions'\)[\s\S]*\.delete\(\)/)
  assert.doesNotMatch(edgeFunction, /writeTeacherAudit/)
  assert.match(migration, /and subject\.teacher_id = v_teacher_id/)
  assert.match(migration, /set active = false/)
  assert.match(migration, /teacher\.question\.archive/)
})

test('administrative authorization fails closed when permission context is unavailable', () => {
  const sharedAdmin = read('supabase/functions/_shared/admin.ts')

  assert.match(sharedAdmin, /authorization_unavailable/)
  assert.match(sharedAdmin, /No se pudieron verificar los permisos administrativos/)
  assert.doesNotMatch(sharedAdmin, /permissions = \['dashboard\.read'/)
})

test('outbound email defaults to redirect mode outside explicitly configured production delivery', () => {
  for (const path of [
    'supabase/functions/import-students/index.ts',
    'supabase/functions/teacher-student-reminder/index.ts',
    'supabase/functions/process-support-email-delivery/index.ts',
  ]) {
    const implementation = read(path)
    assert.match(implementation, /Deno\.env\.get\('EMAIL_DELIVERY_MODE'\) \|\| 'redirect'/)
    assert.doesNotMatch(implementation, /Deno\.env\.get\('EMAIL_DELIVERY_MODE'\) \|\| 'real'/)
  }
})

test('CSV exports share formula-injection protection', () => {
  const csv = read('supabase/functions/_shared/csv.ts')
  const adminExport = read('supabase/functions/process-admin-export-jobs/index.ts')
  const teacherExport = read('supabase/functions/process-teacher-audit-exports/index.ts')

  assert.match(csv, /\[=\+@-\]/)
  assert.match(csv, /trimStart\(\)/)
  assert.match(csv, /`'\$\{raw\}`/)
  assert.match(adminExport, /import \{ csvCell \} from '\.\.\/_shared\/csv\.ts'/)
  assert.match(teacherExport, /import \{ csvCell \} from '\.\.\/_shared\/csv\.ts'/)
})

test('course visibility policy avoids recursive RLS evaluation through enrollments', () => {
  const migration = read('supabase/migrations/20260803193000_teacher_authorization_hardening.sql')

  assert.match(migration, /public\.is_subject_enrolled\(subjects\.id\)/)
  assert.doesNotMatch(migration, /from public\.enrollments enrollment/)
  assert.match(migration, /revoke all on table public\.subjects from public, anon, authenticated/)
  assert.match(migration, /grant select on table public\.subjects to authenticated/)
  assert.match(migration, /revoke select on table public\.questions, public\.answers from public, anon/)
  assert.match(migration, /grant select on table public\.questions, public\.answers to authenticated/)
})

test('student progress reads are explicitly granted only through RLS-scoped tables', () => {
  const historicalGrant = read('supabase/migrations/20260803201000_attempt_history_select_grant.sql')
  const finalGrant = read('supabase/migrations/20260805113000_progress_read_privileges.sql')

  assert.match(historicalGrant, /grant select on table public\.attempt_history to authenticated/)
  assert.match(finalGrant, /revoke select on table public\.attempt_history, public\.student_badges from public, anon/)
  assert.match(finalGrant, /grant select on table public\.attempt_history, public\.student_badges to authenticated/)
  assert.doesNotMatch(finalGrant, /grant all/)
})

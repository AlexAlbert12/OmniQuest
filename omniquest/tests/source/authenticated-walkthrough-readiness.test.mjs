import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('the final walkthrough matrix keeps direct client access minimal and explicit', () => {
  const migration = read('supabase/migrations/20260805200000_authenticated_walkthrough_authorization_matrix.sql')
  assert.match(migration, /revoke all on table[\s\S]*public\.notifications[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant select on table public\.profiles to authenticated/)
  assert.match(migration, /grant update \(alias, visibility\) on table public\.profiles to authenticated/)
  assert.match(migration, /grant select on table public\.subjects, public\.classrooms, public\.subject_topics, public\.questions, public\.answers to authenticated/)
  assert.match(migration, /grant select, delete on table public\.enrollments to authenticated/)
  assert.match(migration, /grant select, insert, update on table public\.notification_state, public\.user_preferences, public\.user_notification_preferences to authenticated/)
  assert.match(migration, /grant select, insert on table public\.user_support_tickets, public\.support_ticket_attachments to authenticated/)
  assert.match(migration, /grant usage, select on sequence public\.notification_state_id_seq, public\.user_support_tickets_id_seq to authenticated/)
  assert.doesNotMatch(migration, /grant (insert|update|delete) on table public\.classrooms to authenticated/)
  assert.doesNotMatch(migration, /grant all .* to authenticated/i)
})

test('persistent notifications never fall back to direct table writes', () => {
  const source = read('lib/notifications/persistent.ts')
  assert.match(source, /supabase\.rpc\('get_notifications_page'/)
  assert.match(source, /supabase\.rpc\('mark_notifications_read'/)
  assert.match(source, /supabase\.rpc\('delete_notifications'/)
  assert.doesNotMatch(source, /\.from\('notifications'\)/)
  assert.match(source, /La API protegida de notificaciones no está disponible/)
})

test('CSV exports neutralize formula and control-character prefixes in client and server', () => {
  for (const path of ['supabase/functions/_shared/csv.ts', 'lib/reportExports.ts']) {
    const source = read(path)
    assert.match(source, /\/\^\[\\t\\r\]\//)
    assert.match(source, /\/\^\[=\+@-\]\//)
    assert.match(source, /trimStart\(\)/)
  }
  const testSource = read('supabase/functions/_shared/csv_test.ts')
  assert.match(testSource, /=Demo CSV/)
  assert.match(testSource, /\\t=SUM/)
  assert.match(testSource, /\\r@malicious/)
})

test('bulk user state changes create individual admin audit events', () => {
  const source = read('supabase/functions/admin-bulk-operations/index.ts')
  assert.match(source, /const auditAction = active \? 'admin\.user\.activate' : 'admin\.user\.deactivate'/)
  assert.match(source, /writeAdminUserHistory\([\s\S]*action: auditAction/)
  assert.match(source, /writeAdminAudit\([\s\S]*action: auditAction[\s\S]*targetTable: 'profiles'/)
})

test('the post-walkthrough verifier checks media, idempotency, support, CSV and restricted admin behavior', () => {
  const source = read('scripts/verify-authenticated-demo.mjs')
  assert.match(source, /question_media_assets/)
  assert.match(source, /No existen matrículas duplicadas/)
  assert.match(source, /game_answer_submission_receipts/)
  assert.match(source, /Validación funcional alumno/)
  assert.match(source, /El alias CSV peligroso quedó neutralizado/)
  assert.match(source, /El intento 403 no modifica el usuario objetivo/)
})

test('local demo tooling prepares secrets and processes export workers without printing secret values', () => {
  const prepare = read('scripts/prepare-local-function-env.mjs')
  const workers = read('scripts/process-demo-workers.mjs')
  const example = read('supabase/functions/.env.example')
  assert.match(prepare, /AUTH_RATE_LIMIT_PEPPER/)
  assert.match(prepare, /ADMIN_EXPORT_QUEUE_SECRET/)
  assert.match(prepare, /TEACHER_AUDIT_EXPORT_SECRET/)
  assert.match(prepare, /randomBytes\(32\)/)
  assert.doesNotMatch(prepare, /console\.log\([^\n]*values\[/)
  assert.match(workers, /process-admin-export-jobs/)
  assert.match(workers, /process-teacher-audit-exports/)
  assert.match(example, /EMAIL_DELIVERY_MODE=redirect/)
  assert.match(example, /PASSWORD_RESET_REDIRECT_TO=/)
  assert.match(example, /PASSWORD_RECOVERY_REDIRECT_URL=/)
})

test('the walkthrough pgTAP suite has a consistent plan and no nested data-modifying CTE', () => {
  const source = read('supabase/tests/011_authenticated_walkthrough_authorization.sql')
  const plan = Number(source.match(/select plan\((\d+)\)/)?.[1] || 0)
  const assertions = (source.match(/select (?:ok|is)\(/g) || []).length
  assert.equal(plan, assertions)
  assert.equal(plan, 34)
  assert.doesNotMatch(source, /\(with\s+\w+\s+as\s*\(\s*(?:delete|update|insert)/i)
  assert.match(source, /persistent notifications are accessible only through protected RPCs/)
  assert.match(source, /server-controlled workflow identities are not client-allocatable/)
})

test('the generated call inventory is tracked and reports no structural issues', () => {
  const markdown = read('docs/generated/AUTHENTICATED_WALKTHROUGH_AUDIT.md')
  const json = JSON.parse(read('docs/generated/AUTHENTICATED_WALKTHROUGH_CALLS.json'))
  assert.match(markdown, /PASS: no se detectaron huecos estructurales/)
  assert.equal(json.errors.length, 0)
  assert.ok(json.calls.length >= 150)
  assert.ok(json.rpcs.length >= 90)
  assert.ok(json.edgeFunctions.length >= 15)
})

test('client-invoked Edge Functions authenticate and authorize their callers', () => {
  const inventory = JSON.parse(read('docs/generated/AUTHENTICATED_WALKTHROUGH_CALLS.json'))
  for (const functionName of inventory.edgeFunctions) {
    const source = read(`supabase/functions/${functionName}/index.ts`)
    if (functionName.startsWith('admin-')) {
      assert.match(source, /getAdminContext\(/, `${functionName} must use the shared admin authorization context`)
      continue
    }
    if (functionName.startsWith('teacher-')) {
      assert.match(source, /getTeacherContext\(|auth\.getUser\(/, `${functionName} must authenticate the teacher`)
      continue
    }
    if (functionName === 'auth-attempt-guard') {
      assert.match(source, /consume_auth_rate_limit/)
      assert.match(source, /AUTH_RATE_LIMIT_PEPPER/)
      continue
    }
    assert.match(source, /auth\.getUser\(/, `${functionName} must authenticate the user`)
  }
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const require = createRequire(import.meta.url)
const authValidation = require('../../lib/authFormValidation.js')

test('local Supabase auth configuration matches the public authentication UX', () => {
  const config = read('supabase/config.toml')

  assert.match(config, /enable_anonymous_sign_ins\s*=\s*true/)
  assert.match(config, /minimum_password_length\s*=\s*8/)
  assert.match(config, /password_requirements\s*=\s*"lower_upper_letters_digits_symbols"/)
  assert.match(config, /\[auth\.email\][\s\S]*enable_confirmations\s*=\s*true/)
  assert.match(config, /\[auth\.email\][\s\S]*secure_password_change\s*=\s*true/)
  assert.match(config, /\[auth\.email\][\s\S]*otp_expiry\s*=\s*1800/)
  assert.match(config, /\[functions\.process-notification-delivery\][\s\S]*verify_jwt\s*=\s*false/)
  assert.equal(authValidation.isStrongPassword('Casi1'), false)
  assert.equal(authValidation.isStrongPassword('Segura1!'), true)
})

test('teacher recovery creates one-time links without passwords and is rate limited', () => {
  const edgeFunction = read('supabase/functions/teacher-student-reminder/index.ts')
  const migration = read('supabase/migrations/20260722230000_auth_recovery_push_delivery.sql')
  const studentsScreen = read('app/(teacher)/students.tsx')

  assert.match(edgeFunction, /auth\.admin\.generateLink\(\{[\s\S]*type:\s*'recovery'/)
  assert.match(edgeFunction, /reserve_teacher_student_recovery_request/)
  assert.match(edgeFunction, /finish_teacher_student_recovery_request/)
  assert.match(migration, /teacher\.student\.password_recovery_requested/)
  assert.doesNotMatch(edgeFunction, /updateUserById\(/)
  assert.doesNotMatch(edgeFunction, /temporaryPassword|generatePassword|mode\s*===\s*'credentials'/)
  assert.match(migration, /interval '15 minutes'/)
  assert.match(migration, /v_recent_count >= 3/)
  assert.match(migration, /interval '30 minutes'/)
  assert.match(studentsScreen, /mode:\s*'recovery'/)
  assert.doesNotMatch(studentsScreen, /temporaryPassword/)
})

test('persistent notifications use a central queue with retries, receipts and rate limiting', () => {
  const migration = read('supabase/migrations/20260722230000_auth_recovery_push_delivery.sql')
  const worker = read('supabase/functions/process-notification-delivery/index.ts')
  const explicitPush = read('supabase/functions/send-push-notification/index.ts')
  const packageJson = read('package.json')

  assert.match(migration, /create table if not exists public\.notification_delivery_queue/)
  assert.match(migration, /create table if not exists public\.notification_push_deliveries/)
  assert.match(migration, /create trigger enqueue_notification_push_delivery/)
  assert.match(migration, /create or replace function public\.claim_notification_delivery_batch/)
  assert.match(migration, /create or replace function public\.get_admin_push_delivery_metrics/)
  assert.match(migration, /cron\.schedule\([\s\S]*omniquest-notification-delivery/)

  assert.match(worker, /getExpoPushReceipts/)
  assert.match(worker, /DeviceNotRegistered/)
  assert.match(worker, /retryDelaySeconds/)
  assert.match(worker, /USER_RATE_LIMIT/)
  assert.match(worker, /claim_notification_delivery_batch/)
  assert.match(explicitPush, /rpc\('create_notification'/)
  assert.doesNotMatch(explicitPush, /sendExpoPushToUser/)
  assert.match(packageJson, /process-notification-delivery --no-verify-jwt/)
})

test('database types expose recovery and notification delivery contracts', () => {
  const types = read('types/database.types.ts')
  const adminDashboard = read('components/admin/portal/AdminDashboard.tsx')

  for (const table of [
    'teacher_student_recovery_requests',
    'notification_delivery_queue',
    'notification_push_deliveries',
  ]) {
    assert.match(types, new RegExp(`\\s{6}${table}: \\{`))
  }

  for (const rpc of [
    'reserve_teacher_student_recovery_request',
    'finish_teacher_student_recovery_request',
    'claim_notification_delivery_batch',
    'get_admin_push_delivery_metrics',
    'invoke_notification_delivery_worker',
  ]) {
    assert.match(types, new RegExp(`\\s{6}${rpc}: \\{`))
  }

  assert.match(adminDashboard, /AdminPushDeliveryPanel/)
})

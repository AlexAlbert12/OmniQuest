import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('the low-level notification writer is service-only and teachers use a constrained RPC', () => {
  const migration = read('supabase/migrations/20260722220000_secure_notification_api.sql')
  const helper = read('lib/notifications/teacher.ts')

  assert.match(migration, /revoke all on function public\.create_notification[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.create_notification[\s\S]*to service_role/)
  assert.match(migration, /create or replace function public\.create_teacher_notification/)
  assert.match(migration, /s\.teacher_id = v_teacher_id/)
  assert.match(migration, /Student is not enrolled in this course/)
  assert.match(migration, /Unsupported teacher notification type/)
  assert.match(helper, /rpc\('create_teacher_notification'/)
  assert.doesNotMatch(helper, /create_notification/)
})

test('database types include recent tables and RPCs without rpc any-casts', () => {
  const types = read('types/database.types.ts')
  const sourceRoots = ['app', 'components', 'hooks', 'lib']
    .map((directory) => readTree(directory))
    .join('\n')

  for (const table of [
    'analytics_events',
    'avatar_frames',
    'game_answer_submission_receipts',
    'profile_cosmetics',
    'push_tokens',
  ]) {
    assert.match(types, new RegExp(`\\s{6}${table}: \\{`))
  }

  for (const rpc of [
    'submit_answer_resumable',
    'get_ranking_profiles_page',
    'register_push_token',
    'get_teacher_audit_logs_page',
    'search_app_entities',
    'get_admin_usage_analytics',
    'get_profile_cosmetics',
    'create_teacher_notification',
  ]) {
    assert.match(types, new RegExp(`\\s{6}${rpc}: \\{`))
  }

  assert.doesNotMatch(sourceRoots, /supabase\.rpc as any|\(supabase\.rpc as any\)/)
})

test('student home never invents ranking participants', () => {
  const home = read('features/student-home/screen.tsx')

  for (const demoAlias of ['Sofia_R', 'Mateo09', 'CamilaStar', 'Lucho94']) {
    assert.doesNotMatch(home, new RegExp(demoAlias))
  }

  assert.match(home, /Aún no hay clasificación/)
  assert.match(home, /Completa una actividad para aparecer en el ranking/)
})

function readTree(relativeDirectory) {
  const base = join(root, relativeDirectory)
  const chunks = []

  for (const entry of readdirSync(base)) {
    const path = join(base, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      chunks.push(readTree(join(relativeDirectory, entry)))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      chunks.push(readFileSync(path, 'utf8'))
    }
  }

  return chunks.join('\n')
}

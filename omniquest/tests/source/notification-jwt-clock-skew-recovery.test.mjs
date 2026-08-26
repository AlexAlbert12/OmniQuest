import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('notification startup recovers a JWT issued-at clock skew without opening LogBox', () => {
  const recovery = read('lib/supabaseJwtRecovery.ts')
  const hook = read('hooks/useNotifications.ts')
  const persistent = read('lib/notifications/persistent.ts')

  assert.match(recovery, /candidate\.code === 'PGRST303'/)
  assert.match(recovery, /jwt issued at future/i)
  assert.match(recovery, /supabase\.auth\.refreshSession\(\)/)
  assert.match(recovery, /if \(recoveryPromise\) return recoveryPromise/)
  assert.match(hook, /retrySupabaseRequestAfterJwtRecovery/)
  assert.match(hook, /retryAttempt < 2/)
  assert.match(hook, /retryTimers\.forEach\(\(timer\) => clearTimeout\(timer\)\)/)
  assert.match(persistent, /retrySupabaseRequestAfterJwtRecovery/)
  assert.match(persistent, /if \(!isJwtIssuedInFutureError\(error\)\) \{\s*console\.error\('Error loading notification state from DB:'/)
})

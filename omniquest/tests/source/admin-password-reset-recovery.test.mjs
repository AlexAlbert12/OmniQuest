import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('admin password reset generates a recovery link server-side and sends it through configured mail delivery', () => {
  const edge = read('supabase/functions/admin-reset-password/index.ts')
  assert.match(edge, /auth\.admin\.generateLink\(\{[\s\S]*type: 'recovery'/)
  assert.doesNotMatch(edge, /auth\.resetPasswordForEmail/)
  assert.match(edge, /PASSWORD_RESET_REDIRECT_TO/)
  assert.match(edge, /RESEND_API_KEY/)
  assert.match(edge, /MAIL_FROM/)
  assert.match(edge, /EMAIL_DELIVERY_MODE/)
  assert.match(edge, /RESEND_TEST_TO/)
  assert.match(edge, /https:\/\/api\.resend\.com\/emails/)
  assert.match(edge, /admin\.user\.reset_password/)
})

test('admin password reset uses the auth user email and keeps demo delivery redirectable', () => {
  const edge = read('supabase/functions/admin-reset-password/index.ts')
  assert.match(edge, /auth\.admin\.getUserById\(profileId\)/)
  assert.match(edge, /mode === 'redirect'/)
  assert.match(edge, /originalTo: email/)
  assert.match(edge, /delivery_mode: delivery\.mode/)
})

test('admin edge action helper surfaces the JSON error returned by non-2xx functions', () => {
  const api = read('components/admin/api/adminApi.ts')
  assert.match(api, /readEdgeFunctionErrorMessage/)
  assert.match(api, /context/)
  assert.match(api, /\.json\(\)/)
  assert.match(api, /throw new Error\(edgeMessage\)/)
})

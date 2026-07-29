import assert from 'node:assert/strict'
import test from 'node:test'
import validation from '../../lib/authFormValidation.js'

const {
  buildPublicStudentSignUpOptions,
  prepareAuthSubmission,
  validateLoginForm,
  validatePasswordUpdateForm,
  validateRecoveryForm,
  validateRegistrationForm,
} = validation

async function submitScenario({ values, validate, gate, submit }) {
  const prepared = await prepareAuthSubmission({ values, validate, guard: gate })
  if (prepared.status !== 'ready') return { prepared, result: null }
  return { prepared, result: await submit(values) }
}

test('login form stops before network access when the entered values are invalid', async () => {
  let guardCalls = 0
  let submitCalls = 0
  const scenario = await submitScenario({
    values: { email: 'correo-invalido', password: '' },
    validate: validateLoginForm,
    gate: async () => { guardCalls += 1; return { allowed: true } },
    submit: async () => { submitCalls += 1; return { ok: true } },
  })

  assert.equal(scenario.prepared.status, 'validation_error')
  assert.equal(guardCalls, 0)
  assert.equal(submitCalls, 0)
  assert.ok(scenario.prepared.errors.email)
  assert.ok(scenario.prepared.errors.password)
})

test('a blocked login attempt never reaches the authentication backend', async () => {
  let submitCalls = 0
  const scenario = await submitScenario({
    values: { email: 'student@example.com', password: 'Correcta1!' },
    validate: validateLoginForm,
    gate: async () => ({ allowed: false, retryAfterSeconds: 420 }),
    submit: async () => { submitCalls += 1; return { ok: true } },
  })

  assert.equal(scenario.prepared.status, 'rate_limited')
  assert.equal(scenario.prepared.retryAfterSeconds, 420)
  assert.equal(submitCalls, 0)
})

test('valid student registration executes the mocked submit and cannot request a staff role', async () => {
  let submittedOptions
  const values = {
    alias: '  Nova  ',
    email: 'nova@example.com',
    password: 'Segura1!',
    confirmPassword: 'Segura1!',
  }
  const scenario = await submitScenario({
    values,
    validate: validateRegistrationForm,
    gate: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    submit: async (form) => {
      submittedOptions = buildPublicStudentSignUpOptions(form.alias, 'https://example.com/login')
      return { user: { id: 'student-1' }, session: null }
    },
  })

  assert.equal(scenario.prepared.status, 'ready')
  assert.equal(scenario.result.session, null)
  assert.deepEqual(submittedOptions, {
    emailRedirectTo: 'https://example.com/login',
    data: { alias: 'Nova' },
  })
  assert.equal('role_id' in submittedOptions.data, false)
})

test('recovery accepts a valid email while password update rejects mismatched values', () => {
  assert.deepEqual(validateRecoveryForm({ email: 'student@example.com' }), {})
  const errors = validatePasswordUpdateForm({
    password: 'Segura1!',
    confirmPassword: 'Segura2!',
  })
  assert.ok(errors.confirmPassword)
})

test('public and anonymous entry points keep server roles least privileged', async () => {
  const { readFile } = await import('node:fs/promises')
  const [migration, landing, rootLayout] = await Promise.all([
    readFile('supabase/migrations/20260728130000_public_auth_hardening.sql', 'utf8'),
    readFile('app/index.tsx', 'utf8'),
    readFile('app/_layout.tsx', 'utf8'),
  ])

  assert.match(migration, /when coalesce\(new\.is_anonymous, false\) then 'guest'/)
  assert.match(migration, /else 'student'/)
  assert.doesNotMatch(migration, /raw_user_meta_data->>'role_id'/)
  assert.match(landing, /rpc\('initialize_guest_profile'/)
  assert.doesNotMatch(landing, /from\('profiles'\)[\s\S]{0,160}upsert/)
  assert.doesNotMatch(rootLayout, /user_metadata\?\.role_id/)
  assert.doesNotMatch(rootLayout, /from\('profiles'\)[\s\S]{0,180}upsert/)
})

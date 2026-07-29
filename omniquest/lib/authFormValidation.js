/**
 * Pure authentication form rules shared by the UI and behavioural tests.
 * Keeping these rules free of React and Supabase makes it possible to test
 * complete submit scenarios with mocked network dependencies.
 */

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalizeEmail(email))
}

function getPasswordChecks(password) {
  const value = String(password || '')
  return {
    length: value.length >= 8,
    mixedCase: /[a-z]/.test(value) && /[A-Z]/.test(value),
    number: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  }
}

function isStrongPassword(password) {
  return Object.values(getPasswordChecks(password)).every(Boolean)
}

function validateLoginForm(values, messages = {}) {
  const errors = {}
  if (!isValidEmail(values.email)) errors.email = messages.invalidEmail || 'Introduce un correo electrónico válido.'
  if (!String(values.password || '')) errors.password = messages.requiredPassword || 'Introduce tu contraseña.'
  return errors
}

function validateRegistrationForm(values, messages = {}) {
  const errors = {}
  const alias = String(values.alias || '').trim()
  if (alias.length < 3) errors.alias = messages.aliasTooShort || 'El alias debe tener al menos 3 caracteres.'
  else if (alias.length > 30) errors.alias = messages.aliasTooLong || 'El alias no puede superar 30 caracteres.'
  if (!isValidEmail(values.email)) errors.email = messages.invalidEmail || 'Introduce un correo electrónico válido.'
  if (!isStrongPassword(values.password)) {
    errors.password = messages.weakPassword || 'Usa 8 caracteres e incluye mayúscula, minúscula, número y símbolo.'
  }
  if (!String(values.confirmPassword || '')) errors.confirmPassword = messages.confirmRequired || 'Repite tu contraseña.'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = messages.passwordMismatch || 'Las contraseñas no coinciden.'
  return errors
}

function validateRecoveryForm(values, messages = {}) {
  const errors = {}
  if (!isValidEmail(values.email)) errors.email = messages.invalidEmail || 'Introduce un correo electrónico válido.'
  return errors
}

function validatePasswordUpdateForm(values, messages = {}) {
  const errors = {}
  if (!isStrongPassword(values.password)) errors.password = messages.weakPassword || 'Elige una contraseña más segura antes de continuar.'
  if (!String(values.confirmPassword || '')) errors.confirmPassword = messages.confirmRequired || 'Repite la contraseña.'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = messages.passwordMismatch || 'Las contraseñas no coinciden.'
  return errors
}


function buildPublicStudentSignUpOptions(alias, emailRedirectTo) {
  return {
    emailRedirectTo,
    data: { alias: String(alias || '').trim().slice(0, 30) },
  }
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0
}

async function prepareAuthSubmission(options) {
  const errors = options.validate(options.values)
  if (hasErrors(errors)) return { status: 'validation_error', errors }

  const gate = await options.guard()
  if (!gate.allowed) {
    return {
      status: 'rate_limited',
      errors: {},
      retryAfterSeconds: Math.max(1, Number(gate.retryAfterSeconds || 1)),
    }
  }

  return { status: 'ready', errors: {}, retryAfterSeconds: 0 }
}

module.exports = {
  buildPublicStudentSignUpOptions,
  getPasswordChecks,
  hasErrors,
  isStrongPassword,
  isValidEmail,
  normalizeEmail,
  prepareAuthSubmission,
  validateLoginForm,
  validatePasswordUpdateForm,
  validateRecoveryForm,
  validateRegistrationForm,
}

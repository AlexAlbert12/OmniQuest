import { expect, type Page, type Response } from '@playwright/test'

export type AuthenticatedRole = 'student' | 'teacher' | 'admin'

type Credentials = { email: string; password: string }

type RoleConfiguration = Credentials & { homePath: RegExp }

const AUTH_ENV_NAMES = [
  'E2E_STUDENT_EMAIL',
  'E2E_STUDENT_PASSWORD',
  'E2E_TEACHER_EMAIL',
  'E2E_TEACHER_PASSWORD',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
] as const

export const E2E_FIXTURE = {
  courseName: process.env.E2E_COURSE_NAME || 'Curso E2E autenticado',
  topicName: process.env.E2E_TOPIC_NAME || 'Fundamentos E2E',
  questionText: process.env.E2E_QUESTION_TEXT || '¿Cuál es el resultado de 2 + 2?',
}

export function hasAuthenticatedE2EEnvironment() {
  return AUTH_ENV_NAMES.every((name) => Boolean(process.env[name]?.trim()))
}

export function getMissingAuthenticatedE2EEnvironment() {
  return AUTH_ENV_NAMES.filter((name) => !process.env[name]?.trim())
}

export function getRoleConfiguration(role: AuthenticatedRole): RoleConfiguration {
  const prefix = `E2E_${role.toUpperCase()}`
  return {
    email: requireEnvironment(`${prefix}_EMAIL`),
    password: requireEnvironment(`${prefix}_PASSWORD`),
    homePath: role === 'student' ? /\/homeStudent(?:\?|$)/ : role === 'teacher' ? /\/homeTeacher(?:\?|$)/ : /\/homeAdmin(?:\?|$)/,
  }
}

export async function loginAs(page: Page, role: AuthenticatedRole) {
  const credentials = getRoleConfiguration(role)
  await page.goto('/login')
  await page.getByTestId('login-email').fill(credentials.email)
  await page.getByTestId('login-password').fill(credentials.password)

  const tokenResponsePromise = page.waitForResponse((response) => response.url().includes('/auth/v1/token?grant_type=password') && response.request().method() === 'POST')
  await page.getByTestId('login-submit').click()
  const tokenResponse = await tokenResponsePromise

  expect(tokenResponse.ok(), `Auth rechazó el inicio de sesión de ${role}: ${tokenResponse.status()} ${await safeResponseText(tokenResponse)}`).toBeTruthy()
  await expect(page).toHaveURL(credentials.homePath, { timeout: 25_000 })
}

export function waitForSupabaseResponse(page: Page, matcher: string | RegExp | ((response: Response) => boolean)) {
  return page.waitForResponse((response) => {
    if (!response.url().includes('/rest/v1/') || response.request().method() === 'OPTIONS') return false
    if (typeof matcher === 'function') return matcher(response)
    return typeof matcher === 'string' ? response.url().includes(matcher) : matcher.test(response.url())
  })
}

export async function readSupabaseJson<T>(response: Response, label: string): Promise<T> {
  expect(response.ok(), `${label} devolvió ${response.status()}: ${await safeResponseText(response)}`).toBeTruthy()
  assertExpectedSupabaseOrigin(response)
  return await response.json() as T
}

export function rpcRequestHasArgument(response: Response, key: string, expected: unknown) {
  try {
    const payload = response.request().postDataJSON() as Record<string, unknown>
    return payload?.[key] === expected
  } catch {
    return false
  }
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`)
  return value
}

function assertExpectedSupabaseOrigin(response: Response) {
  const configuredUrl = (process.env.PLAYWRIGHT_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  if (configuredUrl) expect(response.url().startsWith(configuredUrl), `La prueba esperaba Supabase en ${configuredUrl}, pero recibió ${response.url()}`).toBeTruthy()
}

async function safeResponseText(response: Response) {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return '<sin cuerpo>'
  }
}

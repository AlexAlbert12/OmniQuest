import { expect, type APIResponse, type Page, type Response } from '@playwright/test'

export type AuthenticatedRole = 'student' | 'teacher' | 'admin'
export type AuthenticatedSession = { accessToken: string; apiKey: string; supabaseUrl: string; userId: string }

type Credentials = { email: string; password: string }
type RoleConfiguration = Credentials & { homePath: RegExp }
type JsonResponse = Pick<Response, 'json' | 'ok' | 'status' | 'text' | 'url'> | Pick<APIResponse, 'json' | 'ok' | 'status' | 'text' | 'url'>

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

export async function loginAs(page: Page, role: AuthenticatedRole): Promise<AuthenticatedSession> {
  const credentials = getRoleConfiguration(role)
  await page.addInitScript(() => window.localStorage.setItem('omniquest:locale', 'es-ES'))
  await page.goto('/login')
  await page.getByTestId('login-email').fill(credentials.email)
  await page.getByTestId('login-password').fill(credentials.password)

  const tokenResponsePromise = page.waitForResponse((response) => response.url().includes('/auth/v1/token?grant_type=password') && response.request().method() === 'POST')
  await page.getByTestId('login-submit').click()
  const tokenResponse = await tokenResponsePromise

  expect(tokenResponse.ok(), `Auth rechazó el inicio de sesión de ${role}: ${tokenResponse.status()} ${await safeResponseText(tokenResponse)}`).toBeTruthy()
  assertExpectedSupabaseOrigin(tokenResponse)
  const tokenPayload = await tokenResponse.json() as { access_token?: string; user?: { id?: string } }
  const apiKey = tokenResponse.request().headers().apikey
  const supabaseUrl = new URL(tokenResponse.url()).origin
  expect(tokenPayload.access_token, `Auth no devolvió access_token para ${role}.`).toBeTruthy()
  expect(tokenPayload.user?.id, `Auth no devolvió user.id para ${role}.`).toBeTruthy()
  expect(apiKey, `La petición de Auth no incluyó apikey para ${role}.`).toBeTruthy()
  await expect(page).toHaveURL(credentials.homePath, { timeout: 25_000 })
  return { accessToken: tokenPayload.access_token!, apiKey, supabaseUrl, userId: tokenPayload.user!.id! }
}

export async function clickRoleNavigation(page: Page, label: string, timeout = 20_000) {
  const deadline = Date.now() + timeout
  const candidates = [
    page.getByRole('link', { name: label, exact: true }),
    page.getByRole('tab', { name: label, exact: true }),
    page.getByRole('button', { name: label, exact: true }),
  ]

  while (Date.now() < deadline) {
    for (const locator of candidates) {
      for (let index = 0; index < await locator.count(); index += 1) {
        const candidate = locator.nth(index)
        if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
          await candidate.click()
          return
        }
      }
    }
    await page.waitForTimeout(100)
  }

  throw new Error(`No se encontró una navegación visible y habilitada con el nombre “${label}”.`)
}

export function waitForSupabaseResponse(page: Page, matcher: string | RegExp | ((response: Response) => boolean), timeout = 30_000) {
  return page.waitForResponse((response) => {
    if (!response.url().includes('/rest/v1/') || response.request().method() === 'OPTIONS') return false
    if (typeof matcher === 'function') return matcher(response)
    return typeof matcher === 'string' ? response.url().includes(matcher) : matcher.test(response.url())
  }, { timeout })
}

export async function supabaseSelect<T>(page: Page, session: AuthenticatedSession, table: string, query: Record<string, string>, label: string): Promise<T> {
  const url = new URL(`${session.supabaseUrl}/rest/v1/${table}`)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  const response = await page.request.get(url.toString(), { headers: authenticatedHeaders(session) })
  return readSupabaseJson<T>(response, label)
}

export async function supabaseRpc<T>(page: Page, session: AuthenticatedSession, functionName: string, args: Record<string, unknown>, label: string): Promise<T> {
  const response = await page.request.post(`${session.supabaseUrl}/rest/v1/rpc/${functionName}`, { headers: authenticatedHeaders(session), data: args })
  return readSupabaseJson<T>(response, label)
}

export async function readSupabaseJson<T>(response: JsonResponse, label: string): Promise<T> {
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

function authenticatedHeaders(session: AuthenticatedSession) {
  return { apikey: session.apiKey, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' }
}

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`)
  return value
}

function assertExpectedSupabaseOrigin(response: JsonResponse) {
  const configuredUrl = (process.env.PLAYWRIGHT_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  if (configuredUrl) expect(response.url().startsWith(configuredUrl), `La prueba esperaba Supabase en ${configuredUrl}, pero recibió ${response.url()}`).toBeTruthy()
}

async function safeResponseText(response: JsonResponse) {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return '<sin cuerpo>'
  }
}

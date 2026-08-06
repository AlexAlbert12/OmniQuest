import { expect, test } from '@playwright/test'
import { getRoleConfiguration, hasAuthenticatedE2EEnvironment, loginAs, readSupabaseJson, rpcRequestHasArgument, waitForSupabaseResponse } from './authenticated.helpers'

type AdminProfileRow = { alias: string | null; email: string | null; role_id: string; total_count?: number }
type AuditPolicy = { append_only?: boolean; partitioned?: boolean; strong_integrity?: boolean }
type IntegrityResult = { valid?: boolean; checked_rows?: number }

test.describe('administrador autenticado', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para ejecutar los recorridos autenticados.')

  test('inicia sesión, consulta usuarios desde Supabase y verifica la auditoría', async ({ page }) => {
    await loginAs(page, 'admin')
    const teacherEmail = getRoleConfiguration('teacher').email

    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()

    const teachersPromise = waitForSupabaseResponse(page, (response) => response.url().includes('/rest/v1/rpc/get_admin_profiles_page') && rpcRequestHasArgument(response, 'p_role', 'teacher'))
    await page.getByRole('link', { name: 'Abrir Profesores' }).click()
    const teachers = await readSupabaseJson<AdminProfileRow[]>(await teachersPromise, 'Directorio de profesores')

    expect(teachers.some((profile) => profile.email?.toLowerCase() === teacherEmail.toLowerCase() && profile.role_id === 'teacher')).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Profesores' })).toBeVisible()

    const policyPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_admin_audit_policy')
    await page.getByRole('link', { name: 'Abrir Auditoría' }).or(page.getByRole('tab', { name: 'Auditoría' })).click()
    const policy = await readSupabaseJson<AuditPolicy>(await policyPromise, 'Política de auditoría')

    expect(policy.append_only).toBe(true)
    expect(policy.partitioned).toBe(true)
    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible()

    const integrityPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/verify_admin_audit_chain')
    await page.getByRole('button', { name: 'Verificar cadena' }).click()
    const integrity = await readSupabaseJson<IntegrityResult>(await integrityPromise, 'Verificación de la cadena de auditoría')

    expect(integrity.valid).toBe(true)
    expect(Number(integrity.checked_rows || 0)).toBeGreaterThanOrEqual(0)
    await expect(page.getByText(/Cadena válida/i)).toBeVisible()
  })
})

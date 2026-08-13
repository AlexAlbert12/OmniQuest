import { expect, test } from '@playwright/test'
import { getRoleConfiguration, hasAuthenticatedE2EEnvironment, loginAs, readSupabaseJson, supabaseRpc, waitForSupabaseResponse } from './authenticated.helpers'

type AdminProfileRow = { alias: string | null; email: string | null; role_id: string; total_count?: number }
type AuditPolicy = { append_only?: boolean; partitioned?: boolean; strong_integrity?: boolean }
type IntegrityResult = { valid?: boolean; checked_rows?: number }

test.describe('administrador autenticado', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para ejecutar los recorridos autenticados.')

  test('inicia sesión, consulta usuarios desde Supabase y verifica la auditoría', async ({ page }) => {
    const session = await loginAs(page, 'admin')
    const teacherEmail = getRoleConfiguration('teacher').email
    const teachers = await supabaseRpc<AdminProfileRow[]>(page, session, 'get_admin_profiles_page', { p_role: 'teacher', p_search: '', p_subject_id: null, p_classroom_id: null, p_profile_id: null, p_active: null, p_activity_state: null, p_created_from: null, p_created_to: null, p_limit: 50, p_offset: 0 }, 'Directorio autenticado de profesores')

    expect(teachers.some((profile) => profile.email?.toLowerCase() === teacherEmail.toLowerCase() && profile.role_id === 'teacher')).toBeTruthy()
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()

    const auditNavigation = page.getByTestId('admin-nav-audit')
    await expect(auditNavigation).toBeVisible({ timeout: 60_000 })
    await auditNavigation.click()
    await expect(page).toHaveURL(/\/audit(?:\?|$)/)
    await expect(page.getByRole('heading', { name: 'Auditoría', exact: true })).toBeVisible()
    const policy = await supabaseRpc<AuditPolicy>(page, session, 'get_admin_audit_policy', {}, 'Política autenticada de auditoría')

    expect(policy.append_only).toBe(true)
    expect(policy.partitioned).toBe(true)

    const integrityPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/verify_admin_audit_chain')
    await page.getByRole('button', { name: 'Verificar integridad' }).click()
    const integrity = await readSupabaseJson<IntegrityResult>(await integrityPromise, 'Verificación de la cadena de auditoría')

    expect(integrity.valid).toBe(true)
    expect(Number(integrity.checked_rows || 0)).toBeGreaterThanOrEqual(0)
    await expect(page.getByText(/Integridad correcta/i)).toBeVisible()
  })
})

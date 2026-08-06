import { expect, test } from '@playwright/test'
import { E2E_FIXTURE, escapeRegExp, hasAuthenticatedE2EEnvironment, loginAs, readSupabaseJson, waitForSupabaseResponse } from './authenticated.helpers'

type TeacherCoursePage = { items: { id: number; name: string }[]; total: number }
type TeacherSubjectOverview = { subject: { id: number; name: string }; classrooms: { id: number; name: string }[] }

test.describe('profesor autenticado', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para ejecutar los recorridos autenticados.')

  test('inicia sesión, abre un curso obtenido de Supabase y accede al editor', async ({ page }) => {
    await loginAs(page, 'teacher')

    const coursesPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_teacher_courses_page')
    await page.goto('/classes')
    const coursesPage = await readSupabaseJson<TeacherCoursePage>(await coursesPromise, 'Catálogo de cursos del profesor')
    const fixtureCourse = coursesPage.items.find((course) => course.name === E2E_FIXTURE.courseName)

    expect(coursesPage.total).toBeGreaterThan(0)
    expect(fixtureCourse, `No se encontró el curso ${E2E_FIXTURE.courseName}.`).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Cursos y clases' })).toBeVisible()

    const overviewPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_teacher_subject_overview')
    await page.getByRole('button', { name: new RegExp(`^Gestionar ${escapeRegExp(E2E_FIXTURE.courseName)}$`, 'i') }).first().click()
    const overview = await readSupabaseJson<TeacherSubjectOverview>(await overviewPromise, 'Detalle del curso del profesor')

    expect(overview.subject.name).toBe(E2E_FIXTURE.courseName)
    expect(overview.classrooms.length).toBeGreaterThan(0)
    await expect(page.getByRole('heading', { name: E2E_FIXTURE.courseName })).toBeVisible()

    await page.getByRole('link', { name: 'Añadir pregunta' }).click()
    await expect(page).toHaveURL(/\/subject\/add-question(?:\?|$)/)
    await expect(page.getByRole('heading', { name: 'Nueva pregunta' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Opción múltiple\./i })).toBeVisible()
  })
})

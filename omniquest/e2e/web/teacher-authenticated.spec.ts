import { expect, test } from '@playwright/test'
import { E2E_FIXTURE, escapeRegExp, hasAuthenticatedE2EEnvironment, loginAs, readSupabaseJson, supabaseRpc, waitForSupabaseResponse } from './authenticated.helpers'

type TeacherCoursePage = { items: { id: number; name: string }[]; total: number }
type TeacherSubjectOverview = { subject: { id: number; name: string }; classrooms: { id: number; name: string }[] }
type TeacherQuestionPage = { items: unknown[]; total: number }

test.describe('profesor autenticado', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para ejecutar los recorridos autenticados.')

  test('inicia sesión, abre un curso obtenido de Supabase y accede al editor', async ({ page }) => {
    const session = await loginAs(page, 'teacher')
    const coursesPage = await supabaseRpc<TeacherCoursePage>(page, session, 'get_teacher_courses_page', { p_search: '', p_status: null, p_sort: 'recent', p_limit: 12, p_offset: 0 }, 'Catálogo autenticado de cursos del profesor')
    const selectedCourse = coursesPage.items.find((course) => course.name === E2E_FIXTURE.courseName) ?? coursesPage.items[0]

    expect(coursesPage.total).toBeGreaterThan(0)
    expect(selectedCourse, 'La cuenta docente no tiene ningún curso accesible para el recorrido autenticado.').toBeTruthy()
    const course = selectedCourse!

    const coursesNavigation = page.getByTestId('teacher-nav-classes')
    await expect(coursesNavigation).toBeVisible({ timeout: 60_000 })
    await coursesNavigation.click()
    await expect(page).toHaveURL(/\/classes(?:\?|$)/)
    await expect(page.getByRole('heading', { name: /^Cursos(?: y clases)?$/ })).toBeVisible()

    const courseButton = page.getByRole('button', { name: new RegExp(`^Abrir curso ${escapeRegExp(course.name)}$`, 'i') }).first()
    await expect(courseButton).toBeVisible()
    const overviewPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_teacher_subject_overview')
    await courseButton.click()
    const overview = await readSupabaseJson<TeacherSubjectOverview>(await overviewPromise, 'Detalle del curso del profesor')

    expect(overview.subject.id).toBe(course.id)
    expect(overview.subject.name).toBe(course.name)
    expect(overview.classrooms.length).toBeGreaterThan(0)
    await expect(page.getByRole('heading', { name: course.name })).toBeVisible()

    const questionsPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_teacher_subject_questions_page')
    await page.getByRole('tab', { name: 'Preguntas', exact: true }).click()
    const questions = await readSupabaseJson<TeacherQuestionPage>(await questionsPromise, 'Preguntas del curso del profesor')

    expect(Array.isArray(questions.items)).toBeTruthy()
    expect(questions.total).toBeGreaterThanOrEqual(0)
    const addQuestionButton = page.getByRole('button', { name: 'Añadir pregunta', exact: true })
    await expect(addQuestionButton).toBeVisible()
    await addQuestionButton.click()
    await expect(page).toHaveURL(/\/subject\/add-question(?:\?|$)/)
    await expect(page.getByRole('heading', { name: 'Nueva pregunta' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Opción múltiple\./i })).toBeVisible()
  })
})

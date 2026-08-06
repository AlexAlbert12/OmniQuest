import { expect, test } from '@playwright/test'
import { E2E_FIXTURE, escapeRegExp, firstRelation, hasAuthenticatedE2EEnvironment, loginAs, readSupabaseJson, waitForSupabaseResponse } from './authenticated.helpers'

type EnrollmentRow = { classroom_id: number | null; subjects: { id: number; name: string } | { id: number; name: string }[] | null }
type TopicRow = { id: number; title: string }
type SafeQuestion = { id: number; text: string }

test.describe('alumno autenticado', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para ejecutar los recorridos autenticados.')

  test('inicia sesión, carga sus cursos desde Supabase y abre una partida', async ({ page }) => {
    await loginAs(page, 'student')

    const enrollmentsPromise = waitForSupabaseResponse(page, (response) => response.request().method() === 'GET' && response.url().includes('/rest/v1/enrollments?') && response.url().includes('subjects'))
    await page.goto('/classes')
    const enrollments = await readSupabaseJson<EnrollmentRow[]>(await enrollmentsPromise, 'Carga de matrículas del alumno')
    const fixtureEnrollment = enrollments.find((row) => firstRelation(row.subjects)?.name === E2E_FIXTURE.courseName)

    expect(fixtureEnrollment, `No se encontró la matrícula del curso ${E2E_FIXTURE.courseName}.`).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible()

    const topicsPromise = waitForSupabaseResponse(page, (response) => response.url().includes('/rest/v1/subject_topics?') && response.url().includes('title'))
    await page.getByRole('button', { name: new RegExp(`^Abrir(?: curso)? ${escapeRegExp(E2E_FIXTURE.courseName)}$`, 'i') }).first().click()
    const topics = await readSupabaseJson<TopicRow[]>(await topicsPromise, 'Carga de temas del curso')
    const fixtureTopic = topics.find((topic) => topic.title === E2E_FIXTURE.topicName)

    expect(fixtureTopic, `No se encontró el tema ${E2E_FIXTURE.topicName}.`).toBeTruthy()
    await expect(page.getByText(E2E_FIXTURE.courseName, { exact: true }).first()).toBeVisible()

    const questionsPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_safe_game_questions')
    const attemptPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/start_game_attempt')
    await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(E2E_FIXTURE.topicName)}\\. (?:Siguiente misión|Disponible|Completado)$`, 'i') }).first().click()

    const questions = await readSupabaseJson<SafeQuestion[]>(await questionsPromise, 'Carga segura de preguntas')
    const attemptId = await readSupabaseJson<string>(await attemptPromise, 'Inicio de partida')

    expect(questions.some((question) => question.text === E2E_FIXTURE.questionText)).toBeTruthy()
    expect(attemptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    await expect(page.getByText(E2E_FIXTURE.questionText, { exact: true })).toBeVisible()
  })
})

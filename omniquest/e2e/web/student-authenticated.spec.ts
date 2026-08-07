import { expect, test } from '@playwright/test'
import { E2E_FIXTURE, firstRelation, hasAuthenticatedE2EEnvironment, loginAs, readSupabaseJson, supabaseSelect, waitForSupabaseResponse } from './authenticated.helpers'

type EnrollmentRow = { classroom_id: number | null; subject_id: number; subjects: { id: number; name: string } | { id: number; name: string }[] | null }
type TopicRow = { id: number; title: string }
type SafeQuestion = { id: number; text: string }

test.describe('alumno autenticado', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para ejecutar los recorridos autenticados.')

  test('inicia sesión, carga sus cursos desde Supabase y abre una partida', async ({ page }) => {
    const session = await loginAs(page, 'student')
    const enrollments = await supabaseSelect<EnrollmentRow[]>(page, session, 'enrollments', { select: 'student_id,subject_id,classroom_id,subjects(id,name)', student_id: `eq.${session.userId}`, order: 'joined_at.desc' }, 'Matrículas autenticadas del alumno')
    const fixtureEnrollment = enrollments.find((row) => firstRelation(row.subjects)?.name === E2E_FIXTURE.courseName)

    expect(fixtureEnrollment, `No se encontró la matrícula del curso ${E2E_FIXTURE.courseName}.`).toBeTruthy()
    expect(fixtureEnrollment?.subject_id).toBeGreaterThan(0)
    expect(fixtureEnrollment?.classroom_id).toBeGreaterThan(0)

    const coursesNavigation = page.getByTestId('student-nav-classes')
    await expect(coursesNavigation).toBeVisible({ timeout: 60_000 })
    await coursesNavigation.click()
    await expect(page).toHaveURL(/\/classes(?:\?|$)/)
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible()
    const subjectId = fixtureEnrollment!.subject_id
    const classroomId = fixtureEnrollment!.classroom_id!
    const courseAction = page.getByTestId(`student-course-${subjectId}-${classroomId}`)
    await expect(courseAction).toBeVisible({ timeout: 30_000 })
    const topics = await supabaseSelect<TopicRow[]>(page, session, 'subject_topics', { select: 'id,title', subject_id: `eq.${subjectId}`, classroom_id: `eq.${classroomId}`, title: `eq.${E2E_FIXTURE.topicName}` }, 'Temas autenticados del curso')
    const fixtureTopic = topics.find((topic) => topic.title === E2E_FIXTURE.topicName)

    expect(fixtureTopic, `No se encontró el tema ${E2E_FIXTURE.topicName}.`).toBeTruthy()
    await courseAction.click()
    await expect(page).toHaveURL(new RegExp(`/class/${subjectId}(?:\\?|$)`))
    await expect(page.getByRole('heading', { name: E2E_FIXTURE.courseName })).toBeVisible()

    const topicButton = page.getByTestId(`student-topic-${fixtureTopic!.id}`)
    await expect(topicButton).toBeVisible()
    const questionsPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_safe_game_questions')
    const attemptPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/start_game_attempt')
    await topicButton.click()

    const questions = await readSupabaseJson<SafeQuestion[]>(await questionsPromise, 'Carga segura de preguntas')
    const attemptId = await readSupabaseJson<string>(await attemptPromise, 'Inicio de partida')

    expect(questions.some((question) => question.text === E2E_FIXTURE.questionText)).toBeTruthy()
    expect(attemptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    await expect(page.getByText(E2E_FIXTURE.questionText, { exact: true })).toBeVisible()
  })
})

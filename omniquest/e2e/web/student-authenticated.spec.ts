import { expect, test } from '@playwright/test'
import { E2E_FIXTURE, firstRelation, hasAuthenticatedE2EEnvironment, loginAs, readSupabaseJson, supabaseSelect, waitForSupabaseResponse } from './authenticated.helpers'

type EnrollmentRow = { classroom_id: number | null; subject_id: number; subjects: { id: number; name: string } | { id: number; name: string }[] | null }
type SafeQuestion = { id: number; text: string }
const DEMO_FALLBACK_COURSE = 'Fisioterapia'

test.describe('alumno autenticado', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para ejecutar los recorridos autenticados.')

  test('inicia sesión, carga sus cursos desde Supabase y abre una partida', async ({ page }) => {
    const session = await loginAs(page, 'student')
    const enrollments = await supabaseSelect<EnrollmentRow[]>(page, session, 'enrollments', { select: 'student_id,subject_id,classroom_id,subjects(id,name)', student_id: `eq.${session.userId}`, order: 'joined_at.desc' }, 'Matrículas autenticadas del alumno')
    const enrollment = enrollments.find((row) => firstRelation(row.subjects)?.name === E2E_FIXTURE.courseName)
      ?? enrollments.find((row) => firstRelation(row.subjects)?.name === DEMO_FALLBACK_COURSE)
      ?? enrollments.find((row) => row.subject_id > 0 && Boolean(row.classroom_id) && Boolean(firstRelation(row.subjects)?.name))
    if (!enrollment) throw new Error('La cuenta de alumno no tiene ninguna matrícula completa para ejecutar el recorrido autenticado.')
    const course = firstRelation(enrollment.subjects)
    if (!course || !enrollment.classroom_id) throw new Error('La matrícula seleccionada no contiene un curso y una clase válidos.')

    const coursesNavigation = page.getByTestId('student-nav-classes')
    await expect(coursesNavigation).toBeVisible({ timeout: 60_000 })
    await coursesNavigation.click()
    await expect(page).toHaveURL(/\/classes(?:\?|$)/)
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible()
    const subjectId = enrollment.subject_id
    const classroomId = enrollment.classroom_id
    const courseAction = page.getByTestId(`student-course-${subjectId}-${classroomId}`)
    await expect(courseAction).toBeVisible({ timeout: 30_000 })
    await courseAction.click()
    await expect(page).toHaveURL(new RegExp(`/class/${subjectId}(?:\\?|$)`))
    await expect(page.getByRole('heading', { name: course.name })).toBeVisible()

    const topicButton = page.locator('[data-testid^="student-topic-"]').first()
    await expect(topicButton, `El curso ${course.name} no contiene un tema jugable visible.`).toBeVisible()
    await topicButton.click()

    const playButton = page.getByRole('button', { name: /^(?:Empezar partida|Jugar de nuevo)$/ }).first()
    await expect(playButton).toBeVisible()
    const questionsPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/get_safe_game_questions_v2')
    const attemptPromise = waitForSupabaseResponse(page, '/rest/v1/rpc/start_game_attempt')
    await playButton.click()

    const questions = await readSupabaseJson<SafeQuestion[]>(await questionsPromise, 'Carga segura de preguntas')
    const attemptId = await readSupabaseJson<string>(await attemptPromise, 'Inicio de partida')

    expect(questions.length, 'La partida autenticada no devolvió preguntas seguras.').toBeGreaterThan(0)
    expect(attemptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    const visibleQuestion = questions.find((question) => question.text === E2E_FIXTURE.questionText) ?? questions[0]
    const questionPrompt = page.getByTestId('game-question-prompt')
    await expect(questionPrompt).toBeVisible()
    await expect(questionPrompt).toHaveText(visibleQuestion.text)
  })
})

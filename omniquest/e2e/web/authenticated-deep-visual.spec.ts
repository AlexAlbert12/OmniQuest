import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { hasAuthenticatedE2EEnvironment, loginAs } from './authenticated.helpers'

const STUDENT_DEMO_COURSE = 'Fisioterapia'
const STUDENT_DEMO_QUESTION = 'El calentamiento progresivo puede preparar al organismo para una actividad física posterior.'
const TEACHER_DEMO_COURSE = 'Matemáticas'
const ADMIN_DEMO_STUDENT = 'Lucía Martín'
const ADMIN_DEMO_STUDENT_EMAIL = 'alumno01@demo.omniquest.test'
const ADMIN_DEMO_TICKET = 'Duda sobre una pregunta de Matemáticas'

const SUPPORTED_PROJECTS = new Set(['chromium-desktop', 'chromium-mobile'])

test.describe('evidencia visual profunda autenticada', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para capturar los recorridos profundos.')

  test('student cubre curso, tema, partida, feedback correcto/incorrecto y resultado', async ({ page }, testInfo) => {
    test.setTimeout(360_000)
    test.skip(!SUPPORTED_PROJECTS.has(testInfo.project.name), 'Este recorrido final solo se captura en web desktop y web móvil.')

    await loginAs(page, 'student')
    await openRoleNavigation(page, 'student-nav-classes', 'Cursos del alumno')

    const course = page.locator('[data-testid^="student-course-"]').filter({ hasText: STUDENT_DEMO_COURSE }).first()
    await expect(course, `No se encontró el curso demo ${STUDENT_DEMO_COURSE}.`).toBeVisible({ timeout: 20_000 })
    await course.click()
    await waitForVisualReady(page)
    await captureEvidence(page, testInfo, 'deep-student-course-detail')

    await openFirstStudentTopic(page)
    await captureEvidence(page, testInfo, 'deep-student-topic-difficulty')
    await startFirstAvailableDifficulty(page)
    await waitForStudentDemoQuestion(page)
    await captureEvidence(page, testInfo, 'deep-student-game-question')

    await page.getByRole('radio', { name: /Opción .*: Verdadero/ }).click()
    await expect(page.getByText('¡Correcto!', { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-student-game-correct')

    await page.getByRole('button', { name: 'Siguiente pregunta', exact: true }).click()
    await expect(page.getByText(/¡Partida completada!|Partida terminada/, { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-student-game-result-correct')

    await page.getByRole('button', { name: 'Volver al curso', exact: true }).click()
    await waitForVisualReady(page)
    await openFirstStudentTopic(page)
    await startFirstAvailableDifficulty(page)
    await waitForStudentDemoQuestion(page)

    await page.getByRole('radio', { name: /Opción .*: Falso/ }).click()
    await expect(page.getByText('Incorrecto', { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-student-game-incorrect')

    await page.getByRole('button', { name: 'Siguiente pregunta', exact: true }).click()
    await expect(page.getByText(/¡Partida completada!|Partida terminada/, { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-student-game-result-incorrect')
  })

  test('teacher cubre creación no destructiva, importación y edición de contenido', async ({ page }, testInfo) => {
    test.setTimeout(360_000)
    test.skip(!SUPPORTED_PROJECTS.has(testInfo.project.name), 'Este recorrido final solo se captura en web desktop y web móvil.')

    await loginAs(page, 'teacher')
    await openRoleNavigation(page, 'teacher-nav-classes', 'Cursos del profesor')

    const createCourse = await findVisibleLocator(page.getByLabel('Crear curso', { exact: true }), 10_000)
    if (!createCourse) throw new Error('No se encontró el CTA Crear curso.')
    await createCourse.click()
    await expect(page.getByText('Nuevo curso', { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-teacher-create-course')
    await page.goBack()
    await waitForVisualReady(page)

    await openTeacherDemoCourse(page)
    await captureEvidence(page, testInfo, 'deep-teacher-course-detail')

    const classInput = page.getByLabel('Nombre de la nueva clase', { exact: true })
    await expect(classInput).toBeVisible({ timeout: 20_000 })
    await classInput.fill('Clase de evidencia visual (sin guardar)')
    await captureEvidence(page, testInfo, 'deep-teacher-create-class')
    await classInput.fill('')

    await selectTeacherSubjectTab(page, 'Temas')
    const topicInput = page.getByLabel('Título del nuevo tema', { exact: true })
    await expect(topicInput).toBeVisible({ timeout: 20_000 })
    await topicInput.scrollIntoViewIfNeeded()
    await topicInput.fill('Tema de evidencia visual (sin guardar)')
    await captureEvidence(page, testInfo, 'deep-teacher-create-topic')
    await topicInput.fill('')

    await selectTeacherSubjectTab(page, 'Preguntas')
    const addQuestion = page.getByRole('button', { name: 'Añadir pregunta', exact: true })
    await expect(addQuestion).toBeVisible({ timeout: 20_000 })
    await addQuestion.click()
    await expect(page.getByText('Nueva pregunta', { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-teacher-create-question')
    await page.goBack()
    await waitForVisualReady(page)

    await selectTeacherSubjectTab(page, 'Alumnos')
    const importStudents = await findVisibleLocator(page.getByRole('button', { name: 'Importar alumnos', exact: true }), 15_000)
    if (!importStudents) throw new Error('No se encontró el CTA Importar alumnos en el curso demo.')
    await importStudents.click()
    const closeImport = await findVisibleLocator(page.getByRole('button', { name: 'Cerrar importación de alumnos', exact: true }), 20_000)
    if (!closeImport) throw new Error('No se abrió correctamente la importación de alumnos.')
    await captureEvidence(page, testInfo, 'deep-teacher-import-students')
    await closeImport.click()

    await selectTeacherSubjectTab(page, 'Preguntas')
    const editQuestion = await findVisibleLocator(page.getByRole('button', { name: /Editar pregunta:/ }), 20_000)
    if (!editQuestion) throw new Error('No se encontró una pregunta editable en el curso demo.')
    await editQuestion.click()
    await expect(page.getByText('Editar pregunta', { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-teacher-edit-content')
  })

  test('admin cubre ticket, permisos y detalle/actividad de usuario', async ({ page }, testInfo) => {
    test.setTimeout(300_000)
    test.skip(!SUPPORTED_PROJECTS.has(testInfo.project.name), 'Este recorrido final solo se captura en web desktop y web móvil.')

    await loginAs(page, 'admin')

    await page.goto('/support')
    await waitForVisualReady(page)
    const ticketSearch = page.getByLabel('Buscar tickets...', { exact: true })
    await expect(ticketSearch).toBeVisible({ timeout: 20_000 })
    await ticketSearch.fill(ADMIN_DEMO_TICKET)
    await expect(page.getByText(ADMIN_DEMO_TICKET, { exact: true })).toBeVisible({ timeout: 20_000 })
    const manageTicket = page.getByRole('button', { name: `Gestionar ticket ${ADMIN_DEMO_TICKET}`, exact: true })
    await expect(manageTicket).toBeVisible({ timeout: 20_000 })
    await manageTicket.click()
    await expect(page.getByText(/Gestionar ticket #/).first()).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-admin-ticket-detail')

    await page.goto('/profile')
    await waitForVisualReady(page)
    const permissionsButton = await findVisibleLocator(page.getByRole('button', { name: /Permisos: .*Ver permisos asignados/ }), 15_000)
    if (!permissionsButton) throw new Error('No se encontró el acceso al detalle de permisos del administrador.')
    await permissionsButton.click()
    await expect(page.getByTestId('admin-profile-permissions-sheet')).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-admin-permissions-modal')
    const closePermissions = await findVisibleLocator(page.getByRole('button', { name: 'Cerrar', exact: true }), 8_000)
    if (closePermissions) await closePermissions.click()

    await page.goto('/students')
    await waitForVisualReady(page)
    const studentSearch = page.getByLabel('Buscar alumno por nombre o correo...', { exact: true })
    await expect(studentSearch).toBeVisible({ timeout: 20_000 })
    await studentSearch.fill(ADMIN_DEMO_STUDENT_EMAIL)
    await expect(page.getByText(ADMIN_DEMO_STUDENT, { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-admin-user-details')

    const actionsButton = await findVisibleLocator(page.getByRole('button', { name: /^(Gestionar|Acciones)$/ }), 15_000)
    if (!actionsButton) throw new Error('No se encontró el menú de acciones del usuario demo.')
    await actionsButton.click()
    const viewActivity = page.getByText('Ver actividad', { exact: true }).last()
    await expect(viewActivity).toBeVisible({ timeout: 10_000 })
    await viewActivity.click()
    await expect(page.getByText(`Actividad de ${ADMIN_DEMO_STUDENT}`, { exact: true })).toBeVisible({ timeout: 20_000 })
    await captureEvidence(page, testInfo, 'deep-admin-user-activity')
  })
})

async function openFirstStudentTopic(page: Page) {
  const topic = await findVisibleLocator(page.locator('[data-testid^="student-topic-"]'), 20_000)
  if (!topic) throw new Error('No se encontró un tema visible dentro del curso demo.')
  await topic.click()
  const chooser = await findVisibleOnlyLocator(page.getByText(/¿Qué quieres hacer\?/), 20_000)
  if (!chooser) throw new Error('No se abrió el selector de dificultad del tema demo.')
}

async function startFirstAvailableDifficulty(page: Page) {
  const play = await findVisibleLocator(page.getByRole('button', { name: /Jugar de nuevo|Empezar partida/ }), 20_000)
  if (!play) throw new Error('No se encontró una dificultad jugable para el tema demo.')
  await play.click()
}

async function waitForStudentDemoQuestion(page: Page) {
  const question = await findVisibleOnlyLocator(page.getByText(STUDENT_DEMO_QUESTION, { exact: true }), 30_000)
  if (!question) throw new Error('No se encontró visible la pregunta demo dentro de la partida.')
}

async function openTeacherDemoCourse(page: Page) {
  const course = await findVisibleLocator(page.getByRole('button', { name: `Abrir curso ${TEACHER_DEMO_COURSE}`, exact: true }), 20_000)
  if (!course) throw new Error(`No se encontró el curso docente ${TEACHER_DEMO_COURSE}.`)
  await course.click()
  await waitForVisualReady(page)
  const courseDetail = await findVisibleOnlyLocator(page.getByLabel(`Curso ${TEACHER_DEMO_COURSE}`, { exact: true }), 20_000)
  const visibleTitle = courseDetail ? null : await findVisibleOnlyLocator(page.getByText(TEACHER_DEMO_COURSE, { exact: true }), 20_000)
  if (!courseDetail && !visibleTitle) throw new Error(`No se abrió correctamente el detalle del curso ${TEACHER_DEMO_COURSE}.`)
}

async function selectTeacherSubjectTab(page: Page, name: 'Temas' | 'Preguntas' | 'Alumnos') {
  const tab = await findVisibleLocator(page.getByRole('tab', { name, exact: true }), 15_000)
  if (!tab) {
    await page.evaluate(() => {
      const root = document.scrollingElement
      if (root) root.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        if (element.scrollTop > 0) element.scrollTop = 0
      }
    })
  }
  const resolved = tab || await findVisibleLocator(page.getByRole('tab', { name, exact: true }), 8_000)
  if (!resolved) throw new Error(`No se encontró la pestaña docente ${name}.`)
  await resolved.click()
  await waitForVisualReady(page)
}

async function openRoleNavigation(page: Page, testID: string, destinationLabel: string) {
  const navigation = await findVisibleLocator(page.getByTestId(testID), 12_000)
  if (!navigation) throw new Error(`No se encontró la navegación ${destinationLabel} (${testID}).`)
  await navigation.click()
  await waitForVisualReady(page)
}


async function findVisibleOnlyLocator(locator: Locator, timeout: number): Promise<Locator | null> {
  const deadline = Date.now() + timeout
  while (Date.now() <= deadline) {
    const count = await locator.count()
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index)
      if (await candidate.isVisible().catch(() => false)) return candidate
    }
    await new Promise((resolve) => setTimeout(resolve, 75))
  }
  return null
}

async function findVisibleLocator(locator: Locator, timeout: number): Promise<Locator | null> {
  const deadline = Date.now() + timeout
  while (Date.now() <= deadline) {
    const count = await locator.count()
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index)
      if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) return candidate
    }
    await new Promise((resolve) => setTimeout(resolve, 75))
  }
  return null
}

async function waitForVisualReady(page: Page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 30_000 })
  const blockingLoaders = page.locator('[role="progressbar"]:visible:not([aria-label="Progreso de la partida"])')
  await expect(blockingLoaders, 'La pantalla sigue mostrando un loader bloqueante.').toHaveCount(0, { timeout: 45_000 })
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready
  }).catch(() => undefined)
  await page.waitForTimeout(650)
}

async function captureEvidence(page: Page, testInfo: TestInfo, name: string) {
  await waitForVisualReady(page)
  await setPrimaryScrollFraction(page, 0)

  const diagnostics = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    const viewportWidth = root.clientWidth
    const documentWidth = Math.max(root.scrollWidth, body.scrollWidth)
    return {
      documentWidth,
      horizontalOverflow: Math.max(0, documentWidth - viewportWidth),
      pathname: window.location.pathname,
      viewportHeight: root.clientHeight,
      viewportWidth,
    }
  })

  expect(diagnostics.horizontalOverflow, `${name} desborda horizontalmente ${diagnostics.horizontalOverflow}px en ${testInfo.project.name}`).toBeLessThanOrEqual(1)
  await attachScreenshot(page, testInfo, name, true)

  const scroll = await getPrimaryScrollDiagnostics(page)
  if (scroll.maxScroll > 240) {
    await setPrimaryScrollFraction(page, 0.5)
    await page.waitForTimeout(180)
    await attachScreenshot(page, testInfo, `${name}-middle`, false)

    await setPrimaryScrollFraction(page, 1)
    await page.waitForTimeout(180)
    await attachScreenshot(page, testInfo, `${name}-bottom`, false)
    await setPrimaryScrollFraction(page, 0)
  }

  await testInfo.attach(`${name}-${testInfo.project.name}-layout`, {
    body: Buffer.from(JSON.stringify({ ...diagnostics, primaryScroll: scroll }, null, 2)),
    contentType: 'application/json',
  })
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string, fullPage: boolean) {
  const screenshotPath = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage, animations: 'disabled', caret: 'hide' })
  await testInfo.attach(`${name}-${testInfo.project.name}`, { path: screenshotPath, contentType: 'image/png' })
}

async function getPrimaryScrollDiagnostics(page: Page) {
  return page.evaluate(() => {
    const viewportArea = window.innerWidth * window.innerHeight
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight)
        const area = Math.max(0, rect.width) * Math.max(0, rect.height)
        const eligibleOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll'
        const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        const primarySize = area >= viewportArea * 0.25
        return { element, maxScroll, area, eligibleOverflow, visible, primarySize }
      })
      .filter((item) => item.maxScroll > 40 && item.visible && (item.eligibleOverflow || item.primarySize))
      .sort((a, b) => (b.maxScroll * Math.max(1, b.area)) - (a.maxScroll * Math.max(1, a.area)))

    const target = candidates[0]
    if (target) return { kind: 'element' as const, maxScroll: target.maxScroll, scrollTop: target.element.scrollTop }

    const root = document.scrollingElement
    const maxScroll = root ? Math.max(0, root.scrollHeight - window.innerHeight) : 0
    return { kind: 'window' as const, maxScroll, scrollTop: root?.scrollTop || window.scrollY }
  })
}

async function setPrimaryScrollFraction(page: Page, fraction: number) {
  await page.evaluate((targetFraction) => {
    const viewportArea = window.innerWidth * window.innerHeight
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight)
        const area = Math.max(0, rect.width) * Math.max(0, rect.height)
        const eligibleOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll'
        const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        const primarySize = area >= viewportArea * 0.25
        return { element, maxScroll, area, eligibleOverflow, visible, primarySize }
      })
      .filter((item) => item.maxScroll > 40 && item.visible && (item.eligibleOverflow || item.primarySize))
      .sort((a, b) => (b.maxScroll * Math.max(1, b.area)) - (a.maxScroll * Math.max(1, a.area)))

    const target = candidates[0]
    if (target) {
      target.element.scrollTo({ top: Math.round(target.maxScroll * targetFraction), behavior: 'instant' as ScrollBehavior })
      return
    }

    const root = document.scrollingElement
    const maxScroll = root ? Math.max(0, root.scrollHeight - window.innerHeight) : 0
    window.scrollTo({ top: Math.round(maxScroll * targetFraction), behavior: 'instant' })
  }, Math.max(0, Math.min(1, fraction)))
}

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { hasAuthenticatedE2EEnvironment, loginAs, type AuthenticatedRole } from './authenticated.helpers'

type NavigationTarget = { id: string; name: string; fallbackPath?: string }
type AdminLinkTarget = { label: string; name: string; path: string }

const PRIMARY_NAVIGATION: Record<AuthenticatedRole, NavigationTarget[]> = {
  student: [
    { id: 'student-nav-classes', name: 'student-courses', fallbackPath: '/classes' },
    { id: 'student-nav-progress', name: 'student-progress', fallbackPath: '/progress' },
    { id: 'student-nav-ranking', name: 'student-ranking', fallbackPath: '/ranking' },
  ],
  teacher: [
    { id: 'teacher-nav-classes', name: 'teacher-courses', fallbackPath: '/classes' },
    { id: 'teacher-nav-students', name: 'teacher-students', fallbackPath: '/students' },
    { id: 'teacher-nav-reviews', name: 'teacher-reviews', fallbackPath: '/reviews' },
  ],
  admin: [
    { id: 'admin-nav-users', name: 'admin-users', fallbackPath: '/users' },
    { id: 'admin-nav-content', name: 'admin-content', fallbackPath: '/content' },
    { id: 'admin-nav-audit', name: 'admin-audit', fallbackPath: '/audit' },
    { id: 'admin-nav-more', name: 'admin-more', fallbackPath: '/more' },
  ],
}

const STUDENT_MORE_TARGETS: NavigationTarget[] = [
  { id: 'student-more-profile', name: 'student-profile' },
  { id: 'student-more-activity', name: 'student-activity' },
  { id: 'student-more-badges', name: 'student-badges' },
  { id: 'student-more-notifications', name: 'student-notifications' },
  { id: 'student-more-settings', name: 'student-settings' },
  { id: 'student-more-security', name: 'student-security' },
  { id: 'student-more-help', name: 'student-help' },
]

const TEACHER_MORE_TARGETS: NavigationTarget[] = [
  { id: 'teacher-more-profile', name: 'teacher-profile' },
  { id: 'teacher-more-settings', name: 'teacher-settings' },
  { id: 'teacher-more-security', name: 'teacher-security' },
  { id: 'teacher-more-audit', name: 'teacher-audit' },
  { id: 'teacher-more-notifications', name: 'teacher-notifications' },
  { id: 'teacher-more-help', name: 'teacher-help' },
]

const STUDENT_DESKTOP_TARGETS: NavigationTarget[] = [
  { id: 'student-nav-badges', name: 'student-badges' },
  { id: 'student-nav-notifications', name: 'student-notifications' },
  { id: 'student-nav-profile', name: 'student-profile' },
  { id: 'student-nav-settings', name: 'student-settings' },
]

const TEACHER_DESKTOP_TARGETS: NavigationTarget[] = [
  { id: 'teacher-nav-audit', name: 'teacher-audit' },
  { id: 'teacher-nav-notifications', name: 'teacher-notifications' },
  { id: 'teacher-nav-profile', name: 'teacher-profile' },
  { id: 'teacher-nav-settings', name: 'teacher-settings' },
]

const ADMIN_MORE_LINKS: AdminLinkTarget[] = [
  { label: 'Soporte', name: 'admin-support', path: '/support' },
  { label: 'Notificaciones push', name: 'admin-push', path: '/push' },
  { label: 'Exportaciones', name: 'admin-exports', path: '/exports' },
  { label: 'Administración y permisos', name: 'admin-permissions', path: '/permissions' },
  { label: 'Perfil', name: 'admin-profile', path: '/profile' },
  { label: 'Seguridad de la cuenta', name: 'admin-security', path: '/security' },
]

const ADMIN_DESKTOP_DIRECT_TARGETS = [
  { name: 'admin-teachers', path: '/teachers' },
  { name: 'admin-students', path: '/students' },
  { name: 'admin-courses', path: '/courses' },
  { name: 'admin-classrooms', path: '/classrooms' },
]

test.describe('matriz visual autenticada', () => {
  test.skip(!hasAuthenticatedE2EEnvironment(), 'Define las seis variables E2E_* para capturar las pantallas autenticadas.')

  for (const role of ['student', 'teacher', 'admin'] as const) {
    test(`${role} mantiene una composición estable en toda la navegación principal`, async ({ page }, testInfo) => {
      test.setTimeout(240_000)
      await loginAs(page, role)
      await waitForVisualReady(page)
      await captureScreen(page, testInfo, `${role}-home`)

      for (const target of PRIMARY_NAVIGATION[role]) await navigateAndCapture(page, testInfo, target)

      if (role === 'student') await captureStudentSecondaryScreens(page, testInfo)
      if (role === 'teacher') await captureTeacherSecondaryScreens(page, testInfo)
      if (role === 'admin') await captureAdminSecondaryScreens(page, testInfo)
    })
  }
})

async function captureStudentSecondaryScreens(page: Page, testInfo: TestInfo) {
  if (await hasVisibleTestId(page, 'student-nav-more')) {
    await navigateAndCapture(page, testInfo, { id: 'student-nav-more', name: 'student-more', fallbackPath: '/more' })
    for (const target of STUDENT_MORE_TARGETS) {
      await navigateAndCapture(page, testInfo, target)
      await openWithoutCapture(page, 'student-nav-more', '/more')
    }
    return
  }

  for (const target of STUDENT_DESKTOP_TARGETS) await navigateAndCapture(page, testInfo, target)
}

async function captureTeacherSecondaryScreens(page: Page, testInfo: TestInfo) {
  if (await hasVisibleTestId(page, 'teacher-nav-more')) {
    await navigateAndCapture(page, testInfo, { id: 'teacher-nav-more', name: 'teacher-more', fallbackPath: '/more' })
    for (const target of TEACHER_MORE_TARGETS) {
      await navigateAndCapture(page, testInfo, target)
      await openWithoutCapture(page, 'teacher-nav-more', '/more')
    }
    return
  }

  for (const target of TEACHER_DESKTOP_TARGETS) await navigateAndCapture(page, testInfo, target)
}

async function captureAdminSecondaryScreens(page: Page, testInfo: TestInfo) {
  await openWithoutCapture(page, 'admin-nav-more', '/more')
  for (const target of ADMIN_MORE_LINKS) {
    const link = await findVisibleLocator(page.getByRole('link', { name: `Abrir ${target.label}`, exact: true }), 1_500)
    if (link) {
      await link.click()
      await waitForVisualReady(page)
    } else {
      await page.goto(target.path)
      await waitForVisualReady(page)
    }
    await captureScreen(page, testInfo, target.name)
    await openWithoutCapture(page, 'admin-nav-more', '/more')
  }

  if (testInfo.project.name === 'chromium-desktop') {
    for (const target of ADMIN_DESKTOP_DIRECT_TARGETS) {
      await page.goto(target.path)
      await waitForVisualReady(page)
      await captureScreen(page, testInfo, target.name)
    }
  }
}

async function navigateAndCapture(page: Page, testInfo: TestInfo, target: NavigationTarget) {
  await openWithoutCapture(page, target.id, target.fallbackPath)
  await captureScreen(page, testInfo, target.name)
}

async function openWithoutCapture(page: Page, testID: string, fallbackPath?: string) {
  const navigation = await findVisibleLocator(page.getByTestId(testID), 5_000)
  if (navigation) {
    await navigation.click()
    await waitForVisualReady(page)
    return
  }

  if (fallbackPath) {
    await page.goto(fallbackPath)
    await waitForVisualReady(page)
    return
  }

  throw new Error(`No se encontró una instancia visible de data-testid="${testID}".`)
}

async function hasVisibleTestId(page: Page, testID: string) {
  return Boolean(await findVisibleLocator(page.getByTestId(testID), 1_500))
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
  await expect(page.locator('[role="progressbar"]:visible'), 'La pantalla sigue mostrando un loader bloqueante.').toHaveCount(0, { timeout: 45_000 })
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready
  }).catch(() => undefined)
  await page.waitForTimeout(600)
}

async function captureScreen(page: Page, testInfo: TestInfo, name: string) {
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
    if (target) return { kind: 'element', maxScroll: target.maxScroll, scrollTop: target.element.scrollTop }

    const root = document.scrollingElement
    const maxScroll = root ? Math.max(0, root.scrollHeight - window.innerHeight) : 0
    return { kind: 'document', maxScroll, scrollTop: window.scrollY }
  })
}

async function setPrimaryScrollFraction(page: Page, fraction: number) {
  await page.evaluate((nextFraction) => {
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
    const clamped = Math.max(0, Math.min(1, nextFraction))
    if (target) {
      target.element.scrollTo({ top: target.maxScroll * clamped, behavior: 'auto' })
      return
    }

    const root = document.scrollingElement
    const maxScroll = root ? Math.max(0, root.scrollHeight - window.innerHeight) : 0
    window.scrollTo({ top: maxScroll * clamped, behavior: 'auto' })
  }, fraction)
}

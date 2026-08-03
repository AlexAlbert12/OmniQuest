import { expect, test } from '@playwright/test'

for (const route of [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
]) {
  test(`captures ${route.name} for visual review`, async ({ page }, testInfo) => {
    await page.goto(route.path)
    await expect(page.locator('body')).toBeVisible()
    const image = await page.screenshot({ fullPage: true, animations: 'disabled' })
    await testInfo.attach(`${route.name}-${testInfo.project.name}`, { body: image, contentType: 'image/png' })
  })
}

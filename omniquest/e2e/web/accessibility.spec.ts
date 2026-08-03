import { expect, test } from '@playwright/test'

for (const route of ['/', '/login', '/register', '/forgot-password']) {
  test(`${route} exposes names for interactive controls`, async ({ page }) => {
    await page.goto(route)

    const unnamed = await page.locator('button, input, textarea, select, [role="button"], [role="link"]').evaluateAll((nodes) => nodes
      .filter((node) => {
        const element = node as HTMLElement
        const name = element.getAttribute('aria-label')
          || element.getAttribute('aria-labelledby')
          || element.getAttribute('title')
          || element.textContent?.trim()
          || (element as HTMLInputElement).placeholder
        return !name
      })
      .map((node) => node.outerHTML.slice(0, 180)))

    expect(unnamed).toEqual([])
  })
}

test('login validation is announced as an alert', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /Iniciar sesión|Sign in/i }).click()
  await expect(page.getByRole('alert')).toHaveCount(2)
})

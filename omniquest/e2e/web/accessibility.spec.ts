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
  test.setTimeout(90_000)
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  const submit = page.getByTestId('login-submit')
  await expect(submit).toBeVisible({ timeout: 60_000 })
  await submit.click()

  const emailError = /Introduce un correo electrónico válido\.|Enter a valid email address\./i
  const passwordError = /Introduce tu contraseña\.|Enter your password\./i
  await expect(page.getByRole('alert').filter({ hasText: emailError })).toHaveCount(1)
  await expect(page.getByRole('alert').filter({ hasText: passwordError })).toHaveCount(1)
})

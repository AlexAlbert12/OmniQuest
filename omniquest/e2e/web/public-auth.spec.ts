import { expect, test } from '@playwright/test'

test('public landing navigates to the login form', async ({ page }) => {
  await page.goto('/')
  const login = page.getByRole('button', { name: /Iniciar sesión|Sign in/i })
  await expect(login).toBeVisible()
  await login.click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(page.getByRole('button', { name: /Iniciar sesión|Sign in/i })).toBeVisible()
})

test('login validates required fields before a network request', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /Iniciar sesión|Sign in/i }).click()

  await expect(page.getByText(/Introduce un correo electrónico válido\.|Enter a valid email address\./i)).toBeVisible()
  await expect(page.getByText(/Introduce tu contraseña\.|Enter your password\./i)).toBeVisible()
})

test('public routes do not overflow horizontally at the active viewport', async ({ page }) => {
  for (const route of ['/', '/login', '/register', '/forgot-password']) {
    await page.goto(route)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${route} has horizontal overflow`).toBeLessThanOrEqual(1)
  }
})

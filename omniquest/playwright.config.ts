import { defineConfig, devices } from '@playwright/test'

if (process.platform === 'win32') {
  const system32 = `${process.env.SystemRoot || 'C:\\Windows'}\\System32`
  const pathEntries = (process.env.PATH || '').split(';')
  if (!pathEntries.some((entry) => entry.toLowerCase() === system32.toLowerCase())) {
    process.env.PATH = [system32, ...pathEntries].filter(Boolean).join(';')
  }
}

const port = Number(process.env.PLAYWRIGHT_PORT || 8082)
const explicitBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim()
const baseURL = explicitBaseURL || `http://127.0.0.1:${port}`
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1'
const isLocalBaseURL = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(baseURL)

export default defineConfig({
  testDir: './e2e/web',
  globalSetup: './e2e/web/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results/playwright',
  use: {
    baseURL,
    locale: 'es-ES',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  ...(isLocalBaseURL
    ? {
        webServer: {
          command: 'node scripts/start-playwright-web.mjs',
          url: baseURL,
          reuseExistingServer,
          timeout: 360_000,
          env: { ...process.env, CI: '1', BROWSER: 'none', PLAYWRIGHT_PORT: String(port) },
        },
      }
    : {}),
})

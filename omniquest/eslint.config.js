// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

const nodeGlobals = {
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
}

const jestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  jest: 'readonly',
  test: 'readonly',
}

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['coverage/**', 'dist/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['jest.config.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: { ...nodeGlobals, ...jestGlobals } },
  },
  {
    files: ['playwright.config.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: nodeGlobals },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly', EdgeRuntime: 'readonly' } },
  },
])

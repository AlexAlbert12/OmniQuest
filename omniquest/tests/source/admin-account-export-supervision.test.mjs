import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('admin export center supervises personal account exports without exposing private archives', () => {
  const screen = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  const panel = read('components/admin/shared/AdminAccountExportRequestsPanel.tsx')
  const api = read('components/admin/api/adminApi.ts')
  const migration = read('supabase/migrations/20260813112000_admin_account_export_supervision.sql')
  const ownRequestMigration = read('supabase/migrations/20260730120000_settings_security_support.sql')

  assert.match(screen, /useAdminAccountExportRequests/)
  assert.match(screen, /permissions\.includes\('users\.export'\)/)
  assert.match(screen, /AdminAccountExportRequestsPanel/)
  assert.match(api, /get_admin_account_export_requests_page/)
  assert.match(migration, /admin_has_permission\('users\.export'\)/)
  assert.match(migration, /from public\.data_export_requests request/)
  assert.doesNotMatch(migration, /request\.object_path/)
  assert.match(panel, /solo puede descargarlo su propietario/)
  assert.doesNotMatch(panel, /createSignedUrl|account-exports|Descargar/)
  assert.match(ownRequestMigration, /data_export_requests_select_own/)
  assert.match(ownRequestMigration, /user_id = auth\.uid\(\)/)
})

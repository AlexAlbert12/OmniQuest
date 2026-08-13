import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('admin export center supervises user requests without exposing private archives', () => {
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
  assert.match(panel, /El administrador solo puede consultar el estado/)
  assert.match(panel, /únicamente puede descargarlo la persona que lo solicitó/)
  assert.doesNotMatch(panel, /createSignedUrl|account-exports|label="Descargar"/)
  assert.match(ownRequestMigration, /data_export_requests_select_own/)
  assert.match(ownRequestMigration, /user_id = auth\.uid\(\)/)
})

test('admin export center paginates both queues and distinguishes load errors from empty states', () => {
  const screen = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  const accountHook = read('components/admin/hooks/useAdminAccountExportRequests.ts')
  const jobsHook = read('components/admin/hooks/useAdminExportJobs.ts')
  const accountPanel = read('components/admin/shared/AdminAccountExportRequestsPanel.tsx')
  const jobsPanel = read('components/admin/shared/AdminExportJobsPanel.tsx')
  const status = read('components/admin/shared/AdminExportStatusBadge.tsx')

  assert.match(screen, /accountPageSize = responsive\.isDesktop \? 25 : 8/)
  assert.match(screen, /jobPageSize = responsive\.isDesktop \? 10 : 8/)
  assert.match(accountHook, /page \* pageSize/)
  assert.match(jobsHook, /page \* pageSize/)
  assert.match(accountPanel, /AdminPaginationControls/)
  assert.match(jobsPanel, /AdminPaginationControls/)
  assert.match(jobsHook, /const \[error, setError\]/)
  assert.match(jobsPanel, /No se pudieron cargar las exportaciones/)
  assert.match(jobsPanel, /label="Reintentar"/)
  assert.match(jobsPanel, /Mis exportaciones en segundo plano/)
  assert.match(accountPanel, /Solicitudes de exportación de usuarios/)
  assert.match(status, /queued:[\s\S]*tone: 'admin'/)
  assert.match(status, /processing:[\s\S]*tone: 'admin'/)
  assert.match(status, /ready:[\s\S]*tone: 'success'/)
  assert.match(status, /failed:[\s\S]*tone: 'danger'/)
  assert.match(status, /expired:[\s\S]*tone: 'muted'/)
})

test('background export downloads revalidate current admin permissions', () => {
  const migration = read('supabase/migrations/20260813123000_admin_export_center_refinement.sql')
  assert.match(migration, /count\(\*\) over\(\) as total_count/)
  assert.match(migration, /when 'profiles' then 'users\.export'/)
  assert.match(migration, /when 'subjects' then 'courses\.read'/)
  assert.match(migration, /when 'audit' then 'audit\.export'/)
  assert.match(migration, /when 'support' then 'support\.read'/)
  assert.match(migration, /not public\.admin_has_permission\(v_permission\)/)
  assert.match(migration, /admin_exports_select_own[\s\S]*admin_has_permission\('users\.export'\)/)
  assert.match(migration, /admin_export_jobs_select_own[\s\S]*admin_has_permission\('courses\.read'\)/)
})

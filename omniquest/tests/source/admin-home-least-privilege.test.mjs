import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20260811193000_admin_home_least_privilege_refinement.sql')
const pushMigration = read('supabase/migrations/20260812103000_admin_push_center.sql')

test('admin permissions fail closed and role management is isolated from the dashboard', () => {
  const dashboard = read('components/admin/dashboard/AdminDashboard.tsx')
  const scaffold = read('components/admin/shared/AdminScaffold.tsx')
  const more = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  const edgeContext = read('supabase/functions/_shared/admin.ts')

  assert.match(migration, /not exists \(select 1 from public\.admin_role_assignments\)/)
  assert.match(migration, /and exists \([\s\S]*p_permission = any\(role\.permissions\)/)
  assert.doesNotMatch(migration.match(/create or replace function public\.admin_has_permission[\s\S]*?\$\$;/)?.[0] || '', /coalesce\([\s\S]*true/)
  assert.match(migration, /Acceso administrativo pendiente/)
  assert.match(migration, /Admin role management permission required/)
  assert.doesNotMatch(dashboard, /AdminRoleManagementPanel|Modelo de acceso/)
  assert.match(more, /Administración y permisos/)
  assert.equal(existsSync('app/(admin)/permissions.tsx'), true)
  assert.match(scaffold, /No se ha podido verificar el perfil de permisos/)
  assert.match(scaffold, /<BrandLogo size=\{30\} questColor=\{tokens\.brand\.admin\}/)
  assert.doesNotMatch(scaffold, /!data\.portalContext \|\|/)
  assert.match(edgeContext, /roleId = 'unassigned'/)
})

test('admin home uses actionable non-duplicated alerts and stable mobile shortcuts', () => {
  const dashboard = read('components/admin/dashboard/AdminDashboard.tsx')
  const metrics = read('components/admin/dashboard/AdminMetrics.tsx')
  const alerts = read('components/admin/dashboard/AdminAlerts.tsx')
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')

  assert.match(migration, /max\(attempt\.attempted_at\) < now\(\) - interval '7 days'/)
  assert.match(migration, /coalesce\(subject\.active, true\)[\s\S]*not coalesce\(subject\.is_archived, false\)/)
  assert.match(migration, /coalesce\(active, true\) and nullif\(trim\(coalesce\(code, ''\)\), ''\) is null/)
  assert.doesNotMatch(metrics, /AdminMobileAttention|Requiere atención|text-brand-admin">Admin/)
  assert.match(dashboard, /<View className="mt-5"><AdminAlerts dashboard=\{dashboard\}/)
  assert.match(dashboard, /Panel title="Accesos rápidos"/)
  assert.match(alerts, /Alumnos inactivos · más de 7 días/)
  assert.doesNotMatch(alerts, /Actividad administrativa/)
  assert.match(metrics, /metrics\.slice\(0, 4\)[\s\S]*dense[\s\S]*aspectRatio: 1/)
  assert.match(primitives, /const shortcutWidth = responsive\.isMobile \? '48%' : responsive\.isWide \? '23\.5%' : '31\.5%'/)
  assert.match(primitives, /numberOfLines=\{2\}/)
})

test('admin push, analytics, audit and exports use product-facing operational semantics', () => {
  const push = read('components/admin/dashboard/AdminPushDeliveryPanel.tsx')
  const analytics = read('components/admin/dashboard/AdminUsageAnalyticsPanel.tsx')
  const utils = read('components/admin/utils/adminUtils.ts')
  const exportsHook = read('components/admin/hooks/useAdminExportJobs.ts')
  const exportsPanel = read('components/admin/shared/AdminExportJobsPanel.tsx')

  assert.match(pushMigration, /queue\.status = 'pending'/)
  assert.match(pushMigration, /queue\.status = 'processing'/)
  assert.match(push, /label: 'Procesando'/)
  assert.doesNotMatch(push, /Sin entregas resueltas todavía|Respeta preferencias y dispositivos disponibles/)
  assert.match(push, /label="Omitidas"/)
  assert.match(analytics, /No se pudo cargar la analítica/)
  assert.match(analytics, /Aún no hay eventos de uso en los últimos 30 días/)
  assert.match(analytics, /flexBasis: '22%'/)
  assert.match(analytics, /dense=\{responsive\.isMobile\}/)
  assert.match(utils, /'admin\.support\.update': 'Ticket de soporte actualizado'/)
  assert.match(utils, /user_support_tickets: 'Ticket de soporte'/)
  assert.match(exportsHook, /setInterval\([\s\S]*15000/)
  assert.doesNotMatch(exportsPanel, /Actualizar trabajos/)
  assert.equal(existsSync('app/(admin)/exports.tsx'), true)
})

test('admin panel headings are exposed to assistive technology', () => {
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  assert.match(primitives, /accessibilityRole="header"[\s\S]*\{title\}/)
})

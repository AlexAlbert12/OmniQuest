import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')
const screen = read('components/admin/support/AdminSupportSection.tsx')
const primitives = read('components/admin/shared/AdminPrimitives.tsx')
const advancedFilters = read('components/admin/shared/AdminAdvancedFilters.tsx')
const search = read('components/search/GlobalSearchButton.tsx')
const scaffold = read('components/admin/shared/AdminScaffold.tsx')
const migration = read('supabase/migrations/20260812190000_admin_support_experience_refinement.sql')

test('admin support uses compact responsive filters and keeps the ticket queue above configuration on mobile', () => {
  assert.match(screen, /AdminMobileFilterShell/)
  assert.match(screen, /Buscar tickets\.\.\./)
  assert.match(screen, /Refina la cola por estado, prioridad, rol, SLA, responsable o etiqueta/)
  assert.match(screen, /const showQueue = isDesktop \|\| !selectedTicket/)
  assert.match(screen, /Volver a soporte/)
  assert.match(screen, /Volver a la cola/)
  assert.match(screen, /label="Volver a la cola" role="admin"/)
  assert.match(screen, /Prioridad[\s\S]*useDefaultBorder[\s\S]*Etiquetas[\s\S]*useDefaultBorder/)
  assert.match(primitives, /borderColor: useDefaultBorder \? tokens\.border\.default/)
  assert.match(advancedFilters, /export function AdminMobileFilterShell/)
})

test('support ticket cards keep SLA, assignee and labels inside one semantic card', () => {
  assert.match(primitives, /SupportStatusPill status=\{ticket\.status\}.*SupportPriorityPill priority=\{ticket\.priority\}.*SupportSlaPill state=\{ticket\.sla_state\}/s)
  assert.match(primitives, /ticket\.assigned_admin_alias \|\| 'Sin asignar'/)
  assert.match(primitives, /ticket\.tags \|\| \[\]/)
  assert.match(primitives, /formatAdminCount\(ticket\.message_count \|\| 0, 'mensaje', 'mensajes'\)/)
  assert.match(primitives, /breached: \{ bg: tokens\.semanticSurface\.danger/)
  assert.match(primitives, /open: \{ bg: withAlpha\(tokens\.brand\.admin, '18'\)/)
})

test('support assignment no longer happens implicitly and only explicit support managers can be assignees', () => {
  assert.match(screen, /setAssignedAdminId\(ticket\.assigned_admin_id \|\| ''\)/)
  assert.match(screen, /setEditStatus\(ticket\.status\)/)
  assert.doesNotMatch(screen, /ticket\.status === 'open' \? 'in_progress'/)
  assert.doesNotMatch(screen, /Asignarme automáticamente/)
  assert.match(screen, /El ticket seguirá sin asignar hasta que elijas un responsable/)
  assert.match(migration, /join public\.admin_role_assignments assignment on assignment\.user_id = profile\.id/)
  assert.match(migration, /'support\.manage' = any\(coalesce\(role\.permissions/)
  assert.match(migration, /assigned_admin_id = coalesce\(p_assigned_admin_id, ticket\.assigned_admin_id\)/)
  assert.doesNotMatch(migration, /assigned_admin_id = coalesce\(p_assigned_admin_id, ticket\.assigned_admin_id, v_admin_id\)/)
})

test('internal support notes use private admin styling instead of warning semantics', () => {
  assert.match(screen, /lock-closed-outline/)
  assert.match(screen, /Visible solo para administradores/)
  assert.match(screen, /withAlpha\(tokens\.brand\.admin, '0D'\)/)
  assert.doesNotMatch(screen, /border-semantic-warning bg-semantic-surface-warning/)
})

test('admin search and scaffold keep the role identity purple without overriding semantic states', () => {
  assert.match(search, /const roleAccent = tokens\.brand\[role\]/)
  assert.match(search, /color=\{roleAccent\}/)
  assert.match(scaffold, /size=\{42\} color=\{tokens\.brand\.admin\}/)
  assert.match(scaffold, /shield-checkmark" size=\{19\} color=\{tokens\.brand\.admin\}/)
})

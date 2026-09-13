import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('admin audit and support export directly to XLSX without background jobs', () => {
  const exports = read('lib/adminExports.ts')
  const audit = read('components/admin/audit/AdminAuditSection.tsx')
  const support = read('components/admin/support/AdminSupportSection.tsx')
  const search = read('components/admin/shared/AdminSearchBar.tsx')

  assert.match(exports, /buildXlsxWorkbook/)
  assert.match(exports, /exportBinaryFile/)
  assert.match(exports, /OmniQuest — Registro de auditoría/)
  assert.match(exports, /OmniQuest — Cola de soporte/)
  assert.match(exports, /get_admin_audit_logs_page_secured/)
  assert.match(exports, /get_admin_support_tickets_page_secured/)
  assert.match(exports, /p_assigned_admin_id/)
  assert.match(exports, /p_sla_state/)
  assert.match(exports, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/)
  assert.match(audit, /exportAdminAudit/)
  assert.match(audit, /Exportar Excel/)
  assert.doesNotMatch(audit, /exportJobs\.request\('audit'/)
  assert.match(support, /exportAdminSupport/)
  assert.match(support, /Exportar Excel/)
  assert.doesNotMatch(support, /exportJobs\.request\('support'/)
  assert.match(search, /exportLabel/)
})

test('direct operational exports preserve active filters and use spreadsheet-friendly types', () => {
  const exports = read('lib/adminExports.ts')

  assert.match(exports, /p_actor_id: filters\.actorId/)
  assert.match(exports, /p_target_table: filters\.targetTable/)
  assert.match(exports, /p_severity: filters\.severity/)
  assert.match(exports, /p_priority: filters\.priority/)
  assert.match(exports, /p_tag: filters\.tag/)
  assert.match(exports, /style: 'datetime'/)
  assert.match(exports, /style: 'integer'/)
  assert.match(exports, /freezeRows: headerRow/)
  assert.match(exports, /autoFilter:/)
  assert.match(exports, /MAX_EXPORT_ROWS/)
})

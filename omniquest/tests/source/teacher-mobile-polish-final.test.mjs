import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('student detail uses blue primary actions and red removal action', () => {
  const modal = read('components/teacher/students/StudentModals.tsx')
  assert.match(modal, /const actionColor = destructive \? tokens\.semantic\.danger : tokens\.brand\.teacher/)
  assert.match(modal, /label="Asignar repaso"/)
  assert.match(modal, /label="Ver historial"/)
  assert.match(modal, /label="Quitar de clase" destructive/)
})

test('teacher review and audit metric strips stay four-wide on mobile', () => {
  const reviews = read('app/(teacher)/reviews.tsx')
  const audit = read('app/(teacher)/audit.tsx')
  assert.equal((reviews.match(/flexBasis: 0, flexGrow: 1, flexShrink: 1/g) || []).length, 4)
  assert.equal((audit.match(/flexBasis: 0, flexGrow: 1, flexShrink: 1/g) || []).length, 4)
})

test('teacher audit data protection banner uses a filled information icon and blue border', () => {
  const audit = read('app/(teacher)/audit.tsx')
  assert.match(audit, /icon="information-circle"/)
  assert.match(audit, /borderColor: tokens\.semantic\.info/)
})

test('teacher notification mobile tabs keep labels readable and avoid oversized web bottom spacing', () => {
  const notifications = read('app/(teacher)/notifications.tsx')
  assert.match(notifications, /badge: responsive\.isMobile \? undefined/)
  assert.doesNotMatch(notifications, /detail=\{responsive\.isDesktop \? 'Respuestas abiertas'/)
  assert.doesNotMatch(notifications, /detail=\{responsive\.isDesktop \? 'Últimos 7 días'/)
  assert.match(notifications, /MOBILE_BOTTOM_NAV_HEIGHT - 10/)
})

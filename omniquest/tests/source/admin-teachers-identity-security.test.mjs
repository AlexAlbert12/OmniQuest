import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('admin visual identity is enforced by shared primitives instead of the global cyan accent', () => {
  const tokens = read('lib/designTokens.ts')
  const scaffold = read('components/admin/shared/AdminScaffold.tsx')
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  const button = read('components/admin/shared/AdminButton.tsx')
  const search = read('components/search/GlobalSearchButton.tsx')

  assert.match(tokens, /admin: '#A78BFA'/)
  assert.match(scaffold, /size=\{42\} color=\{tokens\.brand\.admin\}/)
  assert.match(scaffold, /shield-checkmark" size=\{19\} color=\{tokens\.brand\.admin\}/)
  assert.match(primitives, /withAlpha\(tokens\.brand\.admin, '18'\)/)
  assert.match(button, /<AppButton \{\.\.\.props\} role="admin" \/>/)
  assert.match(search, /const roleAccent = tokens\.brand\[role\]/)
  assert.doesNotMatch(search, /color=\{accentColor\}/)
})

test('admin teacher filters and selection stay compact and purple on mobile', () => {
  const filters = read('components/admin/shared/AdminAdvancedFilters.tsx')
  const bulk = read('components/admin/shared/AdminBulkSelectionBar.tsx')
  const primitives = read('components/admin/shared/AdminPrimitives.tsx')
  const teachers = read('components/admin/users/AdminTeachersSection.tsx')

  assert.match(filters, /<AppBottomSheet visible=\{mobileOpen\}/)
  assert.match(filters, /dateGroupMobile/)
  assert.match(filters, /Filtros \(\$\{activeFilters\.length\}\)/)
  assert.match(filters, /withAlpha\(tokens\.brand\.admin, 'A0'\)/)
  assert.match(teachers, /mobileAction=\{canExport \? <AdminButton/)
  assert.match(bulk, /if \(count === 0\) return/)
  assert.match(bulk, /backgroundColor: withAlpha\(tokens\.brand\.admin, '18'\)/)
  assert.match(primitives, /backgroundColor: selected \? withAlpha\(tokens\.brand\.admin, '0D'\)/)
  assert.match(primitives, /disabled=\{!hasNext\}/)
})

test('creating a teacher never converts an existing account and always uses a server-generated password', () => {
  const edge = read('supabase/functions/admin-create-teacher/index.ts')
  const teachers = read('components/admin/users/AdminTeachersSection.tsx')
  const types = read('components/admin/types/admin.ts')

  assert.match(edge, /if \(existingUser\) return json\(\{ error: 'Ya existe una cuenta con este correo\.', code: 'account_exists' \}, 409\)/)
  assert.doesNotMatch(edge, /updateUserById\(existingUser\.id/)
  assert.doesNotMatch(edge, /admin\.teacher\.update_existing/)
  assert.match(edge, /const password = generateTemporaryPassword\(\)/)
  assert.doesNotMatch(edge, /password\?: string/)
  assert.doesNotMatch(teachers, /teacherPassword/)
  assert.match(teachers, /La contraseña temporal se genera de forma segura en el servidor\./)
  assert.match(teachers, /label="Copiar" icon="copy-outline"/)
  assert.match(types, /status: 'created'/)
})

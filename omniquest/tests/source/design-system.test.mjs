import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (file) => fs.readFileSync(file, 'utf8')
const hex = /#[0-9a-fA-F]{3,8}\b/g

const priorityScreens = [
  'components/admin/portal/AdminPortalCore.tsx',
  'app/(teacher)/subject/[id].tsx',
  'app/(student)/homeStudent.tsx',
  'app/(student)/play/[id].tsx',
  'app/(teacher)/profile.tsx',
  'app/(student)/ranking.tsx',
  'app/(student)/progress.tsx',
]

test('priority screens do not embed physical colour literals', () => {
  for (const file of priorityScreens) {
    assert.equal(read(file).match(hex)?.length ?? 0, 0, file)
  }
})

test('design token API is semantic', () => {
  const source = read('lib/designTokens.ts')
  for (const name of [
    'background', 'surface', 'border', 'text', 'semantic', 'gamification',
    'primary', 'secondary', 'default', 'raised', 'success', 'warning', 'xp',
  ]) {
    assert.match(source, new RegExp(`\\b${name}\\b`), name)
  }
  assert.doesNotMatch(source, /\b(?:blue|purple|red|green|yellow|orange)(?:Light|Dark)?\d*\s*:/i)
})

test('shared action primitives are exported', () => {
  const source = read('components/ui/index.ts')
  for (const name of [
    'AppButton', 'AppIconButton', 'AppConfirmModal', 'AppStatusBanner', 'AppToastProvider',
    'AppDropdown', 'AppMenu', 'AppBottomSheet',
  ]) {
    assert.match(source, new RegExp(`\\b${name}\\b`), name)
  }
  assert.match(read('components/AppConfirmModal.tsx'), /AppBottomSheet/)
  assert.match(read('components/AppConfirmModal.tsx'), /AppButton/)
})

test('native and web alerts are routed through the application modal provider', () => {
  const source = read('components/AppModalProvider.tsx')
  assert.match(source, /Alert\.alert\s*=/)
  assert.match(source, /window\.alert\s*=/)
  assert.match(source, /AppStatusBanner/)
  assert.match(source, /AppBottomSheet/)
})

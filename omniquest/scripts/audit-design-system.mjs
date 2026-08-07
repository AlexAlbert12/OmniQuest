import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['app', 'components']
const SOURCE_EXTENSION = /\.(?:ts|tsx)$/
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g

const priorityScreens = [
  'components/admin/AdminPortal.tsx',
  'app/(teacher)/subject/[id].tsx',
  'app/(student)/homeStudent.tsx',
  'app/(student)/play/[id].tsx',
  'app/(teacher)/profile.tsx',
  'app/(student)/ranking.tsx',
  'app/(student)/progress.tsx',
]

const semanticPrimitives = [
  'components/ui/AppButton.tsx',
  'components/ui/AppIconButton.tsx',
  'components/AppConfirmModal.tsx',
  'components/ui/AppStatusBanner.tsx',
  'components/ui/AppToast.tsx',
  'components/ui/AppDropdown.tsx',
  'components/ui/AppMenu.tsx',
  'components/ui/AppBottomSheet.tsx',
]

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(target)
    return SOURCE_EXTENSION.test(entry.name) ? [target.replaceAll('\\', '/')] : []
  })
}

function count(source, pattern) {
  return source.match(pattern)?.length ?? 0
}

const rows = ROOTS.flatMap(walk).map((file) => {
  const source = fs.readFileSync(file, 'utf8')
  return {
    file,
    hex: count(source, HEX_LITERAL),
    pressable: count(source, /<Pressable\b/g),
    nativeModal: count(source, /<Modal\b/g),
    alert: count(source, /\bAlert\.alert\s*\(/g),
    windowAlert: count(source, /\bwindow\.alert\s*\(/g),
  }
})

const totals = rows.reduce((acc, row) => {
  for (const key of ['hex', 'pressable', 'nativeModal', 'alert', 'windowAlert']) acc[key] += row[key]
  return acc
}, { hex: 0, pressable: 0, nativeModal: 0, alert: 0, windowAlert: 0 })

const topHardcoded = rows
  .filter((row) => row.hex > 0)
  .sort((left, right) => right.hex - left.hex)
  .slice(0, 12)

console.log('OmniQuest design-system audit')
console.log(JSON.stringify({
  hardcodedHex: totals.hex,
  filesWithHardcodedHex: rows.filter((row) => row.hex > 0).length,
  rawPressableElements: totals.pressable,
  nativeModalElements: totals.nativeModal,
  alertCalls: totals.alert,
  windowAlertCalls: totals.windowAlert,
}, null, 2))

if (topHardcoded.length) {
  console.log('\nRemaining files with the most physical colour literals:')
  for (const row of topHardcoded) console.log(`${String(row.hex).padStart(4)}  ${row.file}`)
}

const failures = []
for (const file of [...priorityScreens, ...semanticPrimitives]) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing`)
    continue
  }
  const literals = count(fs.readFileSync(file, 'utf8'), HEX_LITERAL)
  if (literals > 0) failures.push(`${file}: ${literals} physical colour literal(s)`)
}

const tokenSource = fs.readFileSync('lib/designTokens.ts', 'utf8')
for (const required of [
  'background', 'surface', 'border', 'text', 'semantic', 'gamification',
  'primary', 'secondary', 'default', 'raised', 'success', 'warning', 'xp',
]) {
  if (!new RegExp(`\\b${required}\\b`).test(tokenSource)) failures.push(`lib/designTokens.ts: missing semantic token ${required}`)
}
if (/\b(?:blue|purple|red|green|yellow|orange)(?:Light|Dark)?\d*\s*:/i.test(tokenSource)) {
  failures.push('lib/designTokens.ts: physical colour name detected in token API')
}

if (failures.length) {
  console.error('\nAudit failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('\nPriority screens and shared interaction primitives use semantic colours.')
}

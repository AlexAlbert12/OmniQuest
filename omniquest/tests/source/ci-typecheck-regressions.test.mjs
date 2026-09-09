import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('root route segments are widened before optional nested indexes are read', () => {
  const source = read('app/_layout.tsx')
  assert.match(source, /useSegments\(\) as readonly string\[\]/)
  assert.match(source, /const childSegment: string \| undefined = segments\[1\]/)
  assert.ok(!source.includes('const segments = useSegments()\n  const rootSegment = segments[0]\n  const childSegment = segments[1]'))
})

test('web fixed bottom navigation isolates the react-native-web compatibility cast', () => {
  const source = read('components/ui/mobile/MobileBottomNavigation.tsx')
  assert.match(source, /const WEB_FIXED_STYLE = \{ position: 'fixed' \} as unknown as ViewStyle/)
  assert.match(source, /Platform\.OS === 'web' \? WEB_FIXED_STYLE : null/)
  assert.doesNotMatch(source, /\{ position: 'fixed' \} as ViewStyle/)
})

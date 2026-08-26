import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('public landing renders product information and a footer on every layout', async () => {
  const [landing, info] = await Promise.all([read('app/index.tsx'), read('components/public/LandingInfoSections.tsx')])

  assert.match(landing, /import LandingInfoSections from ['"]\.\.\/components\/public\/LandingInfoSections['"]/)
  assert.match(landing, /<LandingInfoSections isDesktop=\{isDesktop\} \/>/)
  assert.match(landing, /<LandingFooter isDesktop=\{isDesktop\} bottomInset=\{insets\.bottom\} \/>/)
  assert.doesNotMatch(landing, /isDesktop \? <LandingFooter/)
  assert.match(landing, /useSafeAreaInsets\(\)/)
  assert.match(landing, /Math\.max\(36, bottomInset \+ 20\)/)
  assert.match(landing, /testID="landing-privacy"/)
  assert.match(landing, /testID="landing-terms"/)
  assert.equal((landing.match(/min-h-12 flex-1 items-center justify-center rounded-xl/g) ?? []).length, 2)

  assert.match(info, /QUÉ ES OMNIQUEST/)
  assert.match(info, /CÓMO FUNCIONA/)
  assert.match(info, /PREGUNTAS FRECUENTES/)
  assert.match(info, /WHAT IS OMNIQUEST/)
  assert.match(info, /HOW IT WORKS/)
  assert.match(info, /FREQUENTLY ASKED QUESTIONS/)
})

test('public landing keeps the compact four-step explanation and accessible FAQ', async () => {
  const info = await read('components/public/LandingInfoSections.tsx')

  assert.equal((info.match(/title: '[1-4]\. /g) ?? []).length, 8)
  assert.match(info, /accessibilityState=\{\{ expanded \}\}/)
  assert.match(info, /onPress=\{\(\) => setExpanded/)
  assert.match(info, /modo invitado/i)
  assert.match(info, /guest mode/i)
})

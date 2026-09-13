import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('game results and bottom sheets keep their final actions above Android system controls', () => {
  const result = read('components/student/game/GameResultState.tsx')
  const sheet = read('components/ui/AppBottomSheet.tsx')

  assert.ok(result.includes('useSafeAreaInsets()'))
  assert.ok(result.includes('paddingBottom: Math.max(insets.bottom + 24, 40)'))
  assert.ok(sheet.includes('useSafeAreaInsets()'))
  assert.ok(sheet.includes("const bottomSafeInset = Platform.OS === 'web' ? 0 : insets.bottom"))
  assert.ok(sheet.includes('const compactFooterBottomPadding = bottomSafeInset + 12'))
  assert.ok(sheet.includes('isCompact ? { paddingBottom: compactFooterBottomPadding } : null'))
  assert.ok(sheet.includes('isCompact && !footer ? { paddingBottom: compactContentBottomPadding } : null'))
})

test('mobile web navigation remains fixed to the viewport', () => {
  const navigation = read('components/ui/mobile/MobileBottomNavigation.tsx')

  assert.ok(navigation.includes("const WEB_FIXED_STYLE = { position: 'fixed' } as unknown as ViewStyle"))
  assert.ok(navigation.includes("Platform.OS === 'web' ? WEB_FIXED_STYLE : null"))
  assert.ok(navigation.includes('bottom: 0'))
  assert.ok(navigation.includes('zIndex: 1000'))
})

test('narrow student and teacher page headers do not split their titles inside words', () => {
  const course = read('app/(teacher)/subject/[id].tsx')
  const notifications = read('app/(student)/notifications.tsx')

  assert.ok(course.includes('titleNumberOfLines={isDesktop ? 2 : 1}'))
  assert.ok(course.includes('mobileStackedIdentity'))
  assert.ok(!course.includes('mobileInlineActions'))
  assert.ok(notifications.includes('title="Notificaciones"'))
  assert.ok(notifications.includes('titleNumberOfLines={1}'))
  assert.ok(notifications.includes('compactMobileTitle'))
})

test('teacher settings uses the compact teaching label only on mobile', () => {
  const settings = read('app/(student)/settings.tsx')
  const i18n = read('lib/i18n.tsx')

  assert.ok(settings.includes("labelKey: 'settings.section.teaching', mobileLabelKey: 'settings.section.teaching.mobile'"))
  assert.ok(settings.includes('responsive.isMobile && item.mobileLabelKey'))
  assert.ok(i18n.includes("'settings.section.teaching.mobile': 'Docencia'"))
})

test('student mobile details reuse the established blue and surface tokens', () => {
  const modal = read('components/student/course/TopicDifficultyModal.tsx')
  const classes = read('app/(student)/classes.tsx')
  const compactSelect = classes.slice(classes.indexOf('function CompactSelect'))

  assert.ok(modal.includes('style={{ color: tokens.brand.student }}>Cómo funciona'))
  assert.ok(!compactSelect.includes('tokens.border.active'))
  assert.ok(compactSelect.split('borderColor: tokens.border.default').length - 1 >= 2)
})

test('latest achievements keeps its action in the top-right header row', () => {
  const achievements = read('components/student/profile/StudentProfileAchievements.tsx')

  assert.ok(achievements.includes('mb-4 flex-row items-start justify-between gap-2'))
  assert.ok(achievements.includes('className="min-w-0 flex-1"'))
  assert.ok(achievements.includes('label="Ver todos"'))
  assert.ok(achievements.includes('style={{ flexShrink: 0 }}'))
  assert.ok(!achievements.includes('flex-row flex-wrap items-center justify-between'))
})

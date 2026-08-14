import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('web animations select the JS driver instead of requesting a missing native module', () => {
  const animation = read('lib/animation.ts')
  const sourceFiles = [
    'components/ui/AppToast.tsx',
    'components/OmniGuide.tsx',
    'components/notifications/NotificationListItem.tsx',
    'components/gamification/XpGainBurst.tsx',
    'components/gamification/CelebrationParticles.tsx',
    'components/gamification/BadgeUnlockModal.tsx',
    'components/gamification/AnswerFeedbackMotion.tsx',
    'components/student/game/GameQuestionUi.tsx',
  ].map(read)

  assert.match(animation, /Platform\.OS !== 'web'/)
  sourceFiles.forEach((source) => {
    assert.doesNotMatch(source, /useNativeDriver:\s*true/)
    assert.match(source, /USE_NATIVE_ANIMATION_DRIVER/)
  })
})

test('pointer event behavior is expressed through styles instead of deprecated props', () => {
  const files = [
    'components/OfflineSyncBanner.tsx',
    'components/notifications/NotificationListItem.tsx',
    'components/ui/AppToast.tsx',
    'components/ui/mobile/MobileMetricCard.tsx',
    'app/(student)/class/[id].tsx',
    'components/HomeVisualBackground.tsx',
    'components/gamification/XpGainBurst.tsx',
    'components/gamification/GamifiedAvatar.tsx',
    'components/gamification/CelebrationParticles.tsx',
    'components/questions/QuestionMedia.tsx',
    'components/student/home/StudentRecommendedAction.tsx',
    'components/student/home/StudentDailyMission.tsx',
    'components/student/home/StudentContinueCourse.tsx',
    'components/student/game/GameShell.tsx',
    'components/student/galaxy/StudentGalaxyMap.tsx',
  ]

  files.forEach((path) => assert.doesNotMatch(read(path), /pointerEvents=/, path))
})

test('desktop student rows expose sibling actions instead of nesting HTML buttons', () => {
  const source = read('components/teacher/students/TeacherStudentsDesktop.tsx')

  assert.match(source, /<View\s+className="min-h-\[72px\] flex-row items-center px-4 py-3"/)
  assert.match(source, /accessibilityLabel=\{expanded \? `Cerrar resumen de/)
  assert.doesNotMatch(source, /<AppPressable[\s\S]{0,260}className="min-h-\[72px\]/)
})

test('legacy relative avatar names fall back to initials instead of causing web 404 responses', () => {
  const helper = read('lib/avatarUri.ts')
  const consumers = [
    'components/teacher/students/StudentProfileAvatar.tsx',
    'components/admin/shared/AdminProfileAvatar.tsx',
    'components/ui/RoleHeaderAvatar.tsx',
  ]

  assert.match(helper, /RENDERABLE_AVATAR_URI/)
  assert.match(helper, /https\?:/)
  consumers.forEach((path) => assert.match(read(path), /getRenderableAvatarUri/, path))
})

test('web navigation and app modals release focus before hiding their current view', () => {
  const focus = read('lib/webFocus.ts')
  const navigation = read('components/ui/mobile/MobileBottomNavigation.tsx')
  const modals = read('components/AppModalProvider.tsx')

  assert.match(focus, /document\.activeElement/)
  assert.match(focus, /activeElement\?\.blur/)
  assert.match(navigation, /releaseWebFocus\(\)/)
  assert.match(modals, /releaseWebFocus\(\)/)
})

test('root font gate eagerly loads the brand and icon fonts', () => {
  const root = read('app/_layout.tsx')

  assert.match(root, /\.\.\.Ionicons\.font/)
  assert.match(root, /Pacifico_400Regular/)
})

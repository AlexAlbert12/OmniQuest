import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('achievement modal centers its label, has no close icon and clips the reward card on Android', () => {
  const modal = read('components/gamification/BadgeUnlockModal.tsx')

  assert.match(modal, /className="items-center justify-center border-b px-5 py-4"/)
  assert.doesNotMatch(modal, /accessibilityLabel="Cerrar logro"/)
  assert.match(modal, /borderRadius: 16, overflow: 'hidden'/)
  assert.match(modal, /role="student"[\s\S]*variant="primary"/)
})

test('role page headers hide supporting copy and reuse one blue back button', () => {
  const header = read('components/ui/RolePageHeader.tsx')
  const backButton = read('components/ui/AppBackButton.tsx')

  assert.doesNotMatch(header, /const supportingCopy/)
  assert.doesNotMatch(header, /\{supportingCopy\}/)
  assert.match(header, /<AppBackButton/)
  assert.match(backButton, /role="teacher"/)
  assert.match(backButton, /variant="primary"/)
})

test('mobile navigation and tab controls retain spacing and visible button surfaces', () => {
  const navigation = read('components/ui/mobile/MobileBottomNavigation.tsx')
  const tabs = read('components/ui/AppTabs.tsx')

  assert.match(navigation, /maxFontSizeMultiplier=\{1\.2\}/)
  assert.match(navigation, /flexBasis: 0/)
  assert.match(navigation, /gap: 4/)
  assert.match(navigation, /backgroundColor: isActive \? withAlpha\(accentColor, '24'\)/)
  assert.match(navigation, /borderColor: isActive \? withAlpha\(accentColor, 'A0'\)/)
  assert.match(navigation, /width: '100%'/)
  assert.match(navigation, /includeFontPadding: false/)
  assert.match(tabs, /selected \? withAlpha\(activeColor, '24'\) : tokens\.surface\.interactive/)
  assert.match(tabs, /selected \? withAlpha\(activeColor, 'A0'\) : tokens\.border\.subtle/)
})

test('teacher catalog uses the safe shared layout and generated feature styles', () => {
  const catalog = read('features/teacher-catalog/screen.tsx')
  const cta = read('components/teacher/classes/CreateCourseCTA.tsx')
  const courseCard = read('components/teacher/classes/TeacherCourseCard.tsx')
  const tailwind = read('tailwind.config.js')

  assert.match(catalog, /<TeacherScreenLayout/)
  assert.match(catalog, /mobileTitle="Cursos"/)
  assert.doesNotMatch(catalog, /matrículas/)
  assert.match(catalog, /compact mobileRail=\{!isDesktop\}/)
  assert.match(cta, /MOBILE_BOTTOM_NAV_HEIGHT \+ insets\.bottom \+ 18/)
  assert.match(courseCard, /ATTENTION_BADGE_BACKGROUND/)
  assert.match(courseCard, /Necesita atención<\/Text>/)
  assert.match(tailwind, /\.\/features\/\*\*\/\*\.\{js,jsx,ts,tsx\}/)
  assert.doesNotMatch(tailwind, /var\(--omni-/)
  assert.match(tailwind, /background:[\s\S]*primary: '#061126'/)
  assert.match(tailwind, /border:[\s\S]*default: '#1A3155'/)
})

test('manual review and student history share the safe teacher shell and compact mobile structure', () => {
  const reviews = read('app/(teacher)/reviews.tsx')
  const history = read('app/(teacher)/student/[id]/history.tsx')
  const queue = read('components/teacher/reviews/ManualReviewQueue.tsx')
  const metric = read('components/ui/mobile/MobileMetricCard.tsx')

  assert.match(reviews, /<TeacherScreenLayout/)
  assert.match(history, /<TeacherScreenLayout/)
  assert.match(reviews, /titleNumberOfLines=\{1\}/)
  assert.match(reviews, /mobileStackedIdentity/)
  assert.match(reviews, /actionsPosition="top"/)
  assert.equal((reviews.match(/dense=\{!isDesktop\}/g) || []).length, 4)
  assert.match(reviews, /className="flex-row gap-2"/)
  assert.match(reviews, /style=\{\{ minWidth: 0, flex: 1 \}\}/)
  assert.match(queue, /overflow-hidden rounded-2xl border/)
  assert.match(queue, /iconOnly=\{!isDesktop\}/)
  assert.match(metric, /dense\?: boolean/)
})

test('teacher notification gestures, compact metrics and modal buttons remain functional on Android', () => {
  const notifications = read('app/(teacher)/notifications.tsx')
  const item = read('components/notifications/NotificationListItem.tsx')
  const modal = read('components/AppModalProvider.tsx')

  assert.equal((notifications.match(/dense=\{!responsive\.isDesktop\}/g) || []).length, 3)
  assert.match(notifications, /swipeEnabled=\{!responsive\.isDesktop\}/)
  assert.match(item, /onMoveShouldSetPanResponderCapture: shouldStartSwipe/)
  assert.match(item, /onPanResponderTerminationRequest: \(\) => false/)
  assert.match(modal, /fullWidth=\{!responsive\.isDesktop\}/)
  assert.match(modal, /mobileAction:[\s\S]*width: '100%'/)
})

test('global search uses the same full-width entity cards on mobile and desktop', () => {
  const search = read('components/search/GlobalSearchButton.tsx')

  assert.match(search, /backgroundColor: pressed \? tokens\.surface\.selected : tokens\.background\.secondary/)
  assert.match(search, /styles\.resultAccent/)
  assert.match(search, /styles\.resultArrow/)
  assert.match(search, /resultRow: \{ position: 'relative', width: '100%', minHeight: 72, overflow: 'hidden'/)
})

test('remaining direct teacher screens protect content from the system status bar', () => {
  const safeScreens = [
    'app/(teacher)/audit.tsx',
    'app/(teacher)/question-report/[id].tsx',
    'app/(teacher)/topic/[id].tsx',
    'components/teacher/TeacherQuestionForm.tsx',
    'components/teacher/TeacherSubjectForm.tsx',
    'components/teacher/TeacherTopicForm.tsx',
    'components/support/RoleHelpCenter.tsx',
    'app/(student)/settings.tsx',
  ]

  for (const path of safeScreens) {
    const source = read(path)
    assert.match(source, /<SafeAreaView edges=\{\['top', 'left', 'right'\]\}/, `${path} must keep its top content inside the safe area`)
  }
})

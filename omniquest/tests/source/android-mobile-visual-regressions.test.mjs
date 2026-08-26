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

test('mobile navigation keeps five equal destinations with a clearly visible active surface', () => {
  const navigation = read('components/ui/mobile/MobileBottomNavigation.tsx')

  assert.match(navigation, /maxFontSizeMultiplier=\{1\.15\}/)
  assert.match(navigation, /flexBasis: 0/)
  assert.match(navigation, /justifyContent: 'space-between'/)
  assert.match(navigation, /gap: 6/)
  assert.match(navigation, /backgroundColor: isActive \? withAlpha\(accentColor, '30'\)/)
  assert.match(navigation, /borderColor: isActive \? withAlpha\(accentColor, 'D0'\)/)
  assert.match(navigation, /borderWidth: 1\.5/)
  assert.match(navigation, /includeFontPadding: false/)
})

test('shared buttons and tab rails do not reorder or squeeze their content on native mobile', () => {
  const button = read('components/ui/AppButton.tsx')
  const tabs = read('components/ui/AppTabs.tsx')
  const dropdown = read('components/ui/AppDropdown.tsx')

  assert.match(button, /flexWrap: 'nowrap'/)
  assert.match(button, /maxWidth: '100%'/)
  assert.match(button, /includeFontPadding: false/)
  assert.match(button, /background: tokens\.surface\.interactive/)
  assert.match(tabs, /mobileRailTab: \{ minHeight: 42, minWidth: 88, flexShrink: 0/)
  assert.match(tabs, /fillTab: \{ flex: 1, minWidth: 0 \}/)
  assert.match(tabs, /includeFontPadding: false/)
  assert.match(dropdown, /compactTrigger: \{[\s\S]*?minHeight: 44/)
  assert.match(dropdown, /compactTriggerText: \{[\s\S]*?fontSize: 12/)
  assert.match(dropdown, /compactChevronBox: \{[\s\S]*?width: 24,[\s\S]*?height: 24/)
})

test('teacher catalog separates the mobile filter rail from a real sort dropdown', () => {
  const catalog = read('features/teacher-catalog/screen.tsx')
  const cta = read('components/teacher/classes/CreateCourseCTA.tsx')
  const courseCard = read('components/teacher/classes/TeacherCourseCard.tsx')
  const tailwind = read('tailwind.config.js')

  assert.match(catalog, /<TeacherScreenLayout/)
  assert.match(catalog, /mobileTitle="Cursos"/)
  assert.doesNotMatch(catalog, /matrículas/)
  assert.match(catalog, /compact mobileRail role="teacher"/)
  assert.match(catalog, /<AppDropdown<TeacherCourseSort>/)
  assert.match(catalog, /label: `Orden: \${item\.label}`/)
  assert.match(cta, /<AppButton/)
  assert.match(cta, /MOBILE_BOTTOM_NAV_HEIGHT \+ insets\.bottom \+ 18/)
  assert.match(courseCard, /ATTENTION_BADGE_BACKGROUND/)
  assert.match(courseCard, /Necesita atención<\/Text>/)
  assert.match(tailwind, /\.\/features\/\*\*\/\*\.\{js,jsx,ts,tsx\}/)
  assert.doesNotMatch(tailwind, /var\(--omni-/)
})

test('manual review uses a readable two-column metric grid and scrollable mobile status rail', () => {
  const reviews = read('app/(teacher)/reviews.tsx')
  const history = read('app/(teacher)/student/[id]/history.tsx')
  const queue = read('components/teacher/reviews/ManualReviewQueue.tsx')

  assert.match(reviews, /<TeacherScreenLayout/)
  assert.match(history, /<TeacherScreenLayout/)
  assert.match(reviews, /mobileStackedIdentity/)
  assert.equal((reviews.match(/flexBasis: '46%'/g) || []).length, 4)
  assert.equal((reviews.match(/minHeight: 108/g) || []).length, 4)
  assert.match(reviews, /compact mobileRail=\{!isDesktop\} role="teacher"/)
  assert.match(queue, /overflow-hidden rounded-2xl border/)
  assert.match(queue, /iconOnly=\{!isDesktop\}/)
})

test('teacher notification mobile filters use two equal visible buttons and clear the bottom nav', () => {
  const notifications = read('app/(teacher)/notifications.tsx')
  const item = read('components/notifications/NotificationListItem.tsx')

  assert.equal((notifications.match(/dense=\{!responsive\.isDesktop\}/g) || []).length, 3)
  assert.match(notifications, /<View style=\{\{ minWidth: 0, flex: 1 \}\}>[\s\S]*?<AppButton fullWidth label=\{notifications\.category/)
  assert.match(notifications, /paddingBottom: responsive\.isDesktop \? 36 : MOBILE_BOTTOM_NAV_SPACER/)
  assert.match(notifications, /swipeEnabled=\{!responsive\.isDesktop\}/)
  assert.match(item, /onMoveShouldSetPanResponderCapture: shouldStartSwipe/)
})

test('course detail gives the compact classroom selector and create-class action full mobile width', () => {
  const screen = read('app/(teacher)/subject/[id].tsx')
  const structure = read('components/teacher/subject/SubjectCourseStructure.tsx')

  assert.match(screen, /<SubjectClassroomsSection[\s\S]*compact=\{!isDesktop\}/)
  assert.match(structure, /style=\{compact \? \{ width: '100%' \}/)
  assert.match(structure, /role="teacher"/)
  assert.match(structure, /className=\{compact \? 'gap-2' : 'flex-row items-center gap-2'\}/)
  assert.match(structure, /fullWidth=\{compact\}/)
})

test('teacher More uses full-width horizontal rows on phone instead of floating two-column cards', () => {
  const more = read('components/teacher/TeacherMoreScreen.tsx')

  assert.match(more, /if \(compact\)/)
  assert.match(more, /width: '100%'/)
  assert.match(more, /flexDirection: 'row'/)
  assert.match(more, /minHeight: 82/)
  assert.match(more, /backgroundColor: pressed \? tokens\.surface\.selected : tokens\.surface\.default/)
})

test('global search uses the same full-width entity cards on mobile and desktop', () => {
  const search = read('components/search/GlobalSearchButton.tsx')

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

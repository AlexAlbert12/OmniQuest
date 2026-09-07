import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('shared metric cards keep mobile hierarchy and center icon, label and value inline on desktop', () => {
  const metric = read('components/ui/mobile/MobileMetricCard.tsx')
  const rowStart = metric.indexOf("<View style={{ minWidth: 0, flexDirection: 'row', alignItems: 'center'")
  const desktopLabelStart = metric.indexOf('{desktopInline && metricLabel ?')
  const valueStart = metric.indexOf('{valueText}')
  const mobileLabelStart = metric.indexOf('{!desktopInline && metricLabel ?')
  const detailStart = metric.indexOf('{detail !== undefined')
  const primaryRow = metric.slice(rowStart, mobileLabelStart)

  assert.ok(rowStart >= 0)
  assert.match(metric, /desktopInline = Platform\.OS === 'web' && responsive\.isDesktop/)
  assert.match(metric, /justifyContent: desktopInline \? 'center' : undefined/)
  assert.match(primaryRow, /<Ionicons name=\{resolvedIcon\}/)
  assert.match(primaryRow, /\{valueText\}/)
  assert.ok(desktopLabelStart > rowStart)
  assert.ok(valueStart > desktopLabelStart)
  assert.ok(mobileLabelStart > valueStart)
  assert.ok(detailStart > mobileLabelStart)
  assert.match(metric, /numberOfLines=\{1\}[\s\S]*adjustsFontSizeToFit[\s\S]*minimumFontScale=\{0\.72\}/)
  assert.match(metric, /<LinearGradient/)
  assert.match(metric, /absolute -right-6 -top-6 h-20 w-20 rounded-full/)
})

test('metric grids no longer force square cards or legacy minimum heights', () => {
  const constraints = [
    ['components/student/profile/StudentProfileMetrics.tsx', /aspectRatio: 1|minHeight: 118/],
    ['components/student/progress/ProgressOverview.tsx', /aspectRatio: 1|minHeight: 118/],
    ['app/(student)/classes.tsx', /minHeight: isDesktop \? 132 : 88|aspectRatio: isDesktop/],
    ['components/student/course/CourseProgressPanel.tsx', /minHeight: isDesktop \? 112 : 88|aspectRatio: isDesktop/],
    ['app/(teacher)/reviews.tsx', /minHeight: 82/],
    ['app/(teacher)/audit.tsx', /minHeight: 82/],
    ['components/admin/dashboard/AdminMetrics.tsx', /aspectRatio: 1/],
    ['components/admin/dashboard/AdminUsageAnalyticsPanel.tsx', /aspectRatio: 1/],
    ['components/teacher/profile/TeacherProfileMetrics.tsx', /minHeight: 74/],
    ['components/teacher/student-history/StudentHistorySummary.tsx', /aspectRatio: 1/],
    ['components/teacher/subject/SubjectShared.tsx', /aspectRatio: 1/],
    ['components/teacher/students/MobileTeacherStudents.tsx', /minHeight: 82/],
    ['components/teacher/students/StudentModals.tsx', /minHeight: 78/],
    ['components/student/activity/StudentActivityAttemptRow.tsx', /min-h-\[72px\]/],
  ]

  for (const [path, legacyConstraint] of constraints) assert.doesNotMatch(read(path), legacyConstraint)
})

test('role metric wrappers continue delegating to the shared component', () => {
  for (const path of [
    'components/student/StudentMetricCard.tsx',
    'components/student/StudentKpiCard.tsx',
    'components/admin/shared/AdminPrimitives.tsx',
  ]) {
    assert.match(read(path), /<MobileMetricCard/)
  }
})

test('manual KPI implementations use the same first-row anatomy', () => {
  const sources = [
    read('components/student/StudentStatGrid.tsx'),
    read('components/student/home/StudentHomeSummary.tsx'),
    read('components/teacher/student-history/StudentHistorySummary.tsx'),
    read('components/teacher/students/MobileTeacherStudents.tsx'),
    read('components/teacher/students/StudentModals.tsx'),
    read('components/teacher/subject/SubjectShared.tsx'),
    read('components/student/activity/StudentActivityAttemptRow.tsx'),
    read('components/student/game/GameResultState.tsx'),
  ]

  for (const source of sources) {
    assert.match(source, /flex-row items-center[\s\S]*<Ionicons[\s\S]*\{(?:item\.|metric\.)?value|<Ionicons[\s\S]*\{value\}[\s\S]*<\/View>/)
  }
})

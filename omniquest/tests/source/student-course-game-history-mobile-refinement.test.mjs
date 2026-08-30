import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('course detail keeps an explicit return and mobile progress visually equivalent to desktop', () => {
  const detail = read('app/(student)/class/[id].tsx')
  const header = read('components/student/course/CourseGalaxyHeader.tsx')
  const mission = read('components/student/course/CourseNextMission.tsx')
  const progress = read('components/student/course/CourseProgressPanel.tsx')
  const galaxy = read('components/student/galaxy/StudentGalaxyMap.tsx')

  assert.match(header, /backAction=\{\{ label: 'Mis cursos', onPress: onBack \}\}/)
  assert.match(detail, /onBack=\{\(\) => router\.push\('\/\(student\)\/classes'/)
  assert.match(mission, /variant="primary"/)
  assert.match(mission, /fullWidth=\{responsive\.isMobile\}/)
  assert.match(mission, /minWidth: 190, alignSelf: 'center'/)
  assert.match(galaxy, /const nodeSize = .*: 124/)
  assert.match(progress, /flex-row gap-2/)
  assert.match(progress, /dense=\{!isDesktop\}/)
  assert.match(progress, /mt-5 rounded-\[24px\] border border-border-default bg-surface-default p-4/)
  assert.doesNotMatch(progress, /Resumen de aprendizaje, repaso y clasificación|label="Ver actividad"/)
  assert.match(progress, /backgroundColor: tokens\.semanticSurface\.danger/)
  assert.match(progress, /borderColor: withAlpha\(tokens\.semantic\.danger, 'A0'\)/)
  assert.match(detail, /fullWidth=\{!isDesktop\}[\s\S]*label="Abandonar clase"[\s\S]*variant="danger"/)
})

test('game shell, timer, matching copy and continuation actions share the requested mobile and web design', () => {
  const shell = read('components/student/game/GameShell.tsx')
  const hud = read('components/student/game/GameHud.tsx')
  const renderer = read('components/student/game/GameQuestionRenderer.tsx')
  const feedback = read('components/student/game/GameQuestionUi.tsx')
  const result = read('components/student/game/GameResultState.tsx')

  assert.match(shell, /<SafeAreaView edges=\{\['top', 'left', 'right'\]\}/)
  assert.match(hud, /const color = tokens\.brand\.student/)
  assert.doesNotMatch(hud, /#8B5CF6/)
  assert.doesNotMatch(renderer, /Elige .*en la columna derecha/)
  assert.match(feedback, /label="Siguiente pregunta"[\s\S]*role="student"[\s\S]*variant="primary"/)
  assert.doesNotMatch(result, /AppBackButton/)
  assert.ok((result.match(/variant="primary"/g) || []).length >= 2)
})

test('student activity uses the concise Historial header and a full blue practice action', () => {
  const activity = read('app/(student)/activity-log.tsx')
  const row = read('components/student/activity/StudentActivityAttemptRow.tsx')

  assert.match(activity, /title="Historial"/)
  assert.match(activity, /compactMobileTitle/)
  assert.match(activity, /bottomPadding=\{0\}/)
  assert.match(activity, /Platform\.OS === 'web' \? MOBILE_BOTTOM_NAV_HEIGHT : MOBILE_BOTTOM_NAV_SPACER/)
  assert.doesNotMatch(activity, /backAction=|title="Historial de actividad"|Consulta tus intentos anteriores/)
  assert.match(row, /label=\{`Practicar \$\{topicTitle\}`\}[\s\S]*role="student"[\s\S]*variant="primary"[\s\S]*fullWidth/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('admin profile activity is protected by users.read and profile RLS follows the same RBAC rule', () => {
  const migration = read('supabase/migrations/20260812150000_admin_profile_activity_refinement.sql')
  assert.match(migration, /get_admin_profile_activity_page[\s\S]*admin_has_permission\('users\.read'\)/)
  assert.match(migration, /p_profile_id = auth\.uid\(\)[\s\S]*admin_has_permission\('users\.read'\)/)
  assert.match(migration, /profiles_update_admin[\s\S]*admin_has_permission\('users\.manage'\)/)
  assert.doesNotMatch(migration, /if not public\.is_admin\(\) then/)
})

test('student attempts use truthful review semantics and include question context without exposing answers', () => {
  const migration = read('supabase/migrations/20260812150000_admin_profile_activity_refinement.sql')
  assert.match(migration, /'Respuesta pendiente de revisión'/)
  assert.match(migration, /'Respuesta aprobada'/)
  assert.match(migration, /'Respuesta rechazada'/)
  assert.match(migration, /'Respuesta con cambios solicitados'/)
  assert.match(migration, /'Respuesta incorrecta'/)
  assert.doesNotMatch(migration, /Pregunta para practicar/)
  assert.match(migration, /'question_text', question\.text/)
  assert.doesNotMatch(migration, /submitted_answer_text/)
})

test('admin activity UI humanizes audit actions and entity references while retaining copyable traceability', () => {
  const screen = read('components/admin/users/AdminProfileActivityScreen.tsx')
  const utils = read('components/admin/utils/adminUtils.ts')
  assert.match(utils, /getTeacherAuditActionLabel/)
  assert.match(read('lib/teacherAuditPresentation.ts'), /'teacher\.topic\.update': 'Tema actualizado'/)
  assert.match(utils, /subject_topics: 'Tema'/)
  assert.match(utils, /attempt_history: 'Intento'/)
  assert.match(utils, /game_attempts: 'Partida'/)
  assert.match(screen, /getAuditActionLabel\(event\.title\)/)
  assert.match(screen, /formatActivityReference\(event\.entity_table, event\.entity_id\)/)
  assert.match(screen, /referencia …\$\{id\.slice\(-12\)\}/)
  assert.match(screen, /Clipboard\.setStringAsync/)
  assert.doesNotMatch(screen, /\{event\.entity_table \|\| 'sistema'\}/)
})

test('admin activity profile summary fails explicitly, uses governed profile data and debounces timeline search', () => {
  const screen = read('components/admin/users/AdminProfileActivityScreen.tsx')
  const hook = read('components/admin/hooks/useAdminRpcPage.ts')
  const hub = read('components/admin/mobile/AdminMobileHubScreens.tsx')
  assert.match(screen, /supabase\.rpc\('get_admin_profiles_page'/)
  assert.doesNotMatch(screen, /\.from\('profiles'\)/)
  assert.match(screen, /No se ha podido cargar el usuario/)
  assert.match(screen, /setTimeout\(\(\) => setDebouncedSearch\(search\.trim\(\)\), 350\)/)
  assert.match(screen, /Última actividad:/)
  assert.match(screen, /Último acceso:/)
  assert.match(screen, /Cuenta sin alertas/)
  assert.match(hook, /enabled = true/)
  assert.match(hub, /Gestiona profesores y alumnos desde un único punto\./)
})

test('admin activity places its purple back action above the page title', () => {
  const screen = read('components/admin/users/AdminProfileActivityScreen.tsx')
  const scaffold = read('components/admin/shared/AdminScaffold.tsx')
  const backActionPosition = scaffold.indexOf('{backAction ?')
  const headerPosition = scaffold.indexOf('{isDesktop ? <View className="mb-6')

  assert.match(screen, /const backLabel = profile\?\.role_id === 'teacher' \? 'Volver a profesores' : profile \? 'Volver a alumnos' : 'Volver a usuarios'/)
  assert.match(screen, /<AdminScaffold[^>]*backAction=\{\{ label: backLabel, onPress: \(\) => router\.back\(\) \}\}/)
  assert.doesNotMatch(screen, /<AppBackButton/)
  assert.match(scaffold, /\{backAction \? <View className="mb-4"><AdminButton \{\.\.\.backAction\} icon="arrow-back" \/><\/View> : null\}/)
  assert.ok(backActionPosition >= 0 && backActionPosition < headerPosition)
})

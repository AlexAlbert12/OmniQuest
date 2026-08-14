import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('mobile ranking lets the page own the vertical gesture while keeping the shared list primitive', () => {
  const ranking = read('components/student/ranking/RankingMobileList.tsx')
  const stack = read('components/ui/VirtualizedStack.tsx')
  assert.match(ranking, /VirtualizedStack/)
  assert.match(stack, /touchAction: 'pan-y'/)
  assert.match(stack, /Platform\.OS === 'web' && !scrollEnabled/)
})

test('course topic bubble uses the actual action instead of the generic view-options label', () => {
  const source = read('app/(student)/class/[id].tsx')
  assert.match(source, /actionLabel: getTopicActionLabel\(topic\)/)
  assert.doesNotMatch(source, /actionLabel: topic\.answeredQuestions > 0 \? 'Ver opciones'/)
})

test('student avatar uploads use a versioned object path so browsers cannot keep the previous image URL', () => {
  const modal = read('components/student/profile/StudentAvatarCustomizationModal.tsx')
  const offline = read('lib/offlineMutations.ts')
  assert.match(modal, /`\$\{profile\.id\}\/\$\{Date\.now\(\)\}\.jpg`/)
  assert.match(offline, /`\$\{entry\.userId\}\/\$\{Date\.now\(\)\}\.jpg`/)
})

test('versioned student avatar paths remain authorized by storage and the server updater', () => {
  const migration = read('supabase/migrations/20260703012000_create_avatars_bucket.sql')
  const edgeFunction = read('supabase/functions/profile-update-avatar/index.ts')
  assert.ok(migration.includes("p_object_name like auth.uid()::text || '/%'"))
  assert.ok(edgeFunction.includes("path.startsWith(`${userId}/`)"))
})

test('student activity owns a full-height FlatList viewport on mobile web', () => {
  const source = read('app/(student)/activity-log.tsx')
  assert.match(source, /<FlatList\s+style=\{\{ flex: 1 \}\}/)
})

test('mobile notification actions stay behind the card until a horizontal swipe', () => {
  const source = read('components/notifications/NotificationListItem.tsx')
  assert.match(source, /style=\{\{ width: '100%', transform: \[\{ translateX \}\] \}\}/)
  assert.match(source, /display: swipeEnabled \? 'none' : 'flex'/)
  assert.match(source, /Desliza a la derecha/)
})

test('mobile course dropdowns stay above the galaxy view selector', () => {
  const source = read('app/(student)/classes.tsx')
  assert.match(source, /zIndex: openFilterMenu \? 50 : 1/)
  assert.match(source, /zIndex: open \? 60 : 1/)
  assert.match(source, /elevation: 18/)
})

test('galaxy course join uses the same explicit join call to action as list view', () => {
  const source = read('components/student/galaxy/StudentGalaxyMap.tsx')
  const matches = source.match(/label="Unirse al curso"/g) || []
  assert.ok(matches.length >= 2)
  assert.doesNotMatch(source, /styles\.joinButton/)
})

test('web supabase auth uses the browser lock lifecycle instead of the in-memory queue', () => {
  const source = read('lib/supabase.ts')
  assert.match(source, /\.\.\.\(!isWeb \? \{ lock: authProcessLock \} : \{\}\)/)
  assert.doesNotMatch(source, /storage: isWeb \? webStorage : AsyncStorage,\s*lock: authProcessLock/)
})

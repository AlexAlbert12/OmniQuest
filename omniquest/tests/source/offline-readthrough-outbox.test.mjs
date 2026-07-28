import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('offline cache is user-scoped, expiring and stale-while-revalidate', () => {
  const cache = read('lib/offlineCache.ts')
  assert.match(cache, /readThroughCache/)
  assert.match(cache, /getNetworkAvailability/)
  assert.match(cache, /CACHE_PREFIX/)
  assert.match(cache, /encodeURIComponent\(userId\)/)
  assert.match(cache, /DEFAULT_MAX_AGE_MS/)
  assert.match(cache, /source: 'cache'/)
  assert.match(cache, /source: 'network'/)
  assert.match(cache, /clearOfflineCacheForUser/)
})

test('non-game mutations use a durable outbox with retry and conflict policies', () => {
  const outbox = read('lib/offlineMutations.ts')
  for (const kind of ['notification.state', 'class.join', 'class.leave', 'profile.avatar', 'profile.cosmetics', 'badges.sync']) {
    assert.match(outbox, new RegExp(kind.replace('.', '\\.')))
  }
  assert.match(outbox, /OfflineConflictPolicy = 'client_wins' \| 'merge' \| 'server_wins'/)
  assert.match(outbox, /retryDelay/)
  assert.match(outbox, /MAX_ATTEMPTS/)
  assert.match(outbox, /mergePayload/)
  assert.match(outbox, /isDeleted: existing\.payload\.isDeleted === true \|\| input\.payload\.isDeleted === true/)
  assert.match(outbox, /conflictPolicy === 'server_wins'/)
  assert.match(outbox, /withQueueWrite/)
})

test('root provider exposes offline, cached, pending and failed sync states', () => {
  const layout = read('app/_layout.tsx')
  const provider = read('hooks/useOfflineSync.tsx')
  const banner = read('components/OfflineSyncBanner.tsx')
  assert.match(layout, /OfflineSyncProvider/)
  assert.match(layout, /readOfflineCache<CachedAuthProfile>/)
  assert.match(layout, /OfflineSyncBanner/)
  assert.match(provider, /subscribeToNetworkAvailability/)
  assert.match(provider, /flushOfflineMutations/)
  assert.match(banner, /Sin conexión/)
  assert.match(banner, /pendiente/)
  assert.match(banner, /Resolver/)
})

test('student courses, profile, badges, notifications, progress and history read through local cache', () => {
  const files = [
    'app/(student)/classes.tsx',
    'app/(student)/profile.tsx',
    'app/(student)/badges.tsx',
    'app/(student)/notifications.tsx',
    'app/(student)/progress.tsx',
    'app/(student)/activity-log.tsx',
  ]
  files.forEach((file) => assert.match(read(file), /readThroughCache/, `${file} must use read-through cache`))

  const notifications = read('hooks/useNotifications.ts')
  assert.match(notifications, /notifications:\$\{audience\}/)
  assert.match(notifications, /enqueueOfflineMutation/)
  assert.match(read('app/(student)/classes.tsx'), /kind: 'class\.join'/)
  assert.match(read('app/(student)/classes.tsx'), /kind: 'class\.leave'/)
  assert.match(read('app/(student)/profile.tsx'), /kind: 'profile\.cosmetics'/)
  assert.match(read('app/(student)/profile.tsx'), /stageAvatarForOffline/)
})

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import type { Json } from '../types/database.types'
import { equipProfileCosmetics } from './avatarCosmetics'
import { getNetworkAvailability } from './gameOffline'
import {
  getDatabaseNotificationId,
  persistNotificationStateToDb,
  updatePersistentNotificationState,
} from './notifications/persistent'
import { joinClassByInviteCode } from './studentClassJoin'
import { supabase } from './supabase'

const OUTBOX_KEY = 'omniquest:offline-outbox:v1'
const MAX_ATTEMPTS = 8

export type OfflineMutationKind =
  | 'badges.sync'
  | 'class.join'
  | 'class.leave'
  | 'notification.state'
  | 'profile.avatar'
  | 'profile.cosmetics'

export type OfflineConflictPolicy = 'client_wins' | 'merge' | 'server_wins'
export type OfflineMutationStatus = 'pending' | 'syncing' | 'retry' | 'conflict' | 'failed'

export type OfflineMutationEntry = {
  id: string
  userId: string
  kind: OfflineMutationKind
  entityKey: string
  payload: Record<string, Json | undefined>
  conflictPolicy: OfflineConflictPolicy
  status: OfflineMutationStatus
  attempts: number
  createdAt: number
  updatedAt: number
  nextRetryAt: number
  lastError: string | null
}

export type OfflineMutationSummary = {
  pending: number
  failed: number
  conflicts: number
  syncing: boolean
}

type MutationInput = Pick<OfflineMutationEntry, 'userId' | 'kind' | 'entityKey' | 'payload' | 'conflictPolicy'>
type OfflineMutationEvent = { type: 'changed' | 'synced'; userId?: string }

const listeners = new Set<(event: OfflineMutationEvent) => void>()
const flushes = new Map<string, Promise<void>>()
let queueWriteLock: Promise<void> = Promise.resolve()

export function subscribeOfflineMutations(listener: (event: OfflineMutationEvent) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function enqueueOfflineMutation(input: MutationInput) {
  const entry = await withQueueWrite(async () => {
    const queue = await loadQueue()
    const now = Date.now()
    const existingIndex = queue.findIndex((candidate) =>
      candidate.userId === input.userId
      && candidate.entityKey === input.entityKey
      && candidate.status !== 'syncing'
    )
    const nextEntry: OfflineMutationEntry = {
      id: existingIndex >= 0 ? queue[existingIndex].id : createMutationId(),
      ...input,
      payload: existingIndex >= 0 ? mergePayload(queue[existingIndex], input) : input.payload,
      status: 'pending',
      attempts: 0,
      createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : now,
      updatedAt: now,
      nextRetryAt: now,
      lastError: null,
    }
    if (existingIndex >= 0) {
      if (queue[existingIndex].kind === 'profile.avatar') {
        const previousUri = String(queue[existingIndex].payload.localUri || '')
        const nextUri = String(nextEntry.payload.localUri || '')
        if (previousUri && previousUri !== nextUri) void cleanupStagedFile(previousUri)
      }
      queue[existingIndex] = nextEntry
    } else {
      queue.push(nextEntry)
    }
    await saveQueue(queue)
    return nextEntry
  })

  if (await getNetworkAvailability()) void flushOfflineMutations(input.userId)
  return entry
}

export async function flushOfflineMutations(userId: string, force = false) {
  const existing = flushes.get(userId)
  if (existing) return existing

  const flush = runFlush(userId, force).finally(() => {
    flushes.delete(userId)
    emitChange()
  })
  flushes.set(userId, flush)
  emitChange()
  return flush
}

export async function retryOfflineMutations(userId: string) {
  await withQueueWrite(async () => {
    const queue = await loadQueue()
    const now = Date.now()
    const next = queue.map((entry) => entry.userId === userId && ['retry', 'failed', 'conflict'].includes(entry.status)
      ? { ...entry, status: 'pending' as const, nextRetryAt: now, lastError: null, updatedAt: now }
      : entry)
    await saveQueue(next)
  })
  await flushOfflineMutations(userId, true)
}

export async function discardOfflineMutationFailures(userId: string) {
  await withQueueWrite(async () => {
    const queue = await loadQueue()
    await saveQueue(queue.filter((entry) =>
      entry.userId !== userId || !['failed', 'conflict'].includes(entry.status)
    ))
  })
}

export async function getOfflineMutationSummary(userId: string | null): Promise<OfflineMutationSummary> {
  if (!userId) return { pending: 0, failed: 0, conflicts: 0, syncing: false }
  const entries = (await loadQueue()).filter((entry) => entry.userId === userId)
  return {
    pending: entries.filter((entry) => ['pending', 'retry', 'syncing'].includes(entry.status)).length,
    failed: entries.filter((entry) => entry.status === 'failed').length,
    conflicts: entries.filter((entry) => entry.status === 'conflict').length,
    syncing: entries.some((entry) => entry.status === 'syncing') || flushes.has(userId),
  }
}

export async function clearOfflineMutationsForUser(userId: string) {
  const removed = await withQueueWrite(async () => {
    const queue = await loadQueue()
    const userEntries = queue.filter((entry) => entry.userId === userId)
    await saveQueue(queue.filter((entry) => entry.userId !== userId))
    return userEntries
  })
  await Promise.all(removed
    .filter((entry) => entry.kind === 'profile.avatar')
    .map((entry) => cleanupStagedFile(String(entry.payload.localUri || ''))))
}

export async function stageAvatarForOffline(userId: string, uri: string) {
  if (Platform.OS === 'web') return uri
  if (!FileSystem.documentDirectory) throw new Error('El dispositivo no dispone de almacenamiento persistente.')
  const directory = `${FileSystem.documentDirectory}offline-outbox/`
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
  const target = `${directory}${encodeURIComponent(userId)}-${createMutationId()}.jpg`
  await FileSystem.copyAsync({ from: uri, to: target })
  return target
}

export function isRetriableOfflineError(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const status = Number(record.status || record.statusCode || 0)
  const code = String(record.code || '')
  const message = String(record.message || error || '').toLowerCase()
  return status >= 500
    || code.startsWith('5')
    || ['57014', 'PGRST000', 'PGRST001', 'PGRST002'].includes(code)
    || /network|fetch|timeout|timed out|connection|offline|internet/.test(message)
}

async function runFlush(userId: string, force: boolean) {
  if (!await getNetworkAvailability()) return

  const queue = await loadQueue()
  const candidates = queue.filter((entry) =>
    entry.userId === userId
    && ['pending', 'retry'].includes(entry.status)
    && (force || entry.nextRetryAt <= Date.now())
  )

  for (const candidate of candidates) {
    const current = await claimEntry(candidate.id)
    if (!current) continue

    try {
      await executeMutation(current)
      await removeEntry(current.id)
      emitChange({ type: 'synced', userId: current.userId })
      if (current.kind === 'profile.avatar') {
        await cleanupStagedFile(String(current.payload.localUri || ''))
      }
    } catch (error) {
      const attempts = current.attempts + 1
      const conflict = isConflictError(error)
      if (conflict && current.conflictPolicy === 'server_wins') {
        await removeEntry(current.id)
        emitChange({ type: 'synced', userId: current.userId })
        continue
      }
      const retriable = isRetriableOfflineError(error) && attempts < MAX_ATTEMPTS
      await updateEntry(current.id, {
        attempts,
        status: conflict ? 'conflict' : retriable ? 'retry' : 'failed',
        nextRetryAt: retriable ? Date.now() + retryDelay(attempts) : Number.MAX_SAFE_INTEGER,
        updatedAt: Date.now(),
        lastError: getSafeErrorMessage(error),
      })
      if (!retriable) continue
      break
    }
  }
}

async function claimEntry(id: string) {
  return withQueueWrite(async () => {
    const queue = await loadQueue()
    const index = queue.findIndex((entry) => entry.id === id && ['pending', 'retry'].includes(entry.status))
    if (index < 0) return null
    const claimed: OfflineMutationEntry = { ...queue[index], status: 'syncing', updatedAt: Date.now() }
    queue[index] = claimed
    await saveQueue(queue)
    return claimed
  })
}

async function executeMutation(entry: OfflineMutationEntry) {
  if (entry.kind === 'notification.state') {
    const notificationId = String(entry.payload.notificationId || '')
    const isRead = entry.payload.isRead === true
    const isDeleted = entry.payload.isDeleted === true
    const databaseId = getDatabaseNotificationId(notificationId)
    if (databaseId) {
      await updatePersistentNotificationState(databaseId, { read: isRead, deleted: isDeleted })
    } else {
      await persistNotificationStateToDb(entry.userId, notificationId, { isRead, isDeleted })
    }
    return
  }

  if (entry.kind === 'class.join') {
    await joinClassByInviteCode(String(entry.payload.code || ''))
    return
  }

  if (entry.kind === 'class.leave') {
    const subjectId = Number(entry.payload.subjectId)
    const classroomId = entry.payload.classroomId == null ? null : Number(entry.payload.classroomId)
    let query = supabase
      .from('enrollments')
      .delete()
      .eq('student_id', entry.userId)
      .eq('subject_id', subjectId)
    query = classroomId === null ? query.is('classroom_id', null) : query.eq('classroom_id', classroomId)
    const { error } = await query
    if (error) throw error
    return
  }

  if (entry.kind === 'profile.cosmetics') {
    await equipProfileCosmetics({
      frameKey: typeof entry.payload.frameKey === 'string' ? entry.payload.frameKey : null,
      featuredBadgeId: typeof entry.payload.featuredBadgeId === 'string' ? entry.payload.featuredBadgeId : null,
    })
    return
  }

  if (entry.kind === 'profile.avatar') {
    const localUri = String(entry.payload.localUri || '')
    if (!localUri) throw new Error('No se encontró la imagen pendiente.')
    const response = await fetch(localUri)
    if (!response.ok) throw new Error('No se pudo leer la imagen pendiente.')
    const blob = await response.blob()
    const fileName = `${entry.userId}/${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: false, contentType: blob.type || 'image/jpeg' })
    if (uploadError) throw uploadError
    const { data, error } = await supabase.functions.invoke('profile-update-avatar', {
      body: { avatarPath: fileName },
    })
    if (error) throw error
    if (data?.error) throw new Error(String(data.error))
    return
  }

  if (entry.kind === 'badges.sync') {
    const { error } = await supabase.rpc('sync_student_badges')
    if (error) throw error
  }
}

function mergePayload(existing: OfflineMutationEntry, input: MutationInput) {
  if (input.conflictPolicy === 'merge' && input.kind === 'notification.state') {
    return {
      ...existing.payload,
      ...input.payload,
      isRead: existing.payload.isRead === true || input.payload.isRead === true,
      isDeleted: existing.payload.isDeleted === true || input.payload.isDeleted === true,
    }
  }
  return input.payload
}

function isConflictError(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const code = String(record.code || '')
  const status = Number(record.status || record.statusCode || 0)
  return status === 409 || ['23503', '23505', 'PGRST116'].includes(code)
}

function retryDelay(attempt: number) {
  return Math.min(15 * 60 * 1000, 1000 * 2 ** Math.min(attempt, 8))
}

function getSafeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Error de sincronización')
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 240)
}

async function loadQueue(): Promise<OfflineMutationEntry[]> {
  const serialized = await AsyncStorage.getItem(OUTBOX_KEY)
  if (!serialized) return []
  try {
    const parsed = JSON.parse(serialized)
    return Array.isArray(parsed) ? parsed as OfflineMutationEntry[] : []
  } catch {
    await AsyncStorage.removeItem(OUTBOX_KEY)
    return []
  }
}

async function saveQueue(queue: OfflineMutationEntry[]) {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue))
  emitChange({ type: 'changed' })
}

async function updateEntry(id: string, patch: Partial<OfflineMutationEntry>) {
  await withQueueWrite(async () => {
    const queue = await loadQueue()
    await saveQueue(queue.map((entry) => entry.id === id ? { ...entry, ...patch } : entry))
  })
}

async function removeEntry(id: string) {
  await withQueueWrite(async () => {
    const queue = await loadQueue()
    await saveQueue(queue.filter((entry) => entry.id !== id))
  })
}

async function cleanupStagedFile(uri: string) {
  if (Platform.OS === 'web' || !uri.startsWith('file:')) return
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
}

function emitChange(event: OfflineMutationEvent = { type: 'changed' }) {
  listeners.forEach((listener) => listener(event))
}

function createMutationId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function withQueueWrite<T>(operation: () => Promise<T>) {
  const run = queueWriteLock.then(operation, operation)
  queueWriteLock = run.then(() => undefined, () => undefined)
  return run
}

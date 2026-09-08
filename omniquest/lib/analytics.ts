import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Json } from '../types/database.types'
import { supabase } from './supabase'

export type UsageEventName =
  | 'edge_function_error'
  | 'form_abandoned'
  | 'game_error'
  | 'game_resumed'
  | 'global_search'
  | 'question_viewed'
  | 'rpc_latency'
  | 'screen_view'
  | 'support_ticket_created'

export type UsageEventContext = {
  subjectId?: number | null
  classroomId?: number | null
  topicId?: number | null
  attemptId?: string | null
  properties?: Record<string, Json | undefined>
}

const ANALYTICS_SESSION_KEY = 'omniquest.analytics.session-id.v1'
const ANALYTICS_CONSENT_KEY_PREFIX = 'omniquest.analytics.consent.v1'
let cachedSessionId: string | null = null
const cachedConsent = new Map<string, boolean>()
const consentSyncs = new Map<string, Promise<boolean>>()

export async function syncAnalyticsConsentFromServer(userId?: string, force = false) {
  const resolvedUserId = userId || await getCurrentUserId()
  if (!resolvedUserId) return false
  if (!force && cachedConsent.has(resolvedUserId)) return cachedConsent.get(resolvedUserId) === true

  const existingSync = consentSyncs.get(resolvedUserId)
  if (existingSync) return existingSync

  const sync = (async () => {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('analytics_enabled')
      .eq('user_id', resolvedUserId)
      .maybeSingle()

    const enabled = !error && data?.analytics_enabled === true
    await cacheAnalyticsConsent(resolvedUserId, enabled)
    return enabled
  })().finally(() => {
    consentSyncs.delete(resolvedUserId)
  })

  consentSyncs.set(resolvedUserId, sync)
  return sync
}

export async function updateAnalyticsConsent(enabled: boolean) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('No hay una sesión activa.')

  const { data, error } = await supabase.rpc('set_analytics_consent', {
    p_enabled: enabled,
  })
  if (error) throw error

  const savedValue = data === true
  await cacheAnalyticsConsent(userId, savedValue)
  return savedValue
}

export async function isAnalyticsEnabled() {
  const userId = await getCurrentUserId()
  if (!userId) return false
  if (cachedConsent.has(userId)) return cachedConsent.get(userId) === true

  const stored = await AsyncStorage.getItem(getConsentStorageKey(userId))
  if (stored === 'true' || stored === 'false') {
    const enabled = stored === 'true'
    cachedConsent.set(userId, enabled)
    return enabled
  }

  return syncAnalyticsConsentFromServer(userId)
}

export async function trackUsageEvent(eventName: UsageEventName, context: UsageEventContext = {}) {
  try {
    if (!await isAnalyticsEnabled()) return false

    const sessionId = await getAnalyticsSessionId()
    const properties = compactProperties(context.properties)
    const { error } = await supabase.rpc('track_usage_event', {
      p_event_name: eventName,
      p_properties: properties,
      p_subject_id: context.subjectId ?? undefined,
      p_classroom_id: context.classroomId ?? undefined,
      p_topic_id: context.topicId ?? undefined,
      p_attempt_id: context.attemptId ?? undefined,
      p_session_id: sessionId,
    })

    if (error) {
      console.warn(`[analytics] ${eventName}:`, error.message)
      return false
    }

    return true
  } catch (error) {
    console.warn(`[analytics] ${eventName}:`, error)
    return false
  }
}

export async function trackScreenView(pathname: string, routeGroup?: string | null) {
  const screen = sanitizeAnalyticsPath(pathname)
  if (!screen) return false

  return trackUsageEvent('screen_view', {
    properties: {
      screen,
      route_group: routeGroup || 'root',
    },
  })
}

export async function measureRpc<T>(
  rpcName: string,
  operation: () => Promise<T>,
  context: Omit<UsageEventContext, 'properties'> & {
    properties?: Record<string, Json | undefined>
  } = {},
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await operation()
    const error = getResultError(result)
    void trackUsageEvent('rpc_latency', {
      ...context,
      properties: {
        ...context.properties,
        rpc: rpcName,
        duration_ms: Date.now() - startedAt,
        success: !error,
        ...(error ? { error_code: getErrorCode(error) } : {}),
      },
    })
    return result
  } catch (error) {
    void trackUsageEvent('rpc_latency', {
      ...context,
      properties: {
        ...context.properties,
        rpc: rpcName,
        duration_ms: Date.now() - startedAt,
        success: false,
        error_code: getErrorCode(error),
      },
    })
    throw error
  }
}

export async function invokeEdgeFunction(
  functionName: string,
  options: { body?: unknown; headers?: Record<string, string>; method?: string } = {},
) {
  const startedAt = Date.now()
  try {
    const result = await supabase.functions.invoke(functionName, options as any)
    if (result.error) {
      void trackUsageEvent('edge_function_error', {
        properties: {
          function_name: functionName,
          duration_ms: Date.now() - startedAt,
          error_code: getErrorCode(result.error),
        },
      })
    }
    return result
  } catch (error) {
    void trackUsageEvent('edge_function_error', {
      properties: {
        function_name: functionName,
        duration_ms: Date.now() - startedAt,
        error_code: getErrorCode(error),
      },
    })
    throw error
  }
}

export function toSafeAnalyticsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 240)
}

async function getAnalyticsSessionId() {
  if (cachedSessionId) return cachedSessionId

  const stored = await AsyncStorage.getItem(ANALYTICS_SESSION_KEY)
  if (stored) {
    cachedSessionId = stored
    return stored
  }

  const next = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  cachedSessionId = next
  await AsyncStorage.setItem(ANALYTICS_SESSION_KEY, next)
  return next
}

function compactProperties(properties: UsageEventContext['properties']) {
  if (!properties) return {}

  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, Json] => entry[1] !== undefined)
  )
}

function sanitizeAnalyticsPath(pathname: string) {
  return String(pathname || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':uuid')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 180)
}

async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.is_anonymous) return null
  return data.session?.user.id || null
}

async function cacheAnalyticsConsent(userId: string, enabled: boolean) {
  cachedConsent.set(userId, enabled)
  await AsyncStorage.setItem(getConsentStorageKey(userId), String(enabled))
}

function getConsentStorageKey(userId: string) {
  return `${ANALYTICS_CONSENT_KEY_PREFIX}:${userId}`
}

function getResultError(value: unknown) {
  if (!value || typeof value !== 'object' || !('error' in value)) return null
  return (value as { error?: unknown }).error || null
}

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code.slice(0, 80)
  }
  return 'unknown'
}

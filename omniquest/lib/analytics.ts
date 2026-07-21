import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Json } from '../types/database.types'
import { supabase } from './supabase'

export type UsageEventName =
  | 'game_error'
  | 'game_resumed'
  | 'global_search'
  | 'support_ticket_created'

export type UsageEventContext = {
  subjectId?: number | null
  classroomId?: number | null
  topicId?: number | null
  attemptId?: string | null
  properties?: Record<string, Json | undefined>
}

const ANALYTICS_SESSION_KEY = 'omniquest.analytics.session-id.v1'
let cachedSessionId: string | null = null

export async function trackUsageEvent(eventName: UsageEventName, context: UsageEventContext = {}) {
  try {
    const sessionId = await getAnalyticsSessionId()
    const properties = compactProperties(context.properties)
    const { error } = await (supabase.rpc as any)('track_usage_event', {
      p_event_name: eventName,
      p_properties: properties,
      p_subject_id: context.subjectId ?? null,
      p_classroom_id: context.classroomId ?? null,
      p_topic_id: context.topicId ?? null,
      p_attempt_id: context.attemptId ?? null,
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

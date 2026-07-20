import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'
const MAX_EXPO_BATCH = 100

export type PushContent = {
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  channelId?: string
}

export type PushDeliveryResult = {
  attempted: number
  sent: number
  failed: number
  skipped: boolean
  reason?: string
}

type PushTokenRow = {
  id: number
  expo_push_token: string
}

export async function sendExpoPushToUser(
  adminClient: SupabaseClient,
  userId: string,
  content: PushContent,
): Promise<PushDeliveryResult> {
  const { data: preference, error: preferenceError } = await adminClient
    .from('user_notification_preferences')
    .select('push_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (preferenceError) throw preferenceError
  if (!preference?.push_enabled) {
    return { attempted: 0, sent: 0, failed: 0, skipped: true, reason: 'push_disabled' }
  }

  const { data: tokenRows, error: tokenError } = await adminClient
    .from('push_tokens')
    .select('id, expo_push_token')
    .eq('user_id', userId)
    .eq('active', true)
    .order('last_seen_at', { ascending: false })

  if (tokenError) throw tokenError

  const tokens = ((tokenRows || []) as PushTokenRow[])
    .filter((row) => /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(row.expo_push_token))

  if (tokens.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, skipped: true, reason: 'no_active_tokens' }
  }

  let sent = 0
  let failed = 0

  for (let index = 0; index < tokens.length; index += MAX_EXPO_BATCH) {
    const batch = tokens.slice(index, index + MAX_EXPO_BATCH)
    const messages = batch.map((row) => ({
      to: row.expo_push_token,
      title: content.title.slice(0, 100),
      body: content.body.slice(0, 500),
      sound: content.sound ?? 'default',
      channelId: content.channelId ?? 'default',
      data: content.data ?? {},
    }))

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    if (!response.ok) {
      failed += batch.length
      continue
    }

    const payload = await response.json().catch(() => ({})) as {
      data?: Array<{ status?: string; details?: { error?: string } }>
    }
    const tickets = Array.isArray(payload.data) ? payload.data : []

    for (let ticketIndex = 0; ticketIndex < batch.length; ticketIndex += 1) {
      const ticket = tickets[ticketIndex]
      const tokenRow = batch[ticketIndex]
      if (ticket?.status === 'ok') {
        sent += 1
        continue
      }

      failed += 1
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await adminClient
          .from('push_tokens')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', tokenRow.id)
      }
    }
  }

  return { attempted: tokens.length, sent, failed, skipped: false }
}

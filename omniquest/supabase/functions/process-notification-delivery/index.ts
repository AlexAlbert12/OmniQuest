import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'
import {
  getExpoPushReceipts,
  isValidExpoPushToken,
  MAX_EXPO_BATCH,
  MAX_EXPO_RECEIPTS_BATCH,
  sendExpoPushBatch,
  type ExpoPushMessage,
} from '../_shared/push.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const USER_RATE_LIMIT = 10
const USER_RATE_WINDOW_MINUTES = 5
const RECEIPT_DELAY_MINUTES = 15
const RECEIPT_EXPIRY_HOURS = 24

type QueueRow = {
  queue_id: number
  notification_id: string
  user_id: string
  delivery_cycle: number
  attempts: number
  max_attempts: number
  priority: 'low' | 'normal' | 'high'
}

type NotificationRow = {
  id: string
  user_id: string
  title: string
  description: string
  action_url: string | null
  metadata: Record<string, unknown> | null
  deleted_at: string | null
}

type PushTokenRow = {
  id: number
  expo_push_token: string
}

type TicketedDeliveryRow = {
  id: number
  queue_id: number
  delivery_cycle: number
  push_token_id: number | null
  expo_ticket_id: string
  sent_at: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    const configuredSecret = Deno.env.get('PUSH_QUEUE_SECRET')?.trim()
    if (!supabaseUrl || !serviceRoleKey) {
      return publicErrorResponse('El procesador push no está configurado.', 500, 'service_unavailable')
    }

    const authorization = req.headers.get('Authorization') || ''
    const suppliedSecret = req.headers.get('x-cron-secret')?.trim()
    const authorizedByServiceRole = authorization === `Bearer ${serviceRoleKey}`
    const authorizedByCronSecret = Boolean(configuredSecret && suppliedSecret && suppliedSecret === configuredSecret)
    if (!authorizedByServiceRole && !authorizedByCronSecret) {
      return publicErrorResponse('No autorizado.', 401, 'unauthorized')
    }

    const requestBody = await req.json().catch(() => ({})) as { limit?: number }
    const limit = Math.max(1, Math.min(Number(requestBody.limit) || 50, 100))
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const receiptSummary = await processReceipts(adminClient)
    const workerId = crypto.randomUUID()
    const { data: claimed, error: claimError } = await adminClient.rpc('claim_notification_delivery_batch', {
      p_worker_id: workerId,
      p_limit: limit,
    })
    if (claimError) throw claimError

    const queues = (claimed || []) as QueueRow[]
    const queueSummary = {
      claimed: queues.length,
      completed: 0,
      waitingReceipts: 0,
      retried: 0,
      skipped: 0,
      failed: 0,
    }

    for (const queue of queues) {
      const result = await processQueueItem(adminClient, queue)
      queueSummary[result] += 1
    }

    return json({ ok: true, workerId, queue: queueSummary, receipts: receiptSummary })
  } catch (error) {
    return errorResponse(error, 'No se pudo procesar la cola de notificaciones.', {
      functionName: 'process-notification-delivery',
    })
  }
})

async function processQueueItem(
  adminClient: SupabaseClient,
  queue: QueueRow,
): Promise<'completed' | 'waitingReceipts' | 'retried' | 'skipped' | 'failed'> {
  try {
    const { data: notification, error: notificationError } = await adminClient
      .from('notifications')
      .select('id, user_id, title, description, action_url, metadata, deleted_at')
      .eq('id', queue.notification_id)
      .maybeSingle()

    if (notificationError) throw notificationError
    const notificationRow = notification as NotificationRow | null
    if (!notificationRow || notificationRow.deleted_at) {
      await finishQueue(adminClient, queue.queue_id, 'skipped', {
        skip_reason: notificationRow ? 'notification_deleted' : 'notification_missing',
      })
      return 'skipped'
    }

    const { data: preference, error: preferenceError } = await adminClient
      .from('user_notification_preferences')
      .select('push_enabled')
      .eq('user_id', queue.user_id)
      .maybeSingle()
    if (preferenceError) throw preferenceError
    if (!preference?.push_enabled) {
      await finishQueue(adminClient, queue.queue_id, 'skipped', { skip_reason: 'push_disabled' })
      return 'skipped'
    }

    const rateWindow = new Date(Date.now() - USER_RATE_WINDOW_MINUTES * 60_000).toISOString()
    const { count: recentDeliveries, error: rateError } = await adminClient
      .from('notification_push_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', queue.user_id)
      .in('status', ['ticketed', 'delivered'])
      .gte('sent_at', rateWindow)
    if (rateError) throw rateError

    if ((recentDeliveries || 0) >= USER_RATE_LIMIT) {
      await retryQueue(adminClient, queue, 'user_rate_limited', `Máximo de ${USER_RATE_LIMIT} notificaciones cada ${USER_RATE_WINDOW_MINUTES} minutos.`, 300)
      return 'retried'
    }

    const { data: tokenRows, error: tokenError } = await adminClient
      .from('push_tokens')
      .select('id, expo_push_token')
      .eq('user_id', queue.user_id)
      .eq('active', true)
      .order('last_seen_at', { ascending: false })
    if (tokenError) throw tokenError

    const tokens = ((tokenRows || []) as PushTokenRow[])
      .filter((row) => isValidExpoPushToken(row.expo_push_token))
    if (tokens.length === 0) {
      await finishQueue(adminClient, queue.queue_id, 'skipped', { skip_reason: 'no_active_tokens' })
      return 'skipped'
    }

    let ticketed = 0
    let failed = 0
    let retryableFailure: string | null = null

    for (let index = 0; index < tokens.length; index += MAX_EXPO_BATCH) {
      const batch = tokens.slice(index, index + MAX_EXPO_BATCH)
      const deliveryRows = batch.map((token) => ({
        queue_id: queue.queue_id,
        user_id: queue.user_id,
        delivery_cycle: queue.delivery_cycle,
        push_token_id: token.id,
        status: 'pending',
        attempt_number: queue.attempts,
        expo_ticket_id: null,
        error_code: null,
        error_message: null,
        sent_at: null,
        receipt_checked_at: null,
        delivered_at: null,
        updated_at: new Date().toISOString(),
      }))
      const { error: deliveryInsertError } = await adminClient
        .from('notification_push_deliveries')
        .upsert(deliveryRows, { onConflict: 'queue_id,delivery_cycle,push_token_id' })
      if (deliveryInsertError) throw deliveryInsertError

      const messages: ExpoPushMessage[] = batch.map((token) => ({
        to: token.expo_push_token,
        title: notificationRow.title.slice(0, 100),
        body: notificationRow.description.slice(0, 500),
        sound: 'default',
        channelId: 'default',
        priority: queue.priority === 'high' ? 'high' : 'default',
        ttl: 86_400,
        data: {
          ...(notificationRow.metadata || {}),
          notificationId: notificationRow.id,
          ...(notificationRow.action_url ? { url: notificationRow.action_url } : {}),
        },
      }))

      const sendResult = await sendExpoPushBatch(messages)
      if (!sendResult.ok) {
        const message = sendResult.errorMessage || `Expo Push devolvió HTTP ${sendResult.status}.`
        if (sendResult.retryable) retryableFailure = message

        await adminClient
          .from('notification_push_deliveries')
          .update({
            status: 'failed',
            error_code: sendResult.retryable ? 'expo_retryable_request' : 'expo_request_error',
            error_message: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('queue_id', queue.queue_id)
          .eq('delivery_cycle', queue.delivery_cycle)
          .in('push_token_id', batch.map((token) => token.id))
        failed += batch.length
        continue
      }

      for (let ticketIndex = 0; ticketIndex < batch.length; ticketIndex += 1) {
        const ticket = sendResult.tickets[ticketIndex]
        const token = batch[ticketIndex]
        const now = new Date().toISOString()

        if (ticket?.status === 'ok' && ticket.id) {
          ticketed += 1
          await adminClient
            .from('notification_push_deliveries')
            .update({
              status: 'ticketed',
              expo_ticket_id: ticket.id,
              sent_at: now,
              error_code: null,
              error_message: null,
              updated_at: now,
            })
            .eq('queue_id', queue.queue_id)
            .eq('delivery_cycle', queue.delivery_cycle)
            .eq('push_token_id', token.id)
          continue
        }

        failed += 1
        const errorCode = String(ticket?.details?.error || 'expo_ticket_error')
        const errorMessage = String(ticket?.message || 'Expo rechazó la notificación.').slice(0, 500)
        await adminClient
          .from('notification_push_deliveries')
          .update({
            status: 'failed',
            error_code: errorCode,
            error_message: errorMessage,
            sent_at: now,
            updated_at: now,
          })
          .eq('queue_id', queue.queue_id)
          .eq('delivery_cycle', queue.delivery_cycle)
          .eq('push_token_id', token.id)

        if (errorCode === 'DeviceNotRegistered') {
          await deactivateToken(adminClient, token.id)
        } else if (errorCode === 'MessageRateExceeded') {
          retryableFailure = errorMessage
        }
      }
    }

    if (ticketed > 0) {
      await finishQueue(adminClient, queue.queue_id, 'waiting_receipt')
      return 'waitingReceipts'
    }

    if (retryableFailure && queue.attempts < queue.max_attempts) {
      await retryQueue(
        adminClient,
        queue,
        'expo_retryable_request',
        retryableFailure,
        retryDelaySeconds(queue.attempts),
      )
      return 'retried'
    }

    await finishQueue(adminClient, queue.queue_id, 'failed', {
      last_error_code: 'all_devices_failed',
      last_error_message: `${failed} entrega${failed === 1 ? '' : 's'} fallida${failed === 1 ? '' : 's'}.`,
    })
    return 'failed'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (queue.attempts < queue.max_attempts) {
      await retryQueue(adminClient, queue, 'worker_error', message, retryDelaySeconds(queue.attempts))
      return 'retried'
    }

    await finishQueue(adminClient, queue.queue_id, 'failed', {
      last_error_code: 'worker_error',
      last_error_message: message.slice(0, 500),
    })
    return 'failed'
  }
}

async function processReceipts(adminClient: SupabaseClient) {
  const receiptCutoff = new Date(Date.now() - RECEIPT_DELAY_MINUTES * 60_000).toISOString()
  const receiptExpiry = new Date(Date.now() - RECEIPT_EXPIRY_HOURS * 60 * 60_000).toISOString()
  const { data, error } = await adminClient
    .from('notification_push_deliveries')
    .select('id, queue_id, delivery_cycle, push_token_id, expo_ticket_id, sent_at')
    .eq('status', 'ticketed')
    .not('expo_ticket_id', 'is', null)
    .lte('sent_at', receiptCutoff)
    .order('sent_at', { ascending: true })
    .limit(MAX_EXPO_RECEIPTS_BATCH)
  if (error) throw error

  const deliveries = (data || []) as TicketedDeliveryRow[]
  if (deliveries.length === 0) {
    return { checked: 0, delivered: 0, failed: 0, pending: 0 }
  }

  const receiptResult = await getExpoPushReceipts(deliveries.map((delivery) => delivery.expo_ticket_id))
  if (!receiptResult.ok) {
    return {
      checked: 0,
      delivered: 0,
      failed: 0,
      pending: deliveries.length,
      error: receiptResult.errorMessage,
    }
  }

  let deliveredCount = 0
  let failedCount = 0
  let pendingCount = 0
  const touchedQueues = new Map<number, number>()

  for (const delivery of deliveries) {
    const receipt = receiptResult.receipts[delivery.expo_ticket_id]
    touchedQueues.set(delivery.queue_id, delivery.delivery_cycle)

    if (!receipt) {
      if (delivery.sent_at <= receiptExpiry) {
        failedCount += 1
        await adminClient
          .from('notification_push_deliveries')
          .update({
            status: 'failed',
            error_code: 'receipt_expired',
            error_message: 'Expo no devolvió un recibo dentro de las 24 horas.',
            receipt_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id)
      } else {
        pendingCount += 1
      }
      continue
    }

    const now = new Date().toISOString()
    if (receipt.status === 'ok') {
      deliveredCount += 1
      await adminClient
        .from('notification_push_deliveries')
        .update({
          status: 'delivered',
          receipt_checked_at: now,
          delivered_at: now,
          error_code: null,
          error_message: null,
          updated_at: now,
        })
        .eq('id', delivery.id)
      continue
    }

    failedCount += 1
    const errorCode = String(receipt.details?.error || 'expo_receipt_error')
    await adminClient
      .from('notification_push_deliveries')
      .update({
        status: 'failed',
        receipt_checked_at: now,
        error_code: errorCode,
        error_message: String(receipt.message || 'La entrega fue rechazada por el proveedor.').slice(0, 500),
        updated_at: now,
      })
      .eq('id', delivery.id)

    if (errorCode === 'DeviceNotRegistered' && delivery.push_token_id) {
      await deactivateToken(adminClient, delivery.push_token_id)
    }
  }

  for (const [queueId, cycle] of touchedQueues.entries()) {
    await refreshQueueFromDeliveries(adminClient, queueId, cycle)
  }

  return {
    checked: deliveredCount + failedCount,
    delivered: deliveredCount,
    failed: failedCount,
    pending: pendingCount,
  }
}

async function refreshQueueFromDeliveries(adminClient: SupabaseClient, queueId: number, cycle: number) {
  const { data: queue } = await adminClient
    .from('notification_delivery_queue')
    .select('delivery_cycle, attempts, max_attempts')
    .eq('id', queueId)
    .maybeSingle()
  if (!queue || Number(queue.delivery_cycle) !== cycle) return

  const { data, error } = await adminClient
    .from('notification_push_deliveries')
    .select('status, error_code')
    .eq('queue_id', queueId)
    .eq('delivery_cycle', cycle)
  if (error) throw error

  const deliveryRows = (data || []) as Array<{ status: string; error_code: string | null }>
  const statuses = deliveryRows.map((row) => row.status)
  if (statuses.some((status) => status === 'ticketed' || status === 'pending')) {
    await finishQueue(adminClient, queueId, 'waiting_receipt')
    return
  }

  if (statuses.some((status) => status === 'delivered')) {
    await finishQueue(adminClient, queueId, 'completed')
    return
  }

  const hasRetryableFailure = deliveryRows.some((row) => row.error_code === 'MessageRateExceeded')
  if (hasRetryableFailure && Number(queue.attempts) < Number(queue.max_attempts)) {
    const { error: retryError } = await adminClient
      .from('notification_delivery_queue')
      .update({
        status: 'pending',
        next_attempt_at: new Date(
          Date.now() + retryDelaySeconds(Number(queue.attempts)) * 1000,
        ).toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_code: 'expo_message_rate_exceeded',
        last_error_message: 'Expo solicitó reducir la velocidad de envío.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId)
    if (retryError) throw retryError
    return
  }

  await finishQueue(adminClient, queueId, 'failed', {
    last_error_code: 'all_receipts_failed',
    last_error_message: 'Ningún dispositivo aceptó la notificación.',
  })
}

async function finishQueue(
  adminClient: SupabaseClient,
  queueId: number,
  status: 'waiting_receipt' | 'completed' | 'failed' | 'skipped',
  values: Record<string, unknown> = {},
) {
  const terminal = status === 'completed' || status === 'failed' || status === 'skipped'
  const { error } = await adminClient
    .from('notification_delivery_queue')
    .update({
      status,
      locked_at: null,
      locked_by: null,
      ...(terminal ? { completed_at: new Date().toISOString() } : {}),
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq('id', queueId)
  if (error) throw error
}

async function retryQueue(
  adminClient: SupabaseClient,
  queue: QueueRow,
  code: string,
  message: string,
  delaySeconds: number,
) {
  const { error } = await adminClient
    .from('notification_delivery_queue')
    .update({
      status: 'pending',
      next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      locked_at: null,
      locked_by: null,
      last_error_code: code,
      last_error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', queue.queue_id)
  if (error) throw error
}

async function deactivateToken(adminClient: SupabaseClient, tokenId: number) {
  await adminClient
    .from('push_tokens')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', tokenId)
}

function retryDelaySeconds(attempt: number) {
  return Math.min(3600, Math.max(60, 60 * (2 ** Math.max(0, attempt - 1))))
}

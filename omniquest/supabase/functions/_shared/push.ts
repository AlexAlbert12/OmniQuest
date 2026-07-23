export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'
export const EXPO_RECEIPTS_ENDPOINT = 'https://exp.host/--/api/v2/push/getReceipts'
export const MAX_EXPO_BATCH = 100
export const MAX_EXPO_RECEIPTS_BATCH = 1000

export type ExpoPushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
  ttl?: number
}

export type ExpoPushTicket = {
  status?: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string; [key: string]: unknown }
}

export type ExpoPushReceipt = {
  status?: 'ok' | 'error'
  message?: string
  details?: { error?: string; [key: string]: unknown }
}

export type ExpoPushBatchResult = {
  ok: boolean
  status: number
  tickets: ExpoPushTicket[]
  requestErrors: Array<{ code?: string; message?: string }>
  retryable: boolean
  errorMessage?: string
}

export type ExpoReceiptBatchResult = {
  ok: boolean
  status: number
  receipts: Record<string, ExpoPushReceipt>
  requestErrors: Array<{ code?: string; message?: string }>
  retryable: boolean
  errorMessage?: string
}

export function isValidExpoPushToken(value: string) {
  return /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(value)
}

export function isRetryableExpoStatus(status: number) {
  return status === 429 || status >= 500
}

function expoHeaders() {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim()
  return {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
}

export async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<ExpoPushBatchResult> {
  if (messages.length === 0) {
    return { ok: true, status: 200, tickets: [], requestErrors: [], retryable: false }
  }

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify(messages.slice(0, MAX_EXPO_BATCH)),
  })

  const payload = await response.json().catch(() => ({})) as {
    data?: ExpoPushTicket[] | ExpoPushTicket
    errors?: Array<{ code?: string; message?: string }>
  }
  const tickets = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data]
      : []
  const requestErrors = Array.isArray(payload.errors) ? payload.errors : []
  const errorMessage = requestErrors.map((error) => error.message).filter(Boolean).join(' · ')

  return {
    ok: response.ok,
    status: response.status,
    tickets,
    requestErrors,
    retryable: isRetryableExpoStatus(response.status)
      || requestErrors.some((error) => error.code === 'TOO_MANY_REQUESTS'),
    errorMessage: errorMessage || (response.ok ? undefined : `Expo Push devolvió HTTP ${response.status}.`),
  }
}

export async function getExpoPushReceipts(ticketIds: string[]): Promise<ExpoReceiptBatchResult> {
  if (ticketIds.length === 0) {
    return { ok: true, status: 200, receipts: {}, requestErrors: [], retryable: false }
  }

  const response = await fetch(EXPO_RECEIPTS_ENDPOINT, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify({ ids: ticketIds.slice(0, MAX_EXPO_RECEIPTS_BATCH) }),
  })

  const payload = await response.json().catch(() => ({})) as {
    data?: Record<string, ExpoPushReceipt>
    errors?: Array<{ code?: string; message?: string }>
  }
  const requestErrors = Array.isArray(payload.errors) ? payload.errors : []
  const errorMessage = requestErrors.map((error) => error.message).filter(Boolean).join(' · ')

  return {
    ok: response.ok,
    status: response.status,
    receipts: payload.data && typeof payload.data === 'object' ? payload.data : {},
    requestErrors,
    retryable: isRetryableExpoStatus(response.status)
      || requestErrors.some((error) => error.code === 'TOO_MANY_REQUESTS'),
    errorMessage: errorMessage || (response.ok ? undefined : `Expo Receipts devolvió HTTP ${response.status}.`),
  }
}

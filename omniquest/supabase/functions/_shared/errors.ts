export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type EdgeErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'service_unavailable'
  | 'internal_error'

export class PublicFunctionError extends Error {
  code: EdgeErrorCode
  status: number
  details?: Record<string, unknown>

  constructor(message: string, status = 400, code: EdgeErrorCode = 'bad_request', details?: Record<string, unknown>) {
    super(message)
    this.name = 'PublicFunctionError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function publicError(
  message: string,
  status = 400,
  code: EdgeErrorCode = 'bad_request',
  details?: Record<string, unknown>,
): PublicFunctionError {
  return new PublicFunctionError(message, status, code, details)
}

export function publicErrorResponse(
  message: string,
  status = 400,
  code: EdgeErrorCode = 'bad_request',
  details?: Record<string, unknown>,
) {
  return json({ error: message, code, ...(details ? { details } : {}) }, status)
}

export function methodNotAllowedResponse() {
  return publicErrorResponse('Método no permitido.', 405, 'bad_request')
}


export function getPublicErrorMessage(error: unknown, fallbackMessage = 'No se pudo completar la acción.') {
  if (error instanceof PublicFunctionError) return error.message
  return fallbackMessage
}

export function logInternalError(
  error: unknown,
  context: { functionName?: string; metadata?: Record<string, unknown> } = {},
) {
  const requestId = crypto.randomUUID()
  const functionName = context.functionName || 'edge-function'
  console.error(`[${functionName}] unexpected error`, {
    requestId,
    metadata: context.metadata || {},
    error: serializeError(error),
  })
  scheduleOperationalErrorWrite(functionName, requestId, error)
  return requestId
}

export function errorResponse(
  error: unknown,
  fallbackMessage = 'No se pudo completar la acción. Inténtalo de nuevo.',
  context: { functionName?: string; metadata?: Record<string, unknown> } = {},
) {
  if (error instanceof PublicFunctionError) {
    return json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    }, error.status)
  }

  const requestId = logInternalError(error, context)

  return json({
    error: fallbackMessage,
    code: 'internal_error',
    requestId,
  }, 500)
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return {
      message: record.message,
      code: record.code,
      details: record.details,
      hint: record.hint,
    }
  }

  return { message: String(error) }
}

export function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}

function scheduleOperationalErrorWrite(functionName: string, requestId: string, error: unknown) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return

  const serialized = serializeError(error)
  const write = fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      role: 'system',
      event_name: 'edge_function_error',
      purpose: 'operational',
      properties: {
        function_name: functionName.slice(0, 120),
        request_id: requestId,
        error_name: typeof serialized.name === 'string' ? serialized.name.slice(0, 80) : undefined,
        error_code: typeof serialized.code === 'string' ? serialized.code.slice(0, 80) : undefined,
        message: typeof serialized.message === 'string'
          ? serialized.message.replace(/[\r\n\t]+/g, ' ').slice(0, 240)
          : undefined,
      },
    }),
  }).catch((writeError) => {
    console.error(`[${functionName}] could not persist operational error`, writeError)
  })

  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void }
  }).EdgeRuntime
  runtime?.waitUntil?.(write)
}

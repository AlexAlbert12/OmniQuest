import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicError } from '../_shared/errors.ts'

type AuthAction = 'sign_in' | 'sign_up' | 'password_recovery' | 'resend_verification' | 'anonymous_sign_in'

type GuardRequest = {
  action?: AuthAction
  identifier?: string
}

type LimitConfig = {
  identifierLimit: number
  ipLimit: number
  windowSeconds: number
  blockSeconds: number
}

const limits: Record<AuthAction, LimitConfig> = {
  sign_in: { identifierLimit: 10, ipLimit: 30, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  sign_up: { identifierLimit: 5, ipLimit: 15, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  password_recovery: { identifierLimit: 3, ipLimit: 10, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  resend_verification: { identifierLimit: 3, ipLimit: 12, windowSeconds: 15 * 60, blockSeconds: 30 * 60 },
  anonymous_sign_in: { identifierLimit: 10, ipLimit: 20, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({ ok: true })
  if (request.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const pepper = Deno.env.get('AUTH_RATE_LIMIT_PEPPER')
    if (!supabaseUrl || !serviceRoleKey || !pepper) {
      throw publicError('El control de intentos no está configurado.', 503, 'service_unavailable')
    }

    const body = await request.json().catch(() => ({})) as GuardRequest
    if (!body.action || !(body.action in limits)) {
      throw publicError('Acción de autenticación no válida.', 400, 'bad_request')
    }

    const identifier = normalizeIdentifier(body.identifier)
    if (!identifier) throw publicError('Falta el identificador de la solicitud.', 400, 'bad_request')

    const ip = readClientIp(request)
    const config = limits[body.action]
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const identifierKey = await hash(`${pepper}|identifier|${body.action}|${identifier}`)
    const identifierPromise = consume(
      admin,
      identifierKey,
      body.action,
      config.identifierLimit,
      config.windowSeconds,
      config.blockSeconds,
    )
    const ipPromise = ip
      ? hash(`${pepper}|ip|${body.action}|${ip}`).then((ipKey) => consume(
          admin,
          ipKey,
          body.action,
          config.ipLimit,
          config.windowSeconds,
          config.blockSeconds,
        ))
      : Promise.resolve({ allowed: true, retryAfterSeconds: 0, remaining: config.ipLimit })

    const [identifierResult, ipResult] = await Promise.all([identifierPromise, ipPromise])

    const allowed = identifierResult.allowed && ipResult.allowed
    const retryAfterSeconds = Math.max(identifierResult.retryAfterSeconds, ipResult.retryAfterSeconds)
    const remaining = Math.min(identifierResult.remaining, ipResult.remaining)

    return json({ allowed, retryAfterSeconds, remaining })
  } catch (error) {
    return errorResponse(error, 'No se pudo comprobar el límite de intentos.', {
      functionName: 'auth-attempt-guard',
    })
  }
})

async function consume(
  admin: ReturnType<typeof createClient>,
  keyHash: string,
  action: AuthAction,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
) {
  const { data, error } = await admin.rpc('consume_auth_rate_limit', {
    p_key_hash: keyHash,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  })
  if (error) throw error
  const result = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}
  return {
    allowed: result.allowed !== false,
    retryAfterSeconds: Math.max(0, Number(result.retry_after_seconds || 0)),
    remaining: Math.max(0, Number(result.remaining || 0)),
  }
}

function normalizeIdentifier(value: unknown) {
  return String(value || '').trim().toLowerCase().slice(0, 320)
}

function readClientIp(request: Request) {
  const direct = request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
  if (direct) return direct.slice(0, 80)

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded ? forwarded.slice(0, 80) : null
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

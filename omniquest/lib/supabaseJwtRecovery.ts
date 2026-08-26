import { supabase } from './supabase'

type SupabaseErrorResult = {
  error: unknown | null
}

const RECOVERY_COOLDOWN_MS = 5_000

let recoveryPromise: Promise<boolean> | null = null
let lastSuccessfulRecoveryAt = 0

export function isJwtIssuedInFutureError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: unknown; message?: unknown }
  return candidate.code === 'PGRST303'
    && typeof candidate.message === 'string'
    && /jwt issued at future/i.test(candidate.message)
}

export async function retrySupabaseRequestAfterJwtRecovery<T extends SupabaseErrorResult>(
  request: () => PromiseLike<T>,
): Promise<T> {
  const firstResult = await request()
  if (!isJwtIssuedInFutureError(firstResult.error)) return firstResult

  const sessionRecovered = await recoverSupabaseSession()
  if (!sessionRecovered) return firstResult

  return request()
}

async function recoverSupabaseSession(): Promise<boolean> {
  if (recoveryPromise) return recoveryPromise

  if (Date.now() - lastSuccessfulRecoveryAt < RECOVERY_COOLDOWN_MS) {
    return true
  }

  recoveryPromise = (async () => {
    const { data, error } = await supabase.auth.refreshSession()
    const recovered = !error && Boolean(data.session)

    if (recovered) lastSuccessfulRecoveryAt = Date.now()
    return recovered
  })().catch(() => false).finally(() => {
    recoveryPromise = null
  })

  return recoveryPromise
}

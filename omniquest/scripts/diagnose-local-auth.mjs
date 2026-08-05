import { loadLocalSupabaseEnvironment } from './local-supabase-environment.mjs'

const { url, anonKey } = loadLocalSupabaseEnvironment()
const email = process.env.OMNIQUEST_DEMO_EMAIL || 'demo.teacher@omniquest.test'
const password = process.env.OMNIQUEST_DEMO_PASSWORD
if (!password) throw new Error('Define OMNIQUEST_DEMO_PASSWORD antes de ejecutar el diagnóstico.')

const hostEpoch = Math.floor(Date.now() / 1000)
const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const authBody = await readResponse(authResponse)
if (!authResponse.ok || !authBody.json?.access_token) throw new Error(`Auth local rechazó el inicio de sesión (${authResponse.status}): ${authBody.text}`)

const accessToken = authBody.json.access_token
const claims = decodeJwtPayload(accessToken)
const restResponse = await fetch(`${url}/rest/v1/profiles?select=id,role_id,active&id=eq.${encodeURIComponent(claims.sub)}`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
})
const restBody = await readResponse(restResponse)
const guardResponse = await fetch(`${url}/functions/v1/auth-attempt-guard`, {
  method: 'POST',
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'sign_in', identifier: email }),
})
const guardBody = await readResponse(guardResponse)

const authDateEpoch = headerEpoch(authResponse.headers.get('date'))
const restDateEpoch = headerEpoch(restResponse.headers.get('date'))
const tokenIat = Number(claims.iat || 0)
const referenceEpoch = restDateEpoch || authDateEpoch || hostEpoch
const summary = {
  hostUtc: new Date(hostEpoch * 1000).toISOString(),
  tokenIssuedAtUtc: tokenIat ? new Date(tokenIat * 1000).toISOString() : 'missing',
  tokenIatMinusHostSeconds: tokenIat ? tokenIat - hostEpoch : null,
  tokenIatMinusHttpSeconds: tokenIat ? tokenIat - referenceEpoch : null,
  authHttpDateUtc: authDateEpoch ? new Date(authDateEpoch * 1000).toISOString() : 'missing',
  restHttpDateUtc: restDateEpoch ? new Date(restDateEpoch * 1000).toISOString() : 'missing',
  profileStatus: restResponse.status,
  profileResponse: restBody.json || restBody.text,
  guardStatus: guardResponse.status,
  guardResponse: guardBody.json || guardBody.text,
}
console.dir(summary, { depth: null })

let failed = false
if (tokenIat && tokenIat - referenceEpoch > 30) {
  console.error(`El JWT se emitió ${tokenIat - referenceEpoch} segundos en el futuro respecto al servicio HTTP local.`)
  failed = true
}
if (!restResponse.ok) {
  console.error('PostgREST no acepta el JWT recién emitido. Corrige el reloj antes de revisar RLS o permisos.')
  failed = true
}
if (!guardResponse.ok) {
  console.error('auth-attempt-guard no está operativo. Revisa su respuesta y los logs del Edge Runtime.')
  failed = true
}
if (failed) process.exitCode = 1

function decodeJwtPayload(token) {
  const part = token.split('.')[1]
  if (!part) throw new Error('Auth devolvió un token con formato inválido.')
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'))
}

function headerEpoch(value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null
}

async function readResponse(response) {
  const text = await response.text()
  try {
    return { text, json: text ? JSON.parse(text) : null }
  } catch {
    return { text, json: null }
  }
}

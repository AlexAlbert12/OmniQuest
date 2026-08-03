import {
  PublicFunctionError,
  errorResponse,
  methodNotAllowedResponse,
  publicErrorResponse,
} from './errors.ts'

function assertEquals(actual: unknown, expected: unknown, message = 'Values are not equal') {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  if (left !== right) throw new Error(`${message}\nExpected: ${right}\nActual: ${left}`)
}

Deno.test('publicErrorResponse keeps the documented status and safe payload', async () => {
  const response = publicErrorResponse('Datos inválidos.', 422, 'bad_request', { field: 'email' })
  assertEquals(response.status, 422)
  assertEquals(await response.json(), {
    error: 'Datos inválidos.',
    code: 'bad_request',
    details: { field: 'email' },
  })
})

Deno.test('methodNotAllowedResponse returns a controlled 405 response', async () => {
  const response = methodNotAllowedResponse()
  assertEquals(response.status, 405)
  assertEquals(await response.json(), { error: 'Método no permitido.', code: 'bad_request' })
})

Deno.test('errorResponse preserves public errors without logging internal details', async () => {
  const response = errorResponse(new PublicFunctionError('No autorizado.', 401, 'unauthorized'))
  assertEquals(response.status, 401)
  assertEquals(await response.json(), { error: 'No autorizado.', code: 'unauthorized' })
})

Deno.test('errorResponse never exposes the original internal exception', async () => {
  const response = errorResponse(new Error('database password leaked'), 'No se pudo completar la acción.', { functionName: 'test-function' })
  const payload = await response.json()
  assertEquals(response.status, 500)
  assertEquals(payload.error, 'No se pudo completar la acción.')
  assertEquals(payload.code, 'internal_error')
  if (JSON.stringify(payload).includes('database password leaked')) throw new Error('Internal details were exposed to the caller.')
})

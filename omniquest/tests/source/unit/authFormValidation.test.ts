import { prepareAuthSubmission, validateLoginForm } from '@/lib/authFormValidation'

describe('authentication form behaviour', () => {
  it('blocks network guards when the form is invalid', async () => {
    const guard = jest.fn().mockResolvedValue({ allowed: true })
    const result = await prepareAuthSubmission({
      values: { email: 'invalid', password: '' },
      validate: validateLoginForm,
      guard,
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'validation_error',
      errors: {
        email: 'Introduce un correo electrónico válido.',
        password: 'Introduce tu contraseña.',
      },
    }))
    expect(guard).not.toHaveBeenCalled()
  })

  it('allows a valid form only after the attempt guard accepts it', async () => {
    const guard = jest.fn().mockResolvedValue({ allowed: true })
    const result = await prepareAuthSubmission({
      values: { email: 'student@example.com', password: 'Secret123!' },
      validate: validateLoginForm,
      guard,
    })

    expect(result.status).toBe('ready')
    expect(guard).toHaveBeenCalledTimes(1)
  })
})

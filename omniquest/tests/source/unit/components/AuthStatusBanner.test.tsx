import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import AuthStatusBanner from '@/components/auth/AuthStatusBanner'

jest.mock('@/lib/i18n', () => ({
  translateUiText: (_locale: string, input: string) => input,
  useI18n: () => ({ locale: 'es-ES', t: (key: string) => key === 'auth.common.sending' ? 'Enviando' : key }),
}))

describe('AuthStatusBanner', () => {
  it('renders feedback and executes its optional action', () => {
    const onAction = jest.fn()
    const screen = render(
      <AuthStatusBanner message="Revisa tu bandeja" actionLabel="Reenviar" onAction={onAction} variant="warning" />,
    )

    fireEvent.press(screen.getByRole('button', { name: 'Reenviar' }))
    expect(screen.getByText('Revisa tu bandeja')).toBeTruthy()
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('prevents repeated actions while loading', () => {
    const onAction = jest.fn()
    const screen = render(
      <AuthStatusBanner message="En proceso" actionLabel="Reenviar" onAction={onAction} loading />,
    )

    expect(screen.getByRole('button', { name: 'Reenviar' }).props.accessibilityState?.disabled ?? true).toBe(true)
    fireEvent.press(screen.getByRole('button', { name: 'Reenviar' }))
    expect(onAction).not.toHaveBeenCalled()
    expect(screen.getByText('Enviando')).toBeTruthy()
  })
})

import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import AuthInput from '@/components/auth/AuthInput'

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'auth.password.hide': 'Ocultar contraseña',
      'auth.password.show': 'Mostrar contraseña',
      'auth.password.toggleHint': 'Cambia la visibilidad de la contraseña',
    }[key] || key),
  }),
}))

describe('AuthInput', () => {
  it('connects label, hint and validation error to the editable control', () => {
    const screen = render(<AuthInput icon="mail-outline" label="Correo" value="bad" error="Correo no válido" />)
    const input = screen.getByLabelText('Correo')

    expect(input.props.accessibilityHint).toBe('Correo no válido')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Correo no válido')).toBeTruthy()
  })

  it('uses an accessible control to toggle secure text', () => {
    const onToggle = jest.fn()
    const screen = render(
      <AuthInput
        icon="lock-closed-outline"
        label="Contraseña"
        value="Secret123!"
        secureVisible={false}
        showSecureToggle
        onToggleSecureText={onToggle}
      />,
    )

    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' })

    expect(toggle.props.style).toEqual(expect.objectContaining({ height: 44, width: 44 }))
    expect(toggle.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }))
    fireEvent.press(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

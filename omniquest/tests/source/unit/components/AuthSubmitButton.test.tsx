import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { LinearGradient } from 'expo-linear-gradient'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton'

describe('AuthSubmitButton', () => {
  it('invokes the submitted action when enabled', () => {
    const onPress = jest.fn()
    const screen = render(<AuthSubmitButton label="Entrar" onPress={onPress} />)

    fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('exposes loading and disabled state without invoking the action', () => {
    const onPress = jest.fn()
    const screen = render(<AuthSubmitButton label="Entrar" loading loadingLabel="Comprobando" onPress={onPress} />)
    const button = screen.getByRole('button', { name: 'Comprobando' })

    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ busy: true, disabled: true }))
    fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('renders an intentionally neutral visual state when disabled', () => {
    const onPress = jest.fn()
    const screen = render(<AuthSubmitButton label="Crear cuenta" disabled onPress={onPress} />)
    const button = screen.getByRole('button', { name: 'Crear cuenta' })
    const gradient = screen.UNSAFE_getByType(LinearGradient)

    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))
    expect(button.props.style).toEqual(expect.objectContaining({ opacity: 1 }))
    expect(gradient.props.colors).toEqual(['#263650', '#30354F'])
    fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
  })
})

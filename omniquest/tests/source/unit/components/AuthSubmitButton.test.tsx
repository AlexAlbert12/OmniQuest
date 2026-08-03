import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
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
})

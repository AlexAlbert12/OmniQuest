import React from 'react'
import AppButton, { type AppButtonProps } from './AppButton'

export type AppBackButtonProps = Omit<AppButtonProps, 'icon' | 'iconPosition' | 'role' | 'variant'>

export default function AppBackButton(props: AppBackButtonProps) {
  return (
    <AppButton
      {...props}
      icon="arrow-back"
      iconPosition="left"
      role="teacher"
      variant="primary"
    />
  )
}

import React from 'react'
import AppButton, { type AppButtonProps } from './AppButton'

export type AppBackButtonProps = Omit<AppButtonProps, 'icon' | 'iconPosition' | 'variant'>

export default function AppBackButton({ role = 'teacher', ...props }: AppBackButtonProps) {
  return (
    <AppButton
      {...props}
      icon="arrow-back"
      iconPosition="left"
      role={role}
      variant="primary"
    />
  )
}

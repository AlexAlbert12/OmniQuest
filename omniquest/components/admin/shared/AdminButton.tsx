import React from 'react'
import AppButton, { type AppButtonProps } from '../../ui/AppButton'

export type AdminButtonProps = Omit<AppButtonProps, 'role'>

export default function AdminButton(props: AdminButtonProps) {
  return <AppButton {...props} role="admin" />
}

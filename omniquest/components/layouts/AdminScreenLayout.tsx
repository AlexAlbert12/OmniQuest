import React from 'react'
import RoleScreenLayout from './RoleScreenLayout'

type Props = Omit<React.ComponentProps<typeof RoleScreenLayout>, 'role'>

export default function AdminScreenLayout(props: Props) {
  return <RoleScreenLayout {...props} role="admin" />
}

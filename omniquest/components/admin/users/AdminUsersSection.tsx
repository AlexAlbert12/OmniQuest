import React from 'react'
import { View } from 'react-native'

export default function AdminUsersSection({
  createArea,
  listArea,
}: {
  createArea?: React.ReactNode
  listArea: React.ReactNode
}) {
  return (
    <View style={{ gap: 20 }}>
      {createArea}
      {listArea}
    </View>
  )
}

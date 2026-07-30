import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

export default function SubjectTabState({ error, loading }: { error: string | null; loading: boolean }) {
  if (loading) {
    return (
      <View className="items-center rounded-2xl border border-border-default bg-surface-default p-10">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-3 text-text-muted">Cargando esta sección...</Text>
      </View>
    )
  }
  if (error) {
    return (
      <View className="rounded-xl border border-semantic-danger bg-semantic-surface-danger p-4">
        <Text className="font-bold text-semantic-danger">{error}</Text>
      </View>
    )
  }
  return null
}

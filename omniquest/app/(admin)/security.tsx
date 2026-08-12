import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAdminData } from '../../components/admin/hooks/useAdminData'
import { AdminScaffold } from '../../components/admin/shared/AdminScaffold'
import ManagedSessionsCard from '../../components/settings/ManagedSessionsCard'
import { useAppTheme } from '../../lib/appTheme'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export default function AdminSecurityScreen() {
  const router = useRouter()
  const data = useAdminData()
  const { tokens } = useAppTheme()

  const signOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as any)
  }

  return (
    <AdminScaffold
      activeSection="settings"
      title="Seguridad administrativa"
      subtitle="Gestiona los dispositivos con acceso a tu cuenta de administración y conserva códigos de recuperación."
      data={data}
    >
      <View className="w-full">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a configuración"
          onPress={() => router.back()}
          className="mb-5 flex-row items-center gap-2 self-start rounded-xl border border-border-default bg-surface-default px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
        >
          <Ionicons name="arrow-back" size={18} color={tokens.semantic.info} />
          <Text className="font-black text-semantic-info">Volver a configuración</Text>
        </Pressable>
        <ManagedSessionsCard />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar esta sesión"
          onPress={() => void signOut()}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-semantic-danger bg-surface-default px-4 py-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
        >
          <Ionicons name="log-out-outline" size={18} color={tokens.semantic.danger} />
          <Text className="font-black text-semantic-danger">Cerrar esta sesión</Text>
        </Pressable>
      </View>
    </AdminScaffold>
  )
}

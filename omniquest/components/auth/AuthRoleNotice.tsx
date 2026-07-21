import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'

type AuthRoleNoticeProps = {
  mode: 'login' | 'register'
}

export default function AuthRoleNotice({ mode }: AuthRoleNoticeProps) {
  const login = mode === 'login'
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-[#1D3760] bg-[#07162C]/75 p-3.5">
      <Ionicons name={login ? 'people-circle-outline' : 'school-outline'} size={20} color="#8CD5FF" />
      <Text className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-[#AFC2DB]">
        {login
          ? 'Alumnos y profesores acceden desde aquí. Las cuentas de administración se crean y asignan de forma controlada.'
          : 'El registro público crea una cuenta de alumno. Las cuentas de profesor y administrador las asigna un administrador.'}
      </Text>
    </View>
  )
}

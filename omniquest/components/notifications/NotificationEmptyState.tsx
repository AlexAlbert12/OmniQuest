import React from 'react'
import { Text, View } from 'react-native'
import OmniGuide from '../OmniGuide'
import { useAppTheme } from '../../lib/appTheme'

type NotificationEmptyStateProps = {
  unreadOnly?: boolean
  audience: 'student' | 'teacher'
}

export default function NotificationEmptyState({ unreadOnly = false, audience }: NotificationEmptyStateProps) {
  const { tokens } = useAppTheme()
  const title = unreadOnly ? 'Todo está leído' : 'No hay notificaciones'
  const message = unreadOnly
    ? 'Has revisado todas tus novedades. Las próximas aparecerán aquí.'
    : audience === 'student'
      ? 'Cuando haya novedades de tus cursos, logros o actividad aparecerán aquí.'
      : 'Cuando haya actividad de alumnos, revisiones o avisos aparecerán aquí.'

  return (
    <View
      className="items-center rounded-2xl border border-dashed px-6 py-12"
      style={{ backgroundColor: tokens.surface.default, borderColor: tokens.border.active }}
    >
      <OmniGuide state="happy" size={78} />
      <Text className="mt-4 text-center text-[18px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>
      <Text className="mt-2 max-w-[440px] text-center text-[13px] leading-5" style={{ color: tokens.text.muted }}>{message}</Text>
    </View>
  )
}

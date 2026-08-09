import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

type Props = {
  isPublic: boolean
  onOpenSettings: () => void
}

export default function StudentProfilePrivacy({ isPublic, onOpenSettings }: Props) {
  const { tokens } = useAppTheme()
  const visibleLabel = isPublic ? 'Perfil visible' : 'Perfil privado'
  const statusColor = isPublic ? tokens.semantic.success : tokens.semantic.warning

  return (
    <View className="rounded-2xl border p-5" style={{ backgroundColor: tokens.surface.default, borderColor: tokens.border.default }}>
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Privacidad del perfil</Text>
          <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.muted }}>
            Una única preferencia controla cómo aparecen tu alias, avatar y participación en el ranking.
          </Text>
        </View>
        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: withAlpha(statusColor, '20') }}>
          <Text className="text-[11px] font-black" style={{ color: statusColor }}>{visibleLabel}</Text>
        </View>
      </View>

      <View className="mt-4 gap-3">
        <PrivacyRow icon="person-outline" label="Alias" value={isPublic ? 'Visible para otros alumnos' : 'Oculto fuera de tu cuenta'} color={statusColor} />
        <PrivacyRow icon="image-outline" label="Avatar" value={isPublic ? 'Visible junto a tu alias' : 'No se muestra públicamente'} color={statusColor} />
        <PrivacyRow icon="podium-outline" label="Ranking" value={isPublic ? 'Participas en las clasificaciones' : 'Exclusión voluntaria activada'} color={statusColor} />
      </View>

      <AppButton
        label="Gestionar privacidad"
        icon="shield-checkmark-outline"
        role="student"
        size="sm"
        variant="secondary"
        style={{ marginTop: 16 }}
        onPress={onOpenSettings}
      />
    </View>
  )
}

function PrivacyRow({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  color: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, '18') }}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[12px] font-black" style={{ color: tokens.text.secondary }}>{label}</Text>
        <Text className="mt-0.5 text-[12px] leading-5" style={{ color: tokens.text.muted }}>{value}</Text>
      </View>
    </View>
  )
}

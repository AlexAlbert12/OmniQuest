import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppButton } from '../ui'
import { useAppTheme } from '../../lib/appTheme'
import type { ProfileVisibility } from './SettingsTypes'

export default function StudentRankingPrivacyCard({
  visibility,
  available,
  saving,
  isGuest,
  onChange,
}: {
  visibility: ProfileVisibility | null
  available: boolean
  saving: boolean
  isGuest: boolean
  onChange: (visibility: ProfileVisibility) => void
}) {
  const { tokens } = useAppTheme()
  const participates = visibility !== 'private'
  const disabled = isGuest || !available

  return (
    <View className="mb-4 rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="flex-row flex-wrap items-center gap-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-semantic-surface-info">
          <Ionicons name={participates ? 'eye' : 'eye-off'} size={22} color={tokens.semantic.info} />
        </View>
        <View className="min-w-[210px] flex-1">
          <Text className="text-[16px] font-black text-text-primary">Privacidad del ranking</Text>
          <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
            {!available
              ? 'Esta preferencia no está disponible con el esquema actual.'
              : isGuest
                ? 'Los invitados no participan de forma permanente. Regístrate para gestionar esta preferencia.'
                : participates
                  ? 'Tu alias, avatar y puntuación aparecen en las clasificaciones autorizadas.'
                  : 'No apareces ante otros usuarios. Tú todavía puedes consultar tu posición privada.'}
          </Text>
        </View>
        <AppButton
          size="sm"
          variant={participates ? 'secondary' : 'primary'}
          role="student"
          loading={saving}
          disabled={disabled}
          label={participates ? 'Dejar de participar' : 'Participar en ranking'}
          icon={participates ? 'eye-off-outline' : 'eye-outline'}
          onPress={() => onChange(participates ? 'private' : 'public')}
        />
      </View>
    </View>
  )
}

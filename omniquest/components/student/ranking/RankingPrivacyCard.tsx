import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppButton } from '../../ui'
import { useAppTheme } from '../../../lib/appTheme'

export default function RankingPrivacyCard({ participates, saving, isGuest, onChange }: { participates: boolean; saving: boolean; isGuest: boolean; onChange: (participates: boolean) => void }) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="flex-row flex-wrap items-center gap-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-semantic-surface-info">
          <Ionicons name={participates ? 'eye' : 'eye-off'} size={22} color={tokens.semantic.info} />
        </View>
        <View className="min-w-[210px] flex-1">
          <Text className="text-[16px] font-black text-text-primary">Privacidad del ranking</Text>
          <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
            {isGuest
              ? 'Los invitados no participan de forma permanente. Regístrate para gestionar esta preferencia.'
              : participates
                ? 'Tu alias, avatar y puntuación aparecen en las clasificaciones autorizadas.'
                : 'Has solicitado no aparecer ante otros usuarios. Tú todavía puedes consultar tu posición privada.'}
          </Text>
        </View>
        <AppButton
          size="sm"
          variant={participates ? 'secondary' : 'primary'}
          role="student"
          loading={saving}
          disabled={isGuest}
          label={participates ? 'Dejar de participar' : 'Participar en ranking'}
          icon={participates ? 'eye-off-outline' : 'eye-outline'}
          onPress={() => onChange(!participates)}
        />
      </View>
    </View>
  )
}

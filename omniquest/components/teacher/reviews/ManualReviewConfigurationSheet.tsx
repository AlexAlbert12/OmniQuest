import React, { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import type { ManualReviewConfiguration } from '../../../lib/teacherManualReview'

export default function ManualReviewConfigurationSheet({ visible, configuration, busy, onClose, onSaveSla }: {
  visible: boolean
  configuration: ManualReviewConfiguration
  busy: boolean
  onClose: () => void
  onSaveSla: (hours: number) => Promise<void>
}) {
  const { tokens } = useAppTheme()
  const [sla, setSla] = useState(String(configuration.slaHours || 48))

  useEffect(() => { if (visible) setSla(String(configuration.slaHours || 48)) }, [configuration.slaHours, visible])

  return (
    <AppBottomSheet visible={visible} onClose={onClose} title="Configuración de revisión" description="Configura el plazo máximo para realizar la primera revisión de una respuesta pendiente." scrollable closeOnBackdropPress={!busy}>
      <View className="gap-6">
        <Section title="Plazo de revisión">
          <Text className="mb-2 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>Horas máximas para realizar la primera revisión de una respuesta pendiente.</Text>
          <View className="flex-row items-center gap-2">
            <TextInput accessibilityLabel="Horas del plazo de revisión" keyboardType="number-pad" value={sla} onChangeText={setSla} className="min-h-11 min-w-[120px] rounded-xl border px-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }} />
            <Text className="text-[13px] font-bold" style={{ color: tokens.text.secondary }}>horas</Text>
            <AppButton label="Guardar" variant="secondary" loading={busy} onPress={() => void onSaveSla(Math.max(1, Math.min(720, Number(sla) || 48)))} />
          </View>
        </Section>
      </View>
    </AppBottomSheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens } = useAppTheme()
  return <View><Text className="mb-3 text-[15px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>{children}</View>
}

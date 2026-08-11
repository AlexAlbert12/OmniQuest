import React, { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppTabs from '../../ui/AppTabs'
import { useAppTheme } from '../../../lib/appTheme'
import type { ManualReviewConfiguration } from '../../../lib/teacherManualReview'

export default function ManualReviewConfigurationSheet({ visible, configuration, busy, onClose, onSaveSla, onSaveTemplate }: { visible: boolean; configuration: ManualReviewConfiguration; busy: boolean; onClose: () => void; onSaveSla: (hours: number) => Promise<void>; onSaveTemplate: (input: { title: string; body: string; audience: 'student' | 'internal' }) => Promise<void> }) {
  const { tokens } = useAppTheme()
  const [sla, setSla] = useState(String(configuration.slaHours || 48))
  const [templateTitle, setTemplateTitle] = useState('Buen razonamiento')
  const [templateBody, setTemplateBody] = useState('La respuesta muestra un razonamiento correcto. Revisa la explicación para consolidar el concepto.')
  const [templateAudience, setTemplateAudience] = useState<'student' | 'internal'>('student')

  useEffect(() => { if (visible) setSla(String(configuration.slaHours || 48)) }, [configuration.slaHours, visible])

  return (
    <AppBottomSheet visible={visible} onClose={onClose} title="Configuración de revisión" description="Configura el plazo de revisión y los comentarios reutilizables." scrollable closeOnBackdropPress={!busy}>
      <View className="gap-6">
        <Section title="Plazo de revisión">
          <Text className="mb-2 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>Horas máximas para realizar la primera revisión de una respuesta pendiente.</Text>
          <View className="flex-row items-center gap-2">
            <TextInput accessibilityLabel="Horas del plazo de revisión" keyboardType="number-pad" value={sla} onChangeText={setSla} className="min-h-11 min-w-[120px] rounded-xl border px-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }} />
            <Text className="text-[13px] font-bold" style={{ color: tokens.text.secondary }}>horas</Text>
            <AppButton label="Guardar" variant="secondary" loading={busy} onPress={() => void onSaveSla(Math.max(1, Math.min(720, Number(sla) || 48)))} />
          </View>
        </Section>

        <Section title="Comentario predefinido">
          <TextInput accessibilityLabel="Título de la plantilla" value={templateTitle} onChangeText={setTemplateTitle} placeholder="Título" placeholderTextColor={tokens.text.muted} className="min-h-11 rounded-xl border px-3" style={field(tokens)} />
          <TextInput accessibilityLabel="Texto de la plantilla" value={templateBody} onChangeText={setTemplateBody} multiline textAlignVertical="top" placeholder="Texto" placeholderTextColor={tokens.text.muted} className="mt-2 min-h-[100px] rounded-xl border p-3" style={field(tokens)} />
          <AppTabs<'student' | 'internal'> accessibilityLabel="Visibilidad de la plantilla" compact role="teacher" items={[{ key: 'student', label: 'Visible para alumno', icon: 'eye-outline' }, { key: 'internal', label: 'Nota interna', icon: 'lock-closed-outline' }]} value={templateAudience} onChange={setTemplateAudience} />
          <AppButton label="Guardar como plantilla" icon="bookmark-outline" variant="secondary" loading={busy} style={{ marginTop: 10 }} onPress={() => void onSaveTemplate({ title: templateTitle, body: templateBody, audience: templateAudience })} />
        </Section>
      </View>
    </AppBottomSheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { const { tokens } = useAppTheme(); return <View><Text className="mb-3 text-[15px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>{children}</View> }
function field(tokens: ReturnType<typeof useAppTheme>['tokens']) { return { borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary } }

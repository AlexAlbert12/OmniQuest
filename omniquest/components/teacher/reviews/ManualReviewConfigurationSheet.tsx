import React, { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppTabs from '../../ui/AppTabs'
import { useAppTheme } from '../../../lib/appTheme'
import type { ManualReviewConfiguration, ManualReviewRubricCriterion } from '../../../lib/teacherManualReview'

export default function ManualReviewConfigurationSheet({
  visible,
  configuration,
  busy,
  onClose,
  onSaveSla,
  onSaveRubric,
  onSaveTemplate,
}: {
  visible: boolean
  configuration: ManualReviewConfiguration
  busy: boolean
  onClose: () => void
  onSaveSla: (hours: number) => Promise<void>
  onSaveRubric: (input: { name: string; criteria: ManualReviewRubricCriterion[] }) => Promise<void>
  onSaveTemplate: (input: { title: string; body: string; audience: 'student' | 'internal' }) => Promise<void>
}) {
  const { tokens } = useAppTheme()
  const [sla, setSla] = useState(String(configuration.slaHours || 48))
  const [rubricName, setRubricName] = useState('Rúbrica general')
  const [criterionA, setCriterionA] = useState('Comprensión')
  const [criterionB, setCriterionB] = useState('Claridad y razonamiento')
  const [templateTitle, setTemplateTitle] = useState('Buen razonamiento')
  const [templateBody, setTemplateBody] = useState('La respuesta muestra un razonamiento correcto. Revisa la explicación para consolidar el concepto.')
  const [templateAudience, setTemplateAudience] = useState<'student' | 'internal'>('student')

  useEffect(() => {
    if (visible) setSla(String(configuration.slaHours || 48))
  }, [configuration.slaHours, visible])

  return (
    <AppBottomSheet visible={visible} onClose={onClose} title="Configuración de revisión" description="Define SLA, rúbricas y comentarios reutilizables." scrollable closeOnBackdropPress={!busy}>
      <View className="gap-6">
        <Section title="SLA de revisión">
          <Text className="mb-2 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>Horas máximas antes de considerar una respuesta vencida.</Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              accessibilityLabel="Horas de SLA"
              keyboardType="number-pad"
              value={sla}
              onChangeText={setSla}
              className="min-h-11 min-w-[120px] rounded-xl border px-3"
              style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
            />
            <AppButton label="Guardar SLA" variant="secondary" loading={busy} onPress={() => void onSaveSla(Math.max(1, Math.min(720, Number(sla) || 48)))} />
          </View>
        </Section>

        <Section title="Nueva rúbrica">
          <TextInput accessibilityLabel="Nombre de la rúbrica" value={rubricName} onChangeText={setRubricName} className="min-h-11 rounded-xl border px-3" style={field(tokens)} />
          <TextInput accessibilityLabel="Primer criterio" value={criterionA} onChangeText={setCriterionA} className="mt-2 min-h-11 rounded-xl border px-3" style={field(tokens)} />
          <TextInput accessibilityLabel="Segundo criterio" value={criterionB} onChangeText={setCriterionB} className="mt-2 min-h-11 rounded-xl border px-3" style={field(tokens)} />
          <AppButton
            label="Crear rúbrica"
            icon="list-outline"
            variant="secondary"
            loading={busy}
            style={{ marginTop: 10 }}
            onPress={() => void onSaveRubric({
              name: rubricName,
              criteria: [
                { id: 'understanding', label: criterionA, maxScore: 5 },
                { id: 'reasoning', label: criterionB, maxScore: 5 },
              ],
            })}
          />
          <Text className="mt-2 text-[11px]" style={{ color: tokens.text.muted }}>{configuration.rubrics.length} rúbrica(s) activa(s)</Text>
        </Section>

        <Section title="Comentario predefinido">
          <TextInput accessibilityLabel="Título de la plantilla" value={templateTitle} onChangeText={setTemplateTitle} className="min-h-11 rounded-xl border px-3" style={field(tokens)} />
          <TextInput accessibilityLabel="Texto de la plantilla" value={templateBody} onChangeText={setTemplateBody} multiline textAlignVertical="top" className="mt-2 min-h-[100px] rounded-xl border p-3" style={field(tokens)} />
          <AppTabs<'student' | 'internal'>
            accessibilityLabel="Visibilidad de la plantilla"
            compact
            role="teacher"
            items={[
              { key: 'student', label: 'Visible para alumno', icon: 'eye-outline' },
              { key: 'internal', label: 'Interna', icon: 'lock-closed-outline' },
            ]}
            value={templateAudience}
            onChange={setTemplateAudience}
          />
          <AppButton label="Guardar comentario" icon="bookmark-outline" variant="secondary" loading={busy} style={{ marginTop: 10 }} onPress={() => void onSaveTemplate({ title: templateTitle, body: templateBody, audience: templateAudience })} />
        </Section>
      </View>
    </AppBottomSheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens } = useAppTheme()
  return <View><Text className="mb-3 text-[15px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>{children}</View>
}
function field(tokens: ReturnType<typeof useAppTheme>['tokens']) { return { borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary } }

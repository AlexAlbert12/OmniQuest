import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { ensurePairDraftRows, parsePairDraftLines, serializePairDraftLines } from './utils'
import QuestionFormSection from './QuestionFormSection'

export default function MatchingPairsEditor({
  mode,
  value,
  onChange,
}: {
  mode: 'match' | 'dragdrop'
  value: string
  onChange: (value: string) => void
}) {
  const { tokens } = useAppTheme()
  const rows = ensurePairDraftRows(parsePairDraftLines(value))
  const isMatch = mode === 'match'

  const updateRow = (index: number, field: 'left' | 'right', nextValue: string) => {
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: nextValue } : row)
    onChange(serializePairDraftLines(nextRows))
  }
  const addRow = () => onChange(serializePairDraftLines([...rows, { left: '', right: '' }]))
  const removeRow = (index: number) => {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
    onChange(serializePairDraftLines(ensurePairDraftRows(nextRows)))
  }

  return (
    <QuestionFormSection
      title={isMatch ? 'Parejas correctas' : 'Elementos y destinos'}
      subtitle={isMatch
        ? 'Conecta cada concepto con su pareja. La relación se guarda de forma segura en el servidor.'
        : 'Define el elemento que el alumno moverá y el destino correcto.'}
      icon={isMatch ? 'git-compare-outline' : 'move-outline'}
    >
      <View className="gap-3">
        {rows.map((row, index) => (
          <View
            key={index}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`Relación ${index + 1} de ${rows.length}`}
            accessibilityHint="Completa ambos campos o elimina esta relación"
            className="rounded-xl border p-3"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}
          >
            <View className="flex-row flex-wrap items-end gap-3">
              <View className="min-w-[210px] flex-1">
                <Text className="mb-2 text-[11px] font-black uppercase tracking-[0.6px]" style={{ color: tokens.text.muted }}>
                  {isMatch ? 'Concepto' : 'Elemento'}
                </Text>
                <TextInput
                  accessibilityLabel={`${isMatch ? 'Concepto' : 'Elemento'} ${index + 1}`}
                  accessibilityHint={`Escribe el valor izquierdo de la relación ${index + 1}`}
                  className="min-h-12 rounded-xl border px-4 py-3 text-[15px] font-semibold"
                  style={{ borderColor: tokens.border.default, backgroundColor: tokens.background.primary, color: tokens.text.primary }}
                  placeholder={isMatch ? 'España' : '8 - 3'}
                  placeholderTextColor={tokens.text.muted}
                  value={row.left}
                  onChangeText={(text) => updateRow(index, 'left', text)}
                />
              </View>
              <View className="h-12 items-center justify-center px-1">
                <Ionicons name="arrow-forward" size={21} color={tokens.brand.teacher} />
              </View>
              <View className="min-w-[210px] flex-1">
                <Text className="mb-2 text-[11px] font-black uppercase tracking-[0.6px]" style={{ color: tokens.text.muted }}>
                  {isMatch ? 'Pareja' : 'Destino'}
                </Text>
                <TextInput
                  accessibilityLabel={`${isMatch ? 'Pareja' : 'Destino'} ${index + 1}`}
                  accessibilityHint={`Escribe el valor derecho de la relación ${index + 1}`}
                  className="min-h-12 rounded-xl border px-4 py-3 text-[15px] font-semibold"
                  style={{ borderColor: tokens.border.default, backgroundColor: tokens.background.primary, color: tokens.text.primary }}
                  placeholder={isMatch ? 'Madrid' : '5'}
                  placeholderTextColor={tokens.text.muted}
                  value={row.right}
                  onChangeText={(text) => updateRow(index, 'right', text)}
                />
              </View>
              <AppButton
                accessibilityLabel={`Eliminar relación ${index + 1}`}
                accessibilityHint="Elimina esta relación del ejercicio"
                icon="trash-outline"
                iconOnly
                variant="danger"
                disabled={rows.length <= 1}
                onPress={() => removeRow(index)}
              />
            </View>
          </View>
        ))}
      </View>
      <AppButton
        label="Añadir relación"
        icon="add"
        variant="secondary"
        style={{ marginTop: 12 }}
        onPress={addRow}
      />
    </QuestionFormSection>
  )
}

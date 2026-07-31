import React, { useEffect, useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { parseLines } from './utils'
import QuestionFormSection from './QuestionFormSection'

export default function OrderingEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { tokens } = useAppTheme()
  const parsed = useMemo(() => parseLines(value), [value])
  const [rows, setRows] = useState<string[]>(() => ensureRows(parsed))

  useEffect(() => {
    const next = ensureRows(parsed)
    if (next.join('\n') !== rows.join('\n')) setRows(next)
    // rows is intentionally excluded: external draft recovery must replace the editor state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const commit = (nextRows: string[]) => {
    const safeRows = ensureRows(nextRows)
    setRows(safeRows)
    onChange(safeRows.join('\n'))
  }
  const update = (index: number, text: string) => commit(rows.map((row, rowIndex) => rowIndex === index ? text : row))
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= rows.length) return
    const next = [...rows]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    commit(next)
  }
  const remove = (index: number) => commit(rows.filter((_, rowIndex) => rowIndex !== index))
  const add = () => commit([...rows, ''])

  return (
    <QuestionFormSection
      title="Orden correcto"
      subtitle="Define cada elemento y utiliza los botones para establecer el orden. Esta alternativa funciona con teclado y lector de pantalla."
      icon="reorder-three-outline"
    >
      <Text className="mb-3 text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Primero → último</Text>
      <View accessibilityRole="list" accessibilityLabel="Elementos en orden correcto" className="gap-3">
        {rows.map((row, index) => (
          <View
            key={index}
            accessible
            accessibilityLabel={`Posición ${index + 1} de ${rows.length}`}
            className="rounded-xl border p-3"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}
          >
            <View className="flex-row flex-wrap items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tokens.surface.raised }}>
                <Text className="font-black" style={{ color: tokens.brand.teacher }}>{index + 1}</Text>
              </View>
              <TextInput
                accessibilityLabel={`Texto de la posición ${index + 1}`}
                accessibilityHint="Escribe el contenido de este elemento"
                className="min-h-12 min-w-[220px] flex-1 rounded-xl border px-4 py-3 text-[15px]"
                style={{ borderColor: tokens.border.default, backgroundColor: tokens.background.primary, color: tokens.text.primary }}
                placeholder={`Elemento ${index + 1}`}
                placeholderTextColor={tokens.text.muted}
                value={row}
                onChangeText={(text) => update(index, text)}
              />
              <View className="flex-row gap-2">
                <AppButton
                  icon="arrow-up"
                  iconOnly
                  variant="secondary"
                  accessibilityLabel={`Mover elemento ${index + 1} hacia arriba`}
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                />
                <AppButton
                  icon="arrow-down"
                  iconOnly
                  variant="secondary"
                  accessibilityLabel={`Mover elemento ${index + 1} hacia abajo`}
                  disabled={index === rows.length - 1}
                  onPress={() => move(index, 1)}
                />
                <AppButton
                  icon="trash-outline"
                  iconOnly
                  variant="danger"
                  accessibilityLabel={`Eliminar elemento ${index + 1}`}
                  disabled={rows.length <= 2}
                  onPress={() => remove(index)}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
      <AppButton label="Añadir elemento" icon="add" variant="secondary" style={{ marginTop: 12 }} onPress={add} />
    </QuestionFormSection>
  )
}

function ensureRows(rows: string[]) {
  return rows.length >= 2 ? rows : [...rows, ...Array.from({ length: 2 - rows.length }, () => '')]
}

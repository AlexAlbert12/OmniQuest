import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import AppButton from '../../ui/AppButton'
import TeacherQuestionMediaEditor, { type TeacherQuestionMediaValue } from '../TeacherQuestionMediaEditor'
import { QUESTION_TEXT_MAX, type QuestionTypeId } from './types'
import QuestionFormSection from './QuestionFormSection'
import { FILL_BLANK_MARKER, countFillBlankMarkers, getFillBlankAnswerSlots, reconcileFillBlankAnswers } from './utils'

export default function QuestionPromptEditor({ selectedType, questionText, fillAnswersText, media, disabled, questionTextError, mediaError, onChangeQuestionText, onChangeFillAnswersText, onChangeMedia, onMediaError }: { selectedType: QuestionTypeId; questionText: string; fillAnswersText: string; media: TeacherQuestionMediaValue; disabled?: boolean; questionTextError?: string; mediaError?: string; onChangeQuestionText: (value: string) => void; onChangeFillAnswersText: (value: string) => void; onChangeMedia: (value: TeacherQuestionMediaValue) => void; onMediaError: (message: string) => void }) {
  const { tokens } = useAppTheme()
  const isFill = selectedType === 'fill'
  const inputRef = React.useRef<TextInput>(null)
  const [selection, setSelection] = React.useState({ start: questionText.length, end: questionText.length })
  const selectionStart = Math.min(selection.start, questionText.length)
  const selectionEnd = Math.min(selection.end, questionText.length)
  const selectedAnswer = questionText.slice(selectionStart, selectionEnd).trim().replace(/\s+/g, ' ')
  const markerCount = countFillBlankMarkers(questionText)
  const nextLength = questionText.length - (selectionEnd - selectionStart) + FILL_BLANK_MARKER.length
  const cannotInsert = Boolean(disabled) || nextLength > QUESTION_TEXT_MAX

  const handleQuestionTextChange = (nextText: string) => {
    if (isFill) {
      const nextAnswers = reconcileFillBlankAnswers(questionText, nextText, fillAnswersText)
      if (nextAnswers !== fillAnswersText) onChangeFillAnswersText(nextAnswers)
    }
    onChangeQuestionText(nextText)
  }

  const createBlank = () => {
    if (cannotInsert) return
    const markerIndex = countFillBlankMarkers(questionText.slice(0, selectionStart))
    const answers = getFillBlankAnswerSlots(fillAnswersText, markerCount)
    answers.splice(markerIndex, 0, selectedAnswer)
    const nextText = `${questionText.slice(0, selectionStart)}${FILL_BLANK_MARKER}${questionText.slice(selectionEnd)}`
    const nextCursor = selectionStart + FILL_BLANK_MARKER.length
    onChangeFillAnswersText(answers.join('\n'))
    onChangeQuestionText(nextText)
    setSelection({ start: nextCursor, end: nextCursor })
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <QuestionFormSection title="Escribe el enunciado" subtitle={isFill ? 'Escribe la frase completa y convierte en hueco la palabra o fragmento que quieras ocultar.' : 'Usa una frase breve, directa y comprensible. Puedes añadir imagen, audio o vídeo.'} icon="create-outline">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Enunciado</Text>
        <Text className="text-[11px] font-bold" style={{ color: questionText.length >= QUESTION_TEXT_MAX ? tokens.semantic.danger : tokens.text.muted }}>{questionText.length} / {QUESTION_TEXT_MAX}</Text>
      </View>
      <TextInput
        ref={inputRef}
        accessibilityLabel="Enunciado de la pregunta"
        className="min-h-[145px] rounded-xl border px-4 py-3 text-[16px]"
        style={{ borderColor: questionTextError ? tokens.semantic.danger : tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }}
        placeholder={isFill ? 'Ejemplo: Ayer fue el eclipse solar.' : 'Escribe aquí el enunciado de la pregunta.'}
        placeholderTextColor={tokens.text.muted}
        multiline
        maxLength={QUESTION_TEXT_MAX}
        textAlignVertical="top"
        editable={!disabled}
        selection={selection}
        value={questionText}
        onChangeText={handleQuestionTextChange}
        onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
      />
      {questionTextError ? <Text className="mt-2 text-[12px] font-bold" style={{ color: tokens.semantic.danger }}>{questionTextError}</Text> : null}
      {isFill ? (
        <View className="mt-3 rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
          <View className="flex-row items-start gap-3">
            <Ionicons name="color-wand-outline" size={19} color={tokens.brand.teacher} />
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-black" style={{ color: tokens.text.primary }}>Crea el hueco sin escribir guiones</Text>
              <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>
                {selectedAnswer ? `Se guardará «${selectedAnswer}» como respuesta del nuevo hueco.` : 'Selecciona una palabra para guardar también su respuesta, o sitúa el cursor donde quieras insertar un hueco vacío.'}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap items-center gap-3">
            <AppButton
              label={selectedAnswer ? 'Convertir selección en hueco' : 'Crear hueco aquí'}
              accessibilityHint="Inserta un hueco en la posición actual del cursor"
              icon="add-circle-outline"
              size="sm"
              role="teacher"
              disabled={cannotInsert}
              onPress={createBlank}
            />
            <Text className="text-[11px] font-bold" style={{ color: markerCount > 0 ? tokens.semantic.success : tokens.text.muted }}>
              {markerCount} {markerCount === 1 ? 'hueco creado' : 'huecos creados'}
            </Text>
          </View>
        </View>
      ) : null}
      <View className="mt-5">
        <TeacherQuestionMediaEditor value={media} onChange={onChangeMedia} disabled={disabled} onError={onMediaError} validationError={mediaError} />
      </View>
    </QuestionFormSection>
  )
}

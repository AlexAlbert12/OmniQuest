import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import QuestionMedia from '../questions/QuestionMedia'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import {
  pickQuestionMedia,
  QUESTION_MEDIA_MAX_AUDIO_SECONDS,
  QUESTION_MEDIA_MAX_BYTES,
  QUESTION_MEDIA_MAX_VIDEO_SECONDS,
  type PickedQuestionMedia,
  type QuestionMediaType,
} from '../../lib/questionMedia'

export type TeacherQuestionMediaValue = {
  type: QuestionMediaType | null
  url: string | null
  path: string | null
  durationSeconds: number | null
  altText: string
  caption: string
  transcript: string
  subtitlesVtt: string
  pendingAsset: PickedQuestionMedia | null
  removeExisting: boolean
}

type Props = {
  value: TeacherQuestionMediaValue
  onChange: (value: TeacherQuestionMediaValue) => void
  disabled?: boolean
  onError: (message: string) => void
  validationError?: string
}

const options: { type: QuestionMediaType; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'image', label: 'Imagen', detail: 'JPG, PNG, WebP o GIF · máx. 25 MB', icon: 'image-outline' },
  { type: 'audio', label: 'Audio', detail: `MP3, M4A, WAV u OGG · máx. ${QUESTION_MEDIA_MAX_AUDIO_SECONDS / 60} min / 25 MB`, icon: 'volume-high-outline' },
  { type: 'video', label: 'Vídeo', detail: `MP4, WebM o MOV · máx. ${QUESTION_MEDIA_MAX_VIDEO_SECONDS / 60} min / 25 MB`, icon: 'videocam-outline' },
]

export default function TeacherQuestionMediaEditor({ value, onChange, disabled = false, onError, validationError }: Props) {
  const [picking, setPicking] = useState<QuestionMediaType | null>(null)
  const { tokens } = useAppTheme()
  const previewUrl = value.pendingAsset?.uri || value.url

  const choose = async (type: QuestionMediaType) => {
    if (disabled) return
    setPicking(type)
    try {
      const asset = await pickQuestionMedia(type)
      if (!asset) return
      if (asset.fileSize && asset.fileSize > QUESTION_MEDIA_MAX_BYTES) throw new Error('El archivo supera el límite de 25 MB.')
      onChange({ ...value, type, url: null, path: null, durationSeconds: asset.durationSeconds, transcript: type === 'audio' ? value.transcript : '', subtitlesVtt: type === 'video' ? value.subtitlesVtt : '', pendingAsset: asset, removeExisting: value.removeExisting || Boolean(value.path) })
    } catch (error: any) {
      onError(error?.message || 'No se pudo seleccionar el archivo multimedia.')
    } finally {
      setPicking(null)
    }
  }

  const clear = () => onChange({ type: null, url: null, path: null, durationSeconds: null, altText: '', caption: '', transcript: '', subtitlesVtt: '', pendingAsset: null, removeExisting: value.removeExisting || Boolean(value.path) })

  return (
    <View style={[styles.card, { borderColor: validationError ? tokens.semantic.danger : tokens.border.default, backgroundColor: tokens.surface.default }]}>
      <View style={styles.headingRow}>
        <View style={[styles.iconBubble, { backgroundColor: withAlpha(tokens.brand.teacher, '22') }]}><Ionicons name="sparkles-outline" size={19} color={tokens.brand.teacher} /></View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: tokens.text.primary }]}>Contenido multimedia</Text>
          <Text style={[styles.subtitle, { color: tokens.text.secondary }]}>Añade una imagen, un audio o un vídeo para contextualizar la pregunta.</Text>
        </View>
        {value.type ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Eliminar contenido multimedia" hitSlop={8} onPress={clear} style={({ pressed }) => [styles.removeButton, { borderColor: withAlpha(tokens.semantic.danger, '70'), backgroundColor: withAlpha(tokens.semantic.danger, '18') }, pressed && styles.pressed]}>
            <Ionicons name="trash-outline" size={18} color={tokens.semantic.danger} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.optionGrid}>
        {options.map((option) => {
          const active = value.type === option.type
          const loading = picking === option.type
          return (
            <Pressable
              key={option.type}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar ${option.label.toLowerCase()}`}
              accessibilityState={{ selected: active, disabled: disabled || Boolean(picking) }}
              disabled={disabled || Boolean(picking)}
              onPress={() => void choose(option.type)}
              style={({ pressed }) => [styles.option, { borderColor: active ? tokens.brand.teacher : tokens.border.default, backgroundColor: active ? withAlpha(tokens.brand.teacher, '18') : tokens.surface.interactive }, pressed && styles.pressed]}
            >
              {loading ? <ActivityIndicator color={tokens.brand.teacher} /> : <Ionicons name={option.icon} size={22} color={active ? tokens.brand.teacher : tokens.text.muted} />}
              <View style={styles.optionCopy}>
                <Text style={[styles.optionLabel, { color: active ? tokens.brand.teacher : tokens.text.primary }]}>{option.label}</Text>
                <Text style={[styles.optionDetail, { color: tokens.text.muted }]}>{option.detail}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      {value.type && (previewUrl || value.path) ? (
        <View style={styles.previewArea}>
          <QuestionMedia type={value.type} url={previewUrl} path={value.path} transcript={value.transcript} subtitlesVtt={value.subtitlesVtt} altText={value.altText} caption={value.caption} compact />

          {value.type === 'image' ? <MediaField label="Texto alternativo" accessibilityLabel="Texto alternativo de la imagen" value={value.altText} onChange={(altText) => onChange({ ...value, altText })} placeholder="Describe la imagen para lectores de pantalla" maxLength={300} /> : null}
          {value.type === 'audio' ? <MediaField label="Transcripción obligatoria" accessibilityLabel="Transcripción del audio" value={value.transcript} onChange={(transcript) => onChange({ ...value, transcript })} placeholder="Escribe el contenido hablado para que también pueda leerse" maxLength={20000} multiline /> : null}
          {value.type === 'video' ? <MediaField label="Subtítulos WebVTT obligatorios" accessibilityLabel="Subtítulos WebVTT del vídeo" value={value.subtitlesVtt} onChange={(subtitlesVtt) => onChange({ ...value, subtitlesVtt })} placeholder={'WEBVTT\n\n00:00.000 --> 00:03.000\nTexto del subtítulo'} maxLength={40000} multiline autoCapitalize="none" /> : null}
          <MediaField label="Pie o contexto opcional" accessibilityLabel="Pie del contenido multimedia" value={value.caption} onChange={(caption) => onChange({ ...value, caption })} placeholder="Ej.: Observa el mapa antes de responder" maxLength={300} />

          <View style={styles.fileInfo}>
            <Ionicons name="cloud-upload-outline" size={15} color={tokens.semantic.info} />
            <Text style={[styles.fileInfoText, { color: tokens.text.muted }]} numberOfLines={1}>{value.pendingAsset?.fileName || 'Archivo guardado'} · máximo 25 MB{value.durationSeconds ? ` · ${formatDuration(value.durationSeconds)}` : ''}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.emptyState, { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }]}>
          <Ionicons name="albums-outline" size={28} color={tokens.text.muted} />
          <Text style={[styles.emptyText, { color: tokens.text.muted }]}>La pregunta funcionará también sin contenido multimedia.</Text>
        </View>
      )}

      {validationError ? <Text style={[styles.validationError, { color: tokens.semantic.danger }]}>{validationError}</Text> : null}
    </View>
  )
}

function MediaField({ label, accessibilityLabel, value, onChange, placeholder, maxLength, multiline = false, autoCapitalize }: { label: string; accessibilityLabel: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength: number; multiline?: boolean; autoCapitalize?: 'none' }) {
  const { tokens } = useAppTheme()
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: tokens.text.secondary }]}>{label}</Text>
      <TextInput accessibilityLabel={accessibilityLabel} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={tokens.text.muted} style={[styles.input, multiline && styles.multilineInput, { borderColor: tokens.border.default, color: tokens.text.primary, backgroundColor: tokens.surface.interactive }]} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} autoCapitalize={autoCapitalize} maxLength={maxLength} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBubble: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { minWidth: 0, flex: 1 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  removeButton: { width: 40, height: 40, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionGrid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { minWidth: 150, minHeight: 66, flexGrow: 1, flexBasis: 0, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionCopy: { minWidth: 0, flex: 1 },
  optionLabel: { fontSize: 13, fontWeight: '900' },
  optionDetail: { marginTop: 2, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  previewArea: { marginTop: 14 },
  fieldGroup: { marginTop: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '800' },
  input: { minHeight: 46, marginTop: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14, fontWeight: '600' },
  multilineInput: { minHeight: 112, paddingTop: 12 },
  fileInfo: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  fileInfoText: { minWidth: 0, flex: 1, fontSize: 11, fontWeight: '700' },
  emptyState: { minHeight: 94, marginTop: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 16 },
  emptyText: { marginTop: 8, fontSize: 12, textAlign: 'center', fontWeight: '600' },
  validationError: { marginTop: 10, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  pressed: { opacity: 0.72 },
})

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.round(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

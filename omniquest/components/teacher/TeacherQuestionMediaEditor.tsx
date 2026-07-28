import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import QuestionMedia from '../questions/QuestionMedia'
import {
  pickQuestionMedia,
  QUESTION_MEDIA_MAX_BYTES,
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
}

const options: Array<{
  type: QuestionMediaType
  label: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
}> = [
  { type: 'image', label: 'Imagen', detail: 'JPG, PNG, WebP o GIF', icon: 'image-outline' },
  { type: 'audio', label: 'Audio', detail: 'MP3, M4A, WAV u OGG', icon: 'volume-high-outline' },
  { type: 'video', label: 'Vídeo', detail: 'MP4, WebM o MOV', icon: 'videocam-outline' },
]

export default function TeacherQuestionMediaEditor({ value, onChange, disabled = false, onError }: Props) {
  const [picking, setPicking] = useState<QuestionMediaType | null>(null)
  const previewUrl = value.pendingAsset?.uri || value.url

  const choose = async (type: QuestionMediaType) => {
    if (disabled) return
    setPicking(type)
    try {
      const asset = await pickQuestionMedia(type)
      if (!asset) return
      if (asset.fileSize && asset.fileSize > QUESTION_MEDIA_MAX_BYTES) {
        throw new Error('El archivo supera el límite de 25 MB.')
      }
      onChange({
        ...value,
        type,
        url: null,
        path: null,
        durationSeconds: asset.durationSeconds,
        transcript: type === 'audio' ? value.transcript : '',
        subtitlesVtt: type === 'video' ? value.subtitlesVtt : '',
        pendingAsset: asset,
        removeExisting: value.removeExisting || Boolean(value.path),
      })
    } catch (error: any) {
      onError(error?.message || 'No se pudo seleccionar el archivo multimedia.')
    } finally {
      setPicking(null)
    }
  }

  const clear = () => {
    onChange({
      type: null,
      url: null,
      path: null,
      durationSeconds: null,
      altText: '',
      caption: '',
      transcript: '',
      subtitlesVtt: '',
      pendingAsset: null,
      removeExisting: value.removeExisting || Boolean(value.path),
    })
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.iconBubble}>
          <Ionicons name="sparkles-outline" size={19} color="#A78BFA" />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Contenido multimedia</Text>
          <Text style={styles.subtitle}>Añade una imagen, un audio o un vídeo para contextualizar la pregunta.</Text>
        </View>
        {value.type ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eliminar contenido multimedia"
            hitSlop={8}
            onPress={clear}
            style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={18} color="#FB7185" />
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
              style={({ pressed }) => [
                styles.option,
                active && styles.optionActive,
                pressed && styles.pressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#A78BFA" />
              ) : (
                <Ionicons name={option.icon} size={22} color={active ? '#C4B5FD' : '#8FA7C7'} />
              )}
              <View style={styles.optionCopy}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      {value.type && (previewUrl || value.path) ? (
        <View style={styles.previewArea}>
          <QuestionMedia
            type={value.type}
            url={previewUrl}
            path={value.path}
            transcript={value.transcript}
            subtitlesVtt={value.subtitlesVtt}
            altText={value.altText}
            caption={value.caption}
            compact
          />

          {value.type === 'image' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Texto alternativo</Text>
              <TextInput
                accessibilityLabel="Texto alternativo de la imagen"
                value={value.altText}
                onChangeText={(altText) => onChange({ ...value, altText })}
                placeholder="Describe la imagen para lectores de pantalla"
                placeholderTextColor="#7085A5"
                style={styles.input}
                maxLength={300}
              />
            </View>
          ) : null}

          {value.type === 'audio' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Transcripción obligatoria</Text>
              <TextInput
                accessibilityLabel="Transcripción del audio"
                value={value.transcript}
                onChangeText={(transcript) => onChange({ ...value, transcript })}
                placeholder="Escribe el contenido hablado para que también pueda leerse"
                placeholderTextColor="#7085A5"
                style={[styles.input, styles.multilineInput]}
                multiline
                textAlignVertical="top"
                maxLength={20000}
              />
            </View>
          ) : null}

          {value.type === 'video' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Subtítulos WebVTT obligatorios</Text>
              <TextInput
                accessibilityLabel="Subtítulos WebVTT del vídeo"
                value={value.subtitlesVtt}
                onChangeText={(subtitlesVtt) => onChange({ ...value, subtitlesVtt })}
                placeholder={'WEBVTT\n\n00:00.000 --> 00:03.000\nTexto del subtítulo'}
                placeholderTextColor="#7085A5"
                style={[styles.input, styles.multilineInput]}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                maxLength={40000}
              />
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Pie o contexto opcional</Text>
            <TextInput
              accessibilityLabel="Pie del contenido multimedia"
              value={value.caption}
              onChangeText={(caption) => onChange({ ...value, caption })}
              placeholder="Ej.: Observa el mapa antes de responder"
              placeholderTextColor="#7085A5"
              style={styles.input}
              maxLength={300}
            />
          </View>

          <View style={styles.fileInfo}>
            <Ionicons name="cloud-upload-outline" size={15} color="#60A5FA" />
            <Text style={styles.fileInfoText} numberOfLines={1}>
              {value.pendingAsset?.fileName || 'Archivo guardado'} · máximo 25 MB
              {value.durationSeconds ? ` · ${formatDuration(value.durationSeconds)}` : ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="albums-outline" size={28} color="#60789A" />
          <Text style={styles.emptyText}>La pregunta funcionará también sin contenido multimedia.</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#2A456A',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#0A2042',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D1850',
  },
  headingCopy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    color: '#AFC2DB',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  removeButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#6B263A',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A0E1B',
  },
  optionGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  option: {
    minWidth: 150,
    minHeight: 66,
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: '#28466F',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#071A36',
  },
  optionActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#18164A',
  },
  optionCopy: {
    minWidth: 0,
    flex: 1,
  },
  optionLabel: {
    color: '#DDE7F4',
    fontSize: 13,
    fontWeight: '900',
  },
  optionLabelActive: {
    color: '#C4B5FD',
  },
  optionDetail: {
    marginTop: 2,
    color: '#8095B4',
    fontSize: 10,
    fontWeight: '600',
  },
  previewArea: {
    marginTop: 14,
  },
  fieldGroup: {
    marginTop: 12,
  },
  fieldLabel: {
    color: '#B8C8DD',
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 46,
    marginTop: 7,
    borderWidth: 1,
    borderColor: '#2A456A',
    borderRadius: 12,
    paddingHorizontal: 13,
    color: '#FFFFFF',
    backgroundColor: '#071A36',
    fontSize: 14,
    fontWeight: '600',
  },
  multilineInput: {
    minHeight: 112,
    paddingTop: 12,
  },
  fileInfo: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  fileInfoText: {
    minWidth: 0,
    flex: 1,
    color: '#8FA7C7',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    minHeight: 94,
    marginTop: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#294873',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#071A36',
  },
  emptyText: {
    marginTop: 8,
    color: '#8095B4',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
})

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.round(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

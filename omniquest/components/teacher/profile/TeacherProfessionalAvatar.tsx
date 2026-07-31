import React from 'react'
import { ActivityIndicator, Image, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'

type Props = {
  alias: string
  avatar: string | null
  uploading: boolean
  onPress: () => void
  size?: number
}

export default function TeacherProfessionalAvatar({ alias, avatar, uploading, onPress, size = 112 }: Props) {
  const { tokens } = useAppTheme()
  const innerSize = size - 12
  return (
    <View>
      <AppPressable
        accessibilityLabel={uploading ? 'Subiendo fotografía profesional' : 'Cambiar fotografía profesional'}
        accessibilityHint="Selecciona una fotografía para tu identidad docente. No usa marcos ni cosméticos del alumno."
        accessibilityState={{ disabled: uploading, busy: uploading }}
        disabled={uploading}
        onPress={onPress}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: tokens.border.active,
          backgroundColor: tokens.surface.selected,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <View style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {avatar?.startsWith('http') ? (
            <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text maxFontSizeMultiplier={2} style={{ color: tokens.text.primary, fontSize: size * 0.3, fontWeight: '900' }}>
              {getInitials(alias)}
            </Text>
          )}
        </View>
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.brand.teacher,
          }}
        >
          {uploading ? <ActivityIndicator size="small" color={tokens.text.inverse} /> : <Ionicons name="camera" size={17} color={tokens.text.inverse} />}
        </View>
      </AppPressable>
      <Text maxFontSizeMultiplier={2} style={{ marginTop: 9, textAlign: 'center', color: tokens.text.muted, fontSize: 11, lineHeight: 16 }}>
        Foto profesional
      </Text>
    </View>
  )
}

function getInitials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'P'
}

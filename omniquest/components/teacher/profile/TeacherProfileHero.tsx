import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { formatLongDate } from '../../../lib/dateFormat'
import TeacherProfessionalAvatar from './TeacherProfessionalAvatar'
import { useResponsiveLayout } from '../../../lib/responsive'

type Props = {
  alias: string
  email: string
  avatar: string | null
  createdAt: string
  uploadingAvatar: boolean
  onAvatarPress: () => void
  onEditProfile: () => void
  onSecurity: () => void
}

export default function TeacherProfileHero(props: Props) {
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()

  return (
    <View style={{ borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.default, borderRadius: 22, padding: responsive.isMobile ? 18 : 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: responsive.isMobile ? 16 : 20 }}>
        <TeacherProfessionalAvatar
          alias={props.alias}
          avatar={props.avatar}
          uploading={props.uploadingAvatar}
          onPress={props.onAvatarPress}
          size={responsive.isMobile ? 96 : 112}
        />

        <View style={{ minWidth: 0, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="school-outline" size={19} color={tokens.brand.teacher} />
            <Text style={{ color: tokens.brand.teacher, fontSize: 13, fontWeight: '900' }}>
              Identidad docente
            </Text>
          </View>

          <Text
            maxFontSizeMultiplier={2}
            numberOfLines={1}
            style={{
              marginTop: 8,
              color: tokens.text.primary,
              fontSize: responsive.isMobile ? 24 : 28,
              lineHeight: responsive.isMobile ? 30 : 34,
              fontWeight: '900',
            }}
          >
            {props.alias}
          </Text>

          <Text
            maxFontSizeMultiplier={2}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ marginTop: 4, color: tokens.text.secondary, fontSize: 14, lineHeight: 20 }}
          >
            {props.email || 'Sin correo'}
          </Text>

          <Text
            maxFontSizeMultiplier={2}
            style={{ marginTop: 6, color: tokens.text.muted, fontSize: 12, lineHeight: 18 }}
          >
            Miembro desde {formatLongDate(props.createdAt)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <AppButton label="Editar perfil" icon="create-outline" role="teacher" size="sm" onPress={props.onEditProfile} />
        <AppButton label="Seguridad" icon="lock-closed-outline" variant="secondary" size="sm" onPress={props.onSecurity} />
      </View>
    </View>
  )
}
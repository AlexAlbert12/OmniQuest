import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { formatLongDate } from '../../../lib/dateFormat'
import TeacherProfessionalAvatar from './TeacherProfessionalAvatar'

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
  return (
    <View style={{ borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.default, borderRadius: 22, padding: 22 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
        <TeacherProfessionalAvatar alias={props.alias} avatar={props.avatar} uploading={props.uploadingAvatar} onPress={props.onAvatarPress} />
        <View style={{ minWidth: 220, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="school-outline" size={19} color={tokens.brand.teacher} />
            <Text style={{ color: tokens.brand.teacher, fontSize: 13, fontWeight: '900' }}>Identidad docente</Text>
          </View>
          <Text maxFontSizeMultiplier={2} style={{ marginTop: 8, color: tokens.text.primary, fontSize: 28, lineHeight: 34, fontWeight: '900' }}>{props.alias}</Text>
          <Text maxFontSizeMultiplier={2} style={{ marginTop: 4, color: tokens.text.secondary, fontSize: 14, lineHeight: 20 }}>{props.email || 'Sin correo'}</Text>
          <Text maxFontSizeMultiplier={2} style={{ marginTop: 6, color: tokens.text.muted, fontSize: 12, lineHeight: 18 }}>Miembro desde {formatLongDate(props.createdAt)}</Text>
          <Text maxFontSizeMultiplier={2} style={{ marginTop: 12, color: tokens.text.secondary, fontSize: 12, lineHeight: 18 }}>
            La fotografía profesional se muestra en espacios docentes y está separada de marcos, insignias y cosméticos del alumnado.
          </Text>
          <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <AppButton label="Editar perfil" icon="create-outline" role="teacher" size="sm" onPress={props.onEditProfile} />
            <AppButton label="Seguridad" icon="lock-closed-outline" variant="secondary" size="sm" onPress={props.onSecurity} />
          </View>
        </View>
      </View>
    </View>
  )
}

import React from 'react'
import { Image, Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { getRenderableAvatarUri } from '../../../lib/avatarUri'
import { withAlpha } from '../../../lib/color'
import { getInitials } from './studentUtils'

export default function StudentProfileAvatar({ alias, avatar, size = 44, accentColor }: {
  alias: string
  avatar?: string | null
  size?: number
  accentColor?: string
}) {
  const { tokens } = useAppTheme()
  const [failed, setFailed] = React.useState(false)
  const avatarUri = getRenderableAvatarUri(avatar)
  const color = accentColor || tokens.brand.teacher

  React.useEffect(() => setFailed(false), [avatarUri])

  return (
    <View
      accessibilityLabel={`Foto de perfil de ${alias}`}
      accessibilityRole="image"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: withAlpha(color, '80'),
        backgroundColor: withAlpha(color, '22'),
      }}
    >
      {avatarUri && !failed ? (
        <Image source={{ uri: avatarUri }} resizeMode="cover" onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ color: tokens.text.primary, fontSize: Math.max(12, Math.round(size * 0.31)), fontWeight: '900' }}>
          {getInitials(alias)}
        </Text>
      )}
    </View>
  )
}

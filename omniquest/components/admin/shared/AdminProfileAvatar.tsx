import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { getRenderableAvatarUri } from '../../../lib/avatarUri'
import { withAlpha } from '../../../lib/color'
import { getInitials } from '../utils/adminUtils'
import AvatarImage from '../../ui/AvatarImage'

type AdminProfileAvatarProps = {
  alias: string
  avatar?: string | null
  size?: number
}

export default function AdminProfileAvatar({ alias, avatar, size = 48 }: AdminProfileAvatarProps) {
  const { tokens } = useAppTheme()
  const [failed, setFailed] = useState(false)
  const avatarUri = getRenderableAvatarUri(avatar)

  useEffect(() => setFailed(false), [avatarUri])

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
        borderColor: withAlpha(tokens.brand.admin, '80'),
        backgroundColor: withAlpha(tokens.brand.admin, '18'),
      }}
    >
      {avatarUri && !failed ? (
        <AvatarImage uri={avatarUri} onError={() => setFailed(true)} />
      ) : (
        <Text style={{ color: tokens.brand.admin, fontSize: Math.max(13, Math.round(size * 0.31)), fontWeight: '900' }}>
          {getInitials(alias)}
        </Text>
      )}
    </View>
  )
}

import React from 'react'
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import type { AvatarFrame, ProfileCosmetics } from '../../lib/avatarCosmetics'
import { DEFAULT_AVATAR_FRAME } from '../../lib/avatarCosmetics'
import { getStudentBadgePresentation } from '../../lib/studentBadges'

export type GamifiedAvatarProps = {
  avatarUrl?: string | null
  alias: string
  size?: number
  level?: number
  cosmetics?: ProfileCosmetics | null
  frame?: AvatarFrame | null
  featuredBadgeId?: string | null
  onPress?: () => void
  editable?: boolean
  showLevel?: boolean
  showFeaturedBadge?: boolean
  style?: ViewStyle
}

export default function GamifiedAvatar({
  avatarUrl,
  alias,
  size = 52,
  level,
  cosmetics,
  frame,
  featuredBadgeId,
  onPress,
  editable = false,
  showLevel = true,
  showFeaturedBadge = true,
  style,
}: GamifiedAvatarProps) {
  const equippedFrame = frame || cosmetics?.frame || DEFAULT_AVATAR_FRAME
  const equippedBadgeId = featuredBadgeId ?? cosmetics?.featuredBadgeId ?? null
  const badge = equippedBadgeId ? getStudentBadgePresentation(equippedBadgeId) : null
  const borderWidth = Math.max(3, Math.round(size * 0.065))
  const innerSize = size - borderWidth * 2
  const badgeSize = Math.max(20, Math.round(size * 0.34))
  const levelFontSize = Math.max(9, Math.round(size * 0.14))
  const isLegendary = equippedFrame.rarity === 'legendary'
  const content = (
    <View style={[{ width: size + badgeSize * 0.3, height: size + badgeSize * 0.28 }, style]}>
      {isLegendary ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowColor: equippedFrame.primaryColor,
            shadowOpacity: 0.68,
            shadowRadius: 12,
            elevation: 10,
          }}
        />
      ) : null}

      <LinearGradient
        colors={[equippedFrame.primaryColor, equippedFrame.secondaryColor]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: borderWidth,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#152A50',
            borderWidth: 1,
            borderColor: '#DCEBFF55',
          }}
        >
          {avatarUrl && avatarUrl.startsWith('http') ? (
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: Math.round(size * 0.3), fontWeight: '900' }}>
              {getInitials(alias)}
            </Text>
          )}
        </View>
      </LinearGradient>

      {showLevel && typeof level === 'number' ? (
        <View
          style={{
            position: 'absolute',
            left: Math.max(0, size * 0.07),
            bottom: 0,
            minWidth: Math.max(27, size * 0.38),
            height: Math.max(20, size * 0.28),
            borderRadius: 999,
            paddingHorizontal: 6,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#071426',
            borderWidth: 1.5,
            borderColor: equippedFrame.primaryColor,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: levelFontSize, fontWeight: '900' }}>Nv. {level}</Text>
        </View>
      ) : null}

      {showFeaturedBadge && badge ? (
        <View
          accessibilityLabel={`Insignia destacada: ${badge.title}`}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#071426',
            borderWidth: 2,
            borderColor: badge.color,
          }}
        >
          <Ionicons name={badge.icon} size={Math.round(badgeSize * 0.58)} color={badge.color} />
        </View>
      ) : null}

      {editable ? (
        <View
          style={{
            position: 'absolute',
            right: badge ? badgeSize * 0.72 : 0,
            top: 0,
            width: Math.max(25, size * 0.3),
            height: Math.max(25, size * 0.3),
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: equippedFrame.secondaryColor,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        >
          <Ionicons name="sparkles" size={Math.max(13, size * 0.16)} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  )

  if (!onPress) return content

  return (
    <Pressable
      accessibilityLabel="Personalizar avatar"
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
    >
      {content}
    </Pressable>
  )
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'O'
}

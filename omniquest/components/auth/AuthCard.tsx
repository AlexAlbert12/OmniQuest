import React, { type ReactNode } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { createShadowStyle } from '../../lib/platformShadow'

type AuthCardProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
  accentColor?: string
  isDesktop?: boolean
  maxWidth?: number
  style?: StyleProp<ViewStyle>
}

export default function AuthCard({
  icon,
  title,
  subtitle,
  children,
  footer,
  accentColor = '#7C5CFF',
  isDesktop = false,
  maxWidth = 520,
  style,
}: AuthCardProps) {
  return (
    <LinearGradient
      colors={[`${accentColor}2E`, 'rgba(18, 28, 69, 0.96)', 'rgba(5, 14, 31, 0.98)']}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        {
          borderColor: `${accentColor}4D`,
          borderRadius: 30,
          borderWidth: 1,
          maxWidth,
          overflow: 'hidden',
          width: '100%',
          ...createShadowStyle({
            color: accentColor,
            opacity: 0.18,
            radius: 26,
            offsetY: 14,
            elevation: 11,
            web: `0 22px 48px ${accentColor}22`,
          }),
        },
        style,
      ]}
    >
      <View style={{ padding: isDesktop ? 30 : 22, gap: 18 }}>
        <View className="flex-row items-center gap-4">
          <View
            className="items-center justify-center"
            style={{
              backgroundColor: `${accentColor}E6`,
              borderColor: `${accentColor}66`,
              borderRadius: 20,
              borderWidth: 1,
              height: 60,
              width: 60,
            }}
          >
            <Ionicons name={icon} size={29} color="#FFFFFF" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[26px] font-black text-white" numberOfLines={2}>{title}</Text>
            <Text className="mt-1 text-[14px] font-semibold leading-5 text-text-secondary">{subtitle}</Text>
          </View>
        </View>

        {children}
      </View>

      {footer ? (
        <View
          className="border-t px-5 py-5"
          style={{
            backgroundColor: 'rgba(7, 22, 44, 0.72)',
            borderColor: 'rgba(148, 163, 184, 0.14)',
          }}
        >
          {footer}
        </View>
      ) : null}
    </LinearGradient>
  )
}

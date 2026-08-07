import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useI18n } from '../../lib/i18n'

export default function AuthHomeLink() {
  const { t } = useI18n()
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <View className="absolute left-5 top-5 z-20">
      <Link href="/" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('auth.common.home')}
          focusable
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          className="flex-row items-center gap-2"
          style={({ pressed }) => {
            const highlighted = pressed || focused || hovered
            return {
              backgroundColor: highlighted ? 'rgba(16, 42, 82, 0.72)' : 'rgba(16, 42, 82, 0.16)',
              borderColor: highlighted ? 'rgba(140, 213, 255, 0.30)' : 'rgba(140, 213, 255, 0.08)',
              borderRadius: 999,
              borderWidth: 1,
              minHeight: 44,
              opacity: pressed ? 0.82 : 1,
              paddingHorizontal: 14,
            }
          }}
        >
          <Ionicons name="home-outline" size={18} color="#8CD5FF" />
          <Text maxFontSizeMultiplier={2} className="text-[14px] font-bold text-text-secondary">
            {t('auth.common.home')}
          </Text>
        </Pressable>
      </Link>
    </View>
  )
}

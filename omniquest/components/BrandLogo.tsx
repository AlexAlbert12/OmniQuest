import { Text, View, type ViewStyle } from 'react-native'
import { createTextShadowStyle } from '../lib/platformShadow'

type BrandLogoProps = {
  center?: boolean
  size?: number
  style?: ViewStyle
}

export default function BrandLogo({ center = false, size = 30, style }: BrandLogoProps) {
  return (
    <View
      className="flex-row flex-wrap items-center"
      style={[
        center ? { alignSelf: 'center', justifyContent: 'center' } : undefined,
        style,
      ]}
    >
      <Text
        className="text-white"
        style={{
          fontFamily: 'Pacifico_400Regular',
          fontSize: size,
          lineHeight: Math.round(size * 1.25),
          ...createTextShadowStyle({
            color: 'rgba(255, 255, 255, 0.18)',
            offsetY: 2,
            radius: Math.max(6, Math.round(size * 0.14)),
          }),
        }}
      >
        Omni
      </Text>
      <Text
        className="text-[#42B9FF]"
        style={{
          fontFamily: 'Pacifico_400Regular',
          fontSize: size,
          lineHeight: Math.round(size * 1.25),
          ...createTextShadowStyle({
            color: 'rgba(66, 185, 255, 0.32)',
            offsetY: 2,
            radius: Math.max(6, Math.round(size * 0.16)),
          }),
        }}
      >
        Quest
      </Text>
    </View>
  )
}

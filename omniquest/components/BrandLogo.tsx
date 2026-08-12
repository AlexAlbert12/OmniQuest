import { Text, View, type ViewStyle } from 'react-native'
import { withAlpha } from '../lib/color'
import { createTextShadowStyle } from '../lib/platformShadow'

type BrandLogoProps = {
  center?: boolean
  questColor?: string
  size?: number
  style?: ViewStyle
}

export default function BrandLogo({ center = false, questColor = '#38BDF8', size = 30, style }: BrandLogoProps) {
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
        style={{
          color: questColor,
          fontFamily: 'Pacifico_400Regular',
          fontSize: size,
          lineHeight: Math.round(size * 1.25),
          ...createTextShadowStyle({
            color: withAlpha(questColor, '52'),
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

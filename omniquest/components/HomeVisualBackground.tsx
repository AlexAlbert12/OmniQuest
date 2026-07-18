import { LinearGradient } from 'expo-linear-gradient'
import { Platform, View } from 'react-native'

type FloatingBlobProps = {
  bottom?: number
  color: string
  height: number
  left?: number | `${number}%`
  opacity: number
  right?: number | `${number}%`
  top?: number
  width: number
}

const finalHomeBackground = {
  base: '#010611',
  gradientStart: '#081129',
  gradientMiddle: '#03152F',
  gradientEnd: '#010611',
  blobPrimary: '#38BDF8',
  blobSecondary: '#A855F7',
  blobAccent: '#14D7C8',
} as const

const sparseHomeStars = [
  { left: '12%', top: '12%', size: 2, opacity: 0.6 },
  { left: '81%', top: '15%', size: 3, opacity: 0.48 },
  { left: '18%', top: '41%', size: 2, opacity: 0.46 },
  { left: '88%', top: '47%', size: 2, opacity: 0.54 },
  { left: '9%', top: '72%', size: 3, opacity: 0.34 },
  { left: '74%', top: '78%', size: 2, opacity: 0.38 },
] as const

export default function HomeVisualBackground({ isDesktop }: { isDesktop: boolean }) {
  return (
    <View className="absolute inset-0 overflow-hidden" style={{ backgroundColor: finalHomeBackground.base }}>
      <LinearGradient
        colors={[
          finalHomeBackground.gradientStart,
          finalHomeBackground.gradientMiddle,
          finalHomeBackground.gradientEnd,
        ]}
        locations={[0, 0.34, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
      />

      <FloatingBlob
        color={finalHomeBackground.blobPrimary}
        height={isDesktop ? 460 : 230}
        left={isDesktop ? -220 : -165}
        opacity={isDesktop ? 0.08 : 0.06}
        top={isDesktop ? -170 : -92}
        width={isDesktop ? 460 : 230}
      />
      <FloatingBlob
        color={finalHomeBackground.blobSecondary}
        height={isDesktop ? 560 : 300}
        opacity={isDesktop ? 0.16 : 0.12}
        right={isDesktop ? -160 : -145}
        top={isDesktop ? 110 : 72}
        width={isDesktop ? 560 : 300}
      />
      <FloatingBlob
        color={finalHomeBackground.blobAccent}
        bottom={isDesktop ? -230 : -145}
        height={isDesktop ? 460 : 240}
        left={isDesktop ? '38%' : '32%'}
        opacity={isDesktop ? 0.09 : 0.07}
        width={isDesktop ? 460 : 240}
      />

      {sparseHomeStars.map((star, index) => (
        <View
          key={`${star.left}-${index}`}
          className="absolute rounded-full bg-white"
          style={{
            height: star.size,
            left: star.left,
            opacity: star.opacity,
            top: star.top,
            width: star.size,
          }}
        />
      ))}
    </View>
  )
}

function FloatingBlob({ bottom, color, height, left, opacity, right, top, width }: FloatingBlobProps) {
  return (
    <LinearGradient
      colors={[`${color}2E`, `${color}00`]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{
        borderRadius: width / 2,
        bottom,
        height,
        left,
        opacity,
        position: 'absolute',
        right,
        top,
        width,
        ...(Platform.OS === 'web' ? { filter: 'blur(58px)' } : null),
      }}
    />
  )
}
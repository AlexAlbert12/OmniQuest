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

const desktopHomeStars = [
  { left: '12%', top: '12%', size: 3, opacity: 0.34 },
  { left: '81%', top: '15%', size: 3, opacity: 0.3 },
  { left: '18%', top: '41%', size: 3, opacity: 0.26 },
  { left: '88%', top: '47%', size: 3, opacity: 0.3 },
  { left: '9%', top: '72%', size: 3, opacity: 0.22 },
] as const

const mobileHomeStars = [
  { left: '7%', top: '24%', size: 3, opacity: 0.2 },
  { left: '93%', top: '55%', size: 3, opacity: 0.22 },
  { left: '8%', top: '90%', size: 3, opacity: 0.16 },
] as const

export default function HomeVisualBackground({ isDesktop }: { isDesktop: boolean }) {
  const stars = isDesktop ? desktopHomeStars : mobileHomeStars

  return (
    <View
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: 'none', backgroundColor: finalHomeBackground.base }}
    >
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

      {stars.map((star, index) => (
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

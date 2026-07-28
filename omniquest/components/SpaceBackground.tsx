import React from 'react'
import { View, type ViewStyle } from 'react-native'

export default function SpaceBackdrop({ isDesktop = false }: { isDesktop?: boolean }) {
  return (
    <View className="absolute inset-0 overflow-hidden rounded-[34px] md:rounded-none">
      <View className="absolute inset-0 bg-background-secondary" />
      <View className="absolute inset-0 bg-surface-raised" />

      <View
        className="absolute rounded-full bg-surface-selected"
        style={{
          width: isDesktop ? 340 : 180,
          height: isDesktop ? 340 : 180,
          left: isDesktop ? -142 : -92,
          top: isDesktop ? -116 : -54,
          opacity: 0.9,
          transform: [{ rotate: '-14deg' }],
        }}
      />
      <View
        className="absolute rounded-full border border-border-active"
        style={{
          width: isDesktop ? 420 : 230,
          height: isDesktop ? 82 : 48,
          left: isDesktop ? -176 : -112,
          top: isDesktop ? 78 : 52,
          transform: [{ rotate: '-14deg' }],
        }}
      />

      <View
        className="absolute rounded-full bg-surface-selected"
        style={{
          width: isDesktop ? 88 : 58,
          height: isDesktop ? 88 : 58,
          right: isDesktop ? 112 : 22,
          top: isDesktop ? 222 : 168,
        }}
      />
      <View
        className="absolute rounded-full border border-border-active"
        style={{
          width: isDesktop ? 144 : 92,
          height: isDesktop ? 42 : 28,
          right: isDesktop ? 74 : 4,
          top: isDesktop ? 246 : 184,
          transform: [{ rotate: '-18deg' }],
        }}
      />

      <View
        className="absolute rounded-full bg-surface-raised"
        style={{
          width: isDesktop ? 460 : 240,
          height: isDesktop ? 460 : 240,
          left: isDesktop ? -130 : -120,
          bottom: isDesktop ? -320 : -170,
          opacity: 0.5,
        }}
      />
      <View
        className="absolute rounded-full bg-surface-raised"
        style={{
          width: isDesktop ? 360 : 200,
          height: isDesktop ? 360 : 200,
          right: isDesktop ? -130 : -126,
          bottom: isDesktop ? -250 : -148,
          opacity: 0.46,
        }}
      />

      <View
        className="absolute"
        style={{
          left: isDesktop ? '49%' : '48%',
          top: isDesktop ? 46 : 34,
          transform: [{ rotate: '42deg' }],
        }}
      >
      </View>

      <Sparkle left="22%" top="27%" size={16} opacity={0.82} />
      <Sparkle left="91%" top="5%" size={15} opacity={0.7} />
      <Sparkle left="8%" top="34%" size={13} opacity={0.72} />
      <Star left="7%" top="6%" size={3} opacity={0.85} />
      <Star left="27%" top="10%" size={4} opacity={0.78} />
      <Star left="69%" top="3%" size={3} opacity={0.85} />
      <Star left="79%" top="15%" size={4} opacity={0.74} />
      <Star left="96%" top="20%" size={3} opacity={0.72} />
      <Star left="16%" top="18%" size={3} opacity={0.7} />
      <Star left="5%" top="50%" size={4} opacity={0.68} />
      <Star left="87%" top="45%" size={4} opacity={0.7} />
      <Star left="96%" top="38%" size={3} opacity={0.65} />
      <Star left="3%" top="30%" size={3} opacity={0.76} />
    </View>
  )
}

function Star({
  color = '#72C8FF',
  left,
  top,
  size,
  opacity,
}: {
  color?: string
  left: ViewStyle['left']
  top: ViewStyle['top']
  size: number
  opacity: number
}) {
  return (
    <View
      className="absolute rounded-full"
      style={{ backgroundColor: color, left, top, width: size, height: size, opacity }}
    />
  )
}

function Sparkle({
  color = '#CFEAFF',
  left,
  top,
  size,
  opacity,
}: {
  color?: string
  left: ViewStyle['left']
  top: ViewStyle['top']
  size: number
  opacity: number
}) {
  const thickness = Math.max(1, Math.round(size / 6))

  return (
    <View className="absolute items-center justify-center" style={{ left, top, width: size, height: size, opacity }}>
      <View className="absolute rounded-full" style={{ width: thickness, height: size, backgroundColor: color }} />
      <View className="absolute rounded-full" style={{ width: size, height: thickness, backgroundColor: color }} />
    </View>
  )
}

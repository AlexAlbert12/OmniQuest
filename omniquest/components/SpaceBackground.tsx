import React from 'react'
import { View, type ViewStyle } from 'react-native'

export default function SpaceBackdrop({ isDesktop = false }: { isDesktop?: boolean }) {
  return (
    <View className="absolute inset-0 overflow-hidden rounded-[34px] md:rounded-none">
      <View className="absolute inset-0 bg-[#071630]" />

      <View
        className="absolute rounded-full bg-[#0E3D7D]/55"
        style={{
          width: isDesktop ? 220 : 130,
          height: isDesktop ? 220 : 130,
          left: isDesktop ? -58 : -52,
          top: isDesktop ? 26 : 52,
          transform: [{ rotate: '-18deg' }],
        }}
      />
      <View
        className="absolute rounded-full border border-[#124B99]/50"
        style={{
          width: isDesktop ? 300 : 180,
          height: isDesktop ? 62 : 42,
          left: isDesktop ? -104 : -78,
          top: isDesktop ? 104 : 94,
          transform: [{ rotate: '-14deg' }],
        }}
      />

      <View
        className="absolute rounded-full bg-[#16478B]/70"
        style={{
          width: isDesktop ? 76 : 54,
          height: isDesktop ? 76 : 54,
          right: isDesktop ? 96 : 24,
          top: isDesktop ? 244 : 156,
        }}
      />
      <View
        className="absolute rounded-full border border-[#205BA6]/50"
        style={{
          width: isDesktop ? 112 : 78,
          height: isDesktop ? 34 : 24,
          right: isDesktop ? 70 : 10,
          top: isDesktop ? 264 : 170,
          transform: [{ rotate: '-18deg' }],
        }}
      />

      <Star left="26%" top="9%" size={3} opacity={0.8} />
      <Star left="36%" top="12%" size={5} opacity={0.9} />
      <Star left="83%" top="11%" size={5} opacity={0.55} />
      <Star left="92%" top="18%" size={3} opacity={0.6} />
      <Star left="18%" top="26%" size={3} opacity={0.55} />
      <Star left="8%" top="49%" size={4} opacity={0.65} />
      <Star left="86%" top="53%" size={4} opacity={0.55} />
      <Star left="74%" top="29%" size={5} opacity={0.58} />
      <Star left="58%" top="8%" size={3} opacity={0.68} />

      <CloudCluster align="left" />
      <CloudCluster align="right" />
    </View>
  )
}

function Star({
  left,
  top,
  size,
  opacity,
}: {
  left: ViewStyle['left']
  top: ViewStyle['top']
  size: number
  opacity: number
}) {
  return (
    <View
      className="absolute rounded-full bg-[#4FB8FF]"
      style={{ left, top, width: size, height: size, opacity }}
    />
  )
}

function CloudCluster({ align }: { align: 'left' | 'right' }) {
  const sideStyle = align === 'left' ? { left: -18 } : { right: -18 }

  return (
    <View className="absolute bottom-[-32px]" style={sideStyle}>
      <View
        className="absolute rounded-full bg-[#061B43]"
        style={{ width: 116, height: 116, bottom: 26, left: align === 'left' ? 0 : 136 }}
      />
      <View
        className="absolute rounded-full bg-[#08265C]"
        style={{ width: 126, height: 126, bottom: 8, left: align === 'left' ? 66 : 74 }}
      />
      <View
        className="absolute rounded-full bg-[#071F4D]"
        style={{ width: 154, height: 154, bottom: -18, left: align === 'left' ? 142 : -4 }}
      />
      <View
        className="rounded-t-full bg-[#05142E]"
        style={{ width: 300, height: 72, marginTop: 126 }}
      />
    </View>
  )
}

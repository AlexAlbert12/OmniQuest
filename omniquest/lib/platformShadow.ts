import { Platform } from 'react-native'

type ShadowOptions = {
  color: string
  opacity: number
  radius: number
  offsetX?: number
  offsetY?: number
  elevation?: number
  web?: string
}

export function createShadowStyle({
  color,
  opacity,
  radius,
  offsetX = 0,
  offsetY = 0,
  elevation = 0,
  web,
}: ShadowOptions) {
  if (Platform.OS === 'web') {
    return web ? ({ boxShadow: web } as const) : {}
  }

  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: offsetX, height: offsetY },
    elevation,
  }
}

export function createTextShadowStyle({
  color,
  radius,
  offsetX = 0,
  offsetY = 0,
}: {
  color: string
  radius: number
  offsetX?: number
  offsetY?: number
}) {
  if (Platform.OS === 'web') {
    return { textShadow: `${offsetX}px ${offsetY}px ${radius}px ${color}` } as const
  }

  return {
    textShadowColor: color,
    textShadowOffset: { width: offsetX, height: offsetY },
    textShadowRadius: radius,
  }
}

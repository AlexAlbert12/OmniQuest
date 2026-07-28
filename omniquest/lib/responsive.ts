import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'

export const APP_BREAKPOINTS = {
  mobile: 0,
  tablet: 600,
  desktop: 1024,
  wide: 1440,
} as const

export type AppBreakpoint = keyof typeof APP_BREAKPOINTS

export type ResponsiveLayout = {
  width: number
  height: number
  breakpoint: AppBreakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isWide: boolean
  horizontalPadding: number
  verticalPadding: number
  contentMaxWidth: number
  columns: 1 | 2 | 3 | 4
}

export function getAppBreakpoint(width: number): AppBreakpoint {
  if (width >= APP_BREAKPOINTS.wide) return 'wide'
  if (width >= APP_BREAKPOINTS.desktop) return 'desktop'
  if (width >= APP_BREAKPOINTS.tablet) return 'tablet'
  return 'mobile'
}

export function getResponsiveLayout(width: number, height = 0): ResponsiveLayout {
  const breakpoint = getAppBreakpoint(width)
  const isMobile = breakpoint === 'mobile'
  const isTablet = breakpoint === 'tablet'
  const isDesktop = breakpoint === 'desktop' || breakpoint === 'wide'
  const isWide = breakpoint === 'wide'

  return {
    width,
    height,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    horizontalPadding: isWide ? 36 : isDesktop ? 28 : isTablet ? 24 : 18,
    verticalPadding: isWide ? 30 : isDesktop ? 24 : isTablet ? 22 : 18,
    contentMaxWidth: isWide ? 1600 : isDesktop ? 1320 : isTablet ? 960 : 600,
    columns: isWide ? 4 : isDesktop ? 3 : isTablet ? 2 : 1,
  }
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions()
  return useMemo(() => getResponsiveLayout(width, height), [height, width])
}

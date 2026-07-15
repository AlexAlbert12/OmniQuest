export const MOBILE_BOTTOM_NAV_HEIGHT = 88
export const MOBILE_BOTTOM_NAV_SPACER = 116
export const MOBILE_SCREEN_HORIZONTAL_PADDING = 18
export const MOBILE_SCREEN_TOP_PADDING = 20

export function getMobileBottomPadding(hasBottomNav = true, extra = 0) {
  return (hasBottomNav ? MOBILE_BOTTOM_NAV_SPACER : 28) + extra
}
